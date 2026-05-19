---
feature: color-extract
---

# color-extract Review

アーキテクチャ・アルゴリズム・システムデザインに対する外部レビューの記録。
動作不具合・機能改善は `docs/issue/open/` に切り出す。

## レビューログ

<!-- 新しい順に上から追加 -->

### 2026-05-19 Opus 4.7 (review-record)

レビュー対象は `docs/issue/idea/039-dual-extract-worldview-accent.md` の設計提案で、`color-extract` の現 spec (salience 単独) との整合を見たもの。

- **領域**: arch
- **指摘**: issue 039 は 3 系統並行抽出に加えて bg 確定・Neovim ハイライト割り当て・WCAG コントラスト補正までを同一 feature 内で扱う書きぶりだが、現状 `src/features/palette-design/usecases/contrast.ts` が既に存在し、spec.md:126 でも dark/light style 派生は palette-design 側の責務と明記されている。color-extract は「3 系統の生データ提供」までに切り、bg 確定以降を palette-design に渡す責務分割を決めないと、両 feature の境界が二重に張られる。
- **対応**: 採用 (spec 化時に feature 分割)
- **メモ**: idea 段階の #039 では構想全体を 1 つにまとめて外観を伝える運用とする。実装着手 (spec 化) のタイミングで `color-extract` を「3 系統の抽出と中間データ提供」に絞り、`palette-design` 側に bg 確定・割り当て・コントラストループを移す。import 方向は `palette-design → color-extract` の一方向を保つ。

### 2026-05-19 Opus 4.7 (review-record)

- **領域**: arch
- **指摘**: 現 spec の公開 API `Colors` は salience 由来 16 色 + bg/fg/cursor を 1 つに畳んだ最終形だが、3 系統並行を入れると「3 系統の中間ヒストグラム or 重心配列」と「役割割り当て後の最終 16 色」の 2 段階の境界が必要になる。どちらを feature の公開 API とするかで上流の palette-design の書き方が大きく変わる。
- **対応**: 採用 (中間データ公開方式)
- **メモ**: `color-extract` の公開型を最終 16 色ではなく中間データに切り替える。具体形は次のとおり。

  ```typescript
  type ExtractedPalette = {
      kmeans:   { dominantSortedByLightness: OKLch[] };  // bg/fg 候補プール
      ansi:     { hueBuckets: Record<HueName, OKLch> };  // syntax 6 + 黒灰
      salience: { topAccents: OKLch[]; background: OKLch }; // 推し色 + bg 候補
  };
  ```

  `palette-design` 側は `ExtractedPalette` を入力に `FinalPalette` (wallust の `Colors` 相当) を組み立てる。これにより color-extract が Neovim 割り当て知識を持たずに済み、palette-design が割り当てロジックの柔軟性を確保する。

### 2026-05-19 Opus 4.7 (review-record)

- **領域**: algo
- **指摘**: kmeans 支配色 (bg) と salience 上位 1〜2 色 (accent) は同じ画像から取るため、面積も顕著性も両立する色 (例: 白基調キャラの瞳の赤、暗背景の発光部) では bg と Cursor / Visual が同一 hue / 近接 OKLch 値になりうる。系統間の dedup や衝突解決ルールが issue 内で定義されていない。
- **対応**: 採用 (wallust `constrain_col_against_cols` を移植して 3 系統合成用に拡張)
- **メモ**: wallust の `src/histogram/salience.rs:419-490` の発想を借りる。同関数は「bg と他色の `sal_i` 距離が threshold 未満なら bg を `dec_sal_l` で 0.05 ずつ動かしてループ補正」する設計。oshicolor では bg を動かすのではなく、accent / syntax 側の候補を繰り上げで衝突回避する形に変える。

  ```
  1. bg = kmeans の支配色 (CAM16 に変換)
  2. accent 候補 = salience.topAccents を bg との sal_i 距離で降順ソート
  3. 上位から取って、既出 accent との sal_i 距離 < THRESHOLD_ACCENT なら次点に繰り上げ
  4. ansi の hue 6 色も bg / accent との sal_i 距離をチェックし、近接していたら hue バケットの第 2 候補を使う
  ```

  THRESHOLD_ACCENT は wallust の `C0_MIN_SAL_BG = 1.0` を出発点として oshicolor 用にチューニングする。

### 2026-05-19 Opus 4.7 (review-record)

- **領域**: algo
- **指摘**: WCAG 4.5:1 を全色一律で 10 回 lighten/darken ループするとき、salience 由来の推し色は OKLch の L 軸を強制的に動かされて colorfulness / hue とのバランスが崩れる。可読性のために色味を壊すと「推し色がテーマの主役として認識できる」という issue 039 が掲げる UX 優先順位 1 と矛盾する。
- **対応**: 採用 (役割別に閾値を分割)
- **メモ**: wallust の `check_contrast_all` (colors.rs:407) は既に `color1-6, 9-14` のみを対象にし `color0/7/8/15` を除外している。oshicolor は更に細分化する。

  | 役割 | 対象 | 閾値 |
  |---|---|---|
  | Syntax (ansi 由来) | `color1-6` 相当 | 4.5:1 厳格 |
  | Accent (salience 由来) | Cursor / Visual / Search / DiagnosticError 等 | 3:1 緩和 |
  | UI base (kmeans 由来) | bg / fg / Comment / line numbers 等 | 補正なし |

  accent を 3:1 に緩和する理由は、4.5:1 を強制すると hue を保つために lightness が大きく動き、推し色の印象が崩れるため。視認は 3:1 で可能で UX 優先順位 1 を守る。UI base を補正対象から外す件は議題として残るが、kmeans 由来の色は元々画像内で隣接して使われている関係なので、補正なしでも自然に読める想定で進める。

### 2026-05-19 Opus 4.7 (review-record)

- **領域**: design
- **指摘**: 完了条件の PoC は `wallust run -p kmeans/ansi/salience` のラッパーで作る一方、本実装は TypeScript への完全移植路線 (#035) なので、PoC の出力と TS 実装の出力を突き合わせる手段がないと「PoC で良かったから本実装も良い」が保証できない。さらに mini.hues との比較評価も指標が主観に依存しており、回帰テストに転用できない。
- **対応**: 採用 (golden fixture と数値指標で機械化)
- **メモ**: PoC を CLI ラッパー (Rust の wallust を spawn) で書き、出力を `tests/fixtures/color-extract/<image>.json` に保存して TS 実装の期待値とする。評価は次の 3 指標で数値化する。

  - **WCAG 達成率**: bg に対して 4.5:1 を満たす syntax 色 (`color1-6`) の割合
  - **推し色再現率**: 入力画像から CIEDE2000 で取った salience 上位 1 色と、生成パレットの最も近い色との距離
  - **構文区別性**: syntax 6 色間の最小 hue 角差 (60 度に近いほど良い)

  mini.hues や wallust 単独抽出との比較もこの 3 指標で行う。
