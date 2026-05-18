---
title: kmeans 世界観 / ansi 構文 / salience 推し色の 3 系統割り当てと WCAG コントラストループ
labels: [idea, feature]
feature: color-extract
created: 2026-05-19
branch:
---

# kmeans 世界観 / ansi 構文 / salience 推し色の 3 系統割り当てと WCAG コントラストループ

## 何をやるか

同じ画像から `kmeans` `ansi` `salience` の 3 系統で並行に色抽出して中間データを作り、その後段で Neovim カラースキームの各グループに役割ごとに別系統の色を割り当てる。最終段で WCAG 21 コントラストループを役割別の閾値でかけて可読性を担保する。

役割と系統の対応は次のとおり。

| 役割 | 割り当てる色 | 由来 |
|---|---|---|
| 背景・前景・UI ベース (`bg`, `fg`, statusline base, bufferline, line numbers, NormalNC, FloatBorder, Comment ほか) | 世界観色 | `kmeans` の支配色 (面積比 + Lab lightness ソート) |
| 構文・セマンティック (`Keyword`, `Function`, `String`, `Type`, `Constant`, LSP semantic tokens ほか) | hue 6 色 + 黒灰 | `ansi` の hue 6 バケット (画像由来色 + 既定値の信頼率 0.5 合成) |
| 推し色アクセント (`Cursor`, `Visual`, `Search`, `IncSearch`, statusline active, `DiagnosticError` ほか) | 顕著色 | `salience` の上位 1〜2 色 |

## なぜやるか

### 単一抽出のトレードオフ

wallust v4 の 3 つの Palette は、画像種別によらず単一で使うと次のトレードオフから逃げられない。Dorothy, Cinderella 2, Red Hood, Scarlet, Snow_White, Alice の検証で確認した。

- `kmeans` は面積比で代表色を取るため白基調の画像で世界観を素直に出せるが、「瞳の赤」のような面積の小さい特徴色を dedup で潰す
- `salience` は CAM16 顕著性で「目立つ色」を拾えるが、大面積の支配色 (白〜銀のグラデ) を単色化して世界観のニュアンスが失われる。Alice では histogram に 6 色未満しか残らず panic (`salience.rs:124`) する
- `ansi` は hue 6 バケットに必ず色を割り当てるので構文区別は強いが、画像にない色を合成するため単独では推し色感が薄れる

3 系統を役割で使い分ければ、それぞれの長所が活きて短所を相殺できる。

### 複雑なルールベースより mini.hues 流の単純化

当初は「画像の colorfulness 分散で抽出方法を切り替える」「hue 分散が閾値未満なら ansi にフォールバック」のような画像特性ベースの分岐ルールを考えていたが、判定閾値のチューニングと回帰防止のコストが高い。

代わりに既存の Neovim カラースキームジェネレータ `mini.hues` の設計を参考にする。mini.hues は accent 1 色だけ入力としてもらい、残り 7 色を 60 度ずつの hue 回転で機械的に補完する設計で、これで実用的なテーマを大量生成できている。wallust の ansi は「画像から各 hue バケットの平均色を信頼率 0.5 で既定値と合成する」ため、mini.hues よりも画像由来度が高い (1 色分対 6 色分)。

つまり「画像特性で抽出方法を切り替える」よりも「**抽出方法は固定し、役割ごとに別系統の色を当てる**」方が実装が単純で、mini.hues という前例が実用性を保証している。

### 系統間の衝突を能動的に解決する必要

3 系統並行抽出だけでは、kmeans の支配色 (bg) と salience の上位色 (accent) が同じ hue / 近接 OKLch 値になる場合がある (白基調キャラの瞳の赤、暗背景の発光部など)。issue 上で dedup / 衝突解決ルールを定義しないと、Cursor が bg に埋没するなどの破綻を起こす。

wallust 自身の `src/histogram/salience.rs:419-490` の `constrain_col_against_cols` がこの種の問題に対する参考実装になる。同関数は「bg と他色の `sal_i` (improved salience) 距離が threshold 未満なら bg の lightness を `dec_sal_l` で 0.05 ずつ動かしてループ補正」する。oshicolor では bg を動かす代わりに、accent / syntax 候補を繰り上げで衝突回避する。

```
1. bg = kmeans の支配色 (CAM16 に変換)
2. accent 候補 = salience.topAccents を bg との sal_i 距離で降順ソート
3. 上位から取って、既出 accent との sal_i 距離 < THRESHOLD_ACCENT なら次点に繰り上げ
4. ansi の hue 6 色も bg / accent との sal_i 距離をチェックし、近接していたら hue バケットの第 2 候補を使う
```

`THRESHOLD_ACCENT` は wallust の `C0_MIN_SAL_BG = 1.0` を出発点として oshicolor 用にチューニングする。

### WCAG コントラストループは bg 基準を確定させ、役割別の閾値で走らせる

`check_contrast` は前景と背景のコントラスト比を 10 回まで lighten/darken でループ補正する後処理だが、比較対象となる `bg` が確定していないと走らせられない。3 系統並行抽出では「kmeans の支配色を bg とする」フェーズを抽出パイプラインの最初に据える。

`bg` の選び方は次の 2 段階で決める。

1. 画像の平均輝度から `style` を `dark` (低輝度) か `light` (高輝度) かに判定する
2. `style = light` なら kmeans 重心のうち lightness 最大、`dark` なら lightness 最小を `bg` とする

コントラスト補正は役割別に閾値を分ける。wallust の `check_contrast_all` は `color1-6, 9-14` のみを対象にしているが、oshicolor は更に細分化する。

| 役割 | 対象 | 閾値 |
|---|---|---|
| Syntax (ansi 由来) | `color1-6` 相当 | 4.5:1 厳格 |
| Accent (salience 由来) | Cursor / Visual / Search / DiagnosticError 等 | 3:1 緩和 |
| UI base (kmeans 由来) | bg / fg / Comment / line numbers 等 | 補正なし |

accent を 3:1 に緩和する理由は、4.5:1 を強制すると hue を保つために lightness が大きく動いて推し色の印象が崩れるため。視認は 3:1 で可能で「推し色がテーマの主役として認識できる」という UX 優先順位を守る。

### Neovim ユーザーが期待する体験との整合

oshicolor の本質的なゴールは「推し画像から推しテーマを生成する」だが、UX の優先順位を分解すると次のようになる。

1. 推し色 (1〜2 色) がテーマの主役として認識できる
2. Neovim が読める (構文区別が破綻しない、コントラストが取れている)
3. 16 色すべてが画像由来であること (※必須ではない)

3 の優先度が想定より低い。1 は salience が、2 は ansi + check_contrast が、3 は kmeans が担当する形で 1 と 2 を確実に満たせる。

## 完了条件

- [ ] PoC として 3 系統並行抽出のスクリプトを書く (`wallust run -p kmeans` `-p ansi` `-p salience` を同じ画像に対して並行実行する CLI ラッパー)
- [ ] PoC の出力を `tests/fixtures/color-extract/<image>.json` に golden fixture として保存する
- [ ] `bg` 確定ロジック (画像平均輝度判定 + style 切替 + kmeans 重心からの選択) を実装する
- [ ] 系統間の衝突解決ロジック (accent / syntax の繰り上げ) を実装する
- [ ] 3 系統 + bg を入力として、Neovim ハイライトグループへの割り当てを行う変換層を書く
- [ ] WCAG コントラストループを役割別閾値 (syntax 4.5:1, accent 3:1, UI base 補正なし) で実装する
- [ ] 5〜10 枚のキャラ画像で生成し、次の 3 指標で `mini.hues` ベースのテーマと比較評価する
  - WCAG 達成率: bg に対して 4.5:1 を満たす syntax 色の割合
  - 推し色再現率: 入力画像 salience 上位 1 色との CIEDE2000 距離
  - 構文区別性: syntax 6 色間の最小 hue 角差 (60 度に近いほど良い)
- [ ] spec.md に役割割り当てマッピングと数値指標を書く

## 実装方針

<!-- 着手時に feature-design skill が埋める -->
<!-- idea 段階のため未着手 -->

### 設計アプローチ

idea 段階のため詳細は未確定。着手時の方向性は次のとおり。

- `color-extract` を「3 系統の抽出と中間データ提供」に責務を絞り、`ExtractedPalette` 型 (`kmeans.dominantSortedByLightness`, `ansi.hueBuckets`, `salience.topAccents`, `salience.background` を持つ) を公開 API とする
- `palette-design` 側で `ExtractedPalette` を入力に bg 確定・衝突解決・割り当て・コントラスト補正を行い、`FinalPalette` (wallust の `Colors` 相当) を出力する
- import 方向は `palette-design → color-extract` の一方向を保つ

### 触るファイル

該当なし (idea 段階)

### 構造・命名・責務分離

該当なし

### 使用ライブラリ

該当なし

### テスト戦略

該当なし

## 関連

- 参考: docs/references/wallust/overview.md (`oshicolor への展開` の段)
- 参考: docs/references/wallust/v4-changes.md (Palette enum の整理、Ansi モードの hue バケット仕様、Kmeans モード)
- 参考: wallust source `src/histogram/salience.rs:419-490` (`constrain_col_against_cols` の衝突解決ロジック)
- 参考: wallust source `src/colors.rs:407` (`check_contrast_all` の役割範囲)
- 参考: [mini.hues](https://github.com/echasnovski/mini.hues) (accent 1 色 + hue 60 度回転による Neovim テーマ生成の前例)
- レビュー: docs/features/color-extract/review.md (5 件、すべて 2026-05-19 採用)
- 依存: #035 color-extract salience pipeline
- 関連: 着手時に salience の `cols.len() < 6` での panic に対する fallback も検討する (Alice の検証で発覚)
