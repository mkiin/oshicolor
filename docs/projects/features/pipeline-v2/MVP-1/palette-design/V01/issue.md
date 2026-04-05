# V01 palette-design 未解決 Issue

## 修正済み

### ~~BUG-1: error 色 (c8) が primary と重複する~~ ✅

`resolveErrorHue()` を追加。赤系範囲 (0°〜55°) 内で primary から最も離れた hue を自動選択。

### ~~BUG-2: 低彩度 tertiary が stabilizeHue をすり抜ける~~ ✅

`achromaticThreshold(l)` で L に応じた動的閾値に変更。Acheron (L=0.24) と Albedo (L=0.93) を修正。

### ~~WARN-1: gap-filled 色間の弁別性不足~~ ✅ (部分的)

L Jitter zigzag + enforceMinHueGap バネモデル + fixDiscrimination 自動修正。
4キャラ→26キャラへの拡大で多くのケースが改善したが、構造的限界が発覚 → ISSUE-3, ISSUE-4 参照。

### ~~BUG-3: ensureContrast が dark 方向のみ~~ ✅

bg の L で探索方向を自動判定 (dark: L↑, light: L↓) に修正。

### ~~BUG-4: NEUTRAL_LIMITS が dark 固定~~ ✅

theme_tone 自動検出 (`detectThemeTone`) と dark/light 両対応の CONFIG に統一。

### ~~BUG-5: computeGaps が重複 hue で 360° ギャップを複製~~ ✅

`mergeCloseHues()` (5° 以内をマージ) を gap 計算前に追加。
Clorinde (279°, 277°) や DrRatio (277°, 277°) の gap-fill 分散が改善。

### ~~TODO-1: 弁別性警告の自動修正~~ ✅

`fixDiscrimination()` として実装。

### ~~TODO-2: 24 キャラの SVG 検証~~ ✅

26 キャラ (原神 13 + スタレ 13) で検証完了。結果は下記。

---

## 24 キャラ検証結果サマリ (26 キャラ)

### 全クリア (18/26)

Albedo, Amber, Yanfei, Navia, Baizhu, Furina, Clorinde, Chevreuse,
Acheron, Argenti, Lingsha, Huohuo, Anaxa, Gepard, DrRatio, BlackSwan,
Yoimiya, Klee (Klee は c2↔c3 ΔE=0.071 が残るが borderline)

### Discrimination 警告あり (8/26)

| キャラ | tone | 警告数 | 最悪ペア | ΔE | 原因カテゴリ |
|---|---|---|---|---|---|
| Klee | light | 1 | c2↔c3 | 0.071 | seed 色が ensureContrast で収束 |
| Nahida | light | 2 | c2↔c3, c5↔c7 | 0.076 | 同上 + gap-filled 近接 |
| Faruzan | light | 2 | c1↔c2, c6↔c7 | 0.067 | seed 色が近接 + gap-filled 近接 |
| RaidenShogun | dark | 1 | c3↔c7 | 0.070 | gap-filled と seed が近接 |
| Hyacine | light | 1 | c4↔c6 | 0.067 | gap-filled 近接 |
| Guinaifen | dark | 2 | c2↔c8, c3↔c8 | 0.063 | seed/error が暖色に集中 |
| Luocha | dark | 2 | c1↔c3, c6↔c8 | 0.056 | primary≈tertiary (ΔH=6°) |
| Aglaea | light | 7 | c5↔c6 | 0.045 | seed 3色が全て hue≈90° |
| Kafka | dark | 4 | c4↔c7 | 0.042 | seed 3色が全て hue≈2° |

---

## 既知の課題

### ISSUE-1: bg/fg を AI 生成に依存せず自力で導出する

**深刻度:** 高
**影響範囲:** 全キャラ

現状 AI に `neutral.bg_base_hex` / `fg_base_hex` を出力させているが、どのキャラも似通った色になりキャラらしさが出ない。
impression 3色から bg/fg を自力で導出し、キャラの個性を反映させる方向へシフトする。

**対策案:**
- impression の dominant hue で bg を tint する（現状の clampNeutral に近いが、AI 出力に頼らない）
- fg も dominant hue から導出し、キャラごとの微妙な色味の違いを出す
- AI の VisionResultSchema から `neutral` フィールドを将来的に削除または optional 化

---

### ISSUE-2: UI クローム色（navigation 等）でカラースキームの個性を出す

**深刻度:** 高
**影響範囲:** 全キャラ

既存 Neovim カラースキームを観察した結果、`Normal` (エディタ bg) はどのスキームも似た色だが、
**UI クローム要素の色がスキームの個性を決めている**ことがわかった。
ここをしっかり詰め、キャラらしさを表現する。

**対象となる Neovim ハイライトグループ:**

| カテゴリ | グループ | 用途 |
|---|---|---|
| StatusLine | `StatusLine`, `StatusLineNC` | ステータスバー (アクティブ / 非アクティブ) |
| WinBar | `WinBar`, `WinBarNC` | ウィンドウ上部バー |
| TabLine | `TabLine`, `TabLineSel`, `TabLineFill` | タブ (非アクティブ / アクティブ / 余白) |
| File Tree | `NeoTreeNormal`, `NeoTreeWinSeparator` | NeoTree の bg/fg・境界線 |
| Terminal | `TermNormal`, `terminal_color_0`〜`terminal_color_15` | 組み込みターミナルの bg/fg・ANSI 16色 |
| Float | `NormalFloat`, `FloatBorder`, `FloatTitle` | フローティングウィンドウ |
| Window | `WinSeparator` | ウィンドウ間の区切り線 |
| Pmenu | `Pmenu`, `PmenuSel`, `PmenuSbar`, `PmenuThumb` | 補完メニュー |

**現状の問題:**
- `UiColors` は `navigation`, `attention`, `frame`, `search_bg`, `pmenu_sel_bg` の 5 色のみ
- 上記のハイライトグループを十分にカバーできていない
- 特に StatusLine / TabLine / File Tree / Terminal bg は個性の源泉なのに、色の割り当てが不十分

**対策案:**
- UI クローム色の生成ロジックを拡張し、上記グループをカバーする
- primary の色相をベースに、L/C を変えた派生色を生成する
- ISSUE-1 の bg/fg 自力導出と連携して設計する

---

### ISSUE-3: コントラスト保証を APCA ベースへ移行する

**深刻度:** 高
**影響範囲:** 全キャラ（特に dark テーマ）

現状の `ensureContrast` は WCAG 2.x の相対輝度比 (L1 + 0.05) / (L2 + 0.05) を使用しているが、
この計算式にはダークテーマに対する構造的な欠陥がある。

**背景: ダークとライトで人間の見え方が根本的に異なる**

- **Positive Polarity (ライトテーマ):** 瞳孔が収縮 → 焦点深度が深い → 文字がくっきり見える
- **Negative Polarity (ダークテーマ):** 瞳孔が開く → レンズ歪み（乱視）の影響 → 明るい文字の光が暗い背景に漏れ出す **ハレーション現象**
- Piepenbrock et al. (2013): 世界人口の約 50% が何らかの乱視を持つ

**WCAG 2.x の限界:**
- 「純黒 bg にダークグレー文字」と「純白 bg にライトグレー文字」で同じ数値を返す — 知覚と乖離
- テキストサイズ・太さを考慮しない
- ダークテーマでコントラストを高くしすぎると、ハレーション（にじみ）で逆に読みにくくなる問題を検出できない

**APCA (Accessible Perceptual Contrast Algorithm) の利点:**
- Andrew Somers (W3C Silver Task Force) が策定、WCAG 3.0 の中核として採用予定
- 背景/前景の明暗関係（Polarity）によって異なる計算係数を使用
  - ライト: 暗い文字が「背景の光をブロックする」モデル
  - ダーク: 明るい文字が「自ら発光し散乱する」モデル
- フォントの太さ (Font Weight) も計算式に組み込み
- ダークテーマでの「最大コントラスト制限」（ハレーション防止）を数学的に表現

**実装方針:**
- `sample-repo/color.js` の `src/contrast/` を解析し、APCA 実装を理解する
- 現状の WCAG ベース `ensureContrast` を APCA ベースに置き換え
- ダークテーマ: 最低コントラスト保証 + **最大コントラスト制限** (fg の L 上限 ≈ 0.85)
- ライトテーマ: APCA で知覚的に正確なコントラスト保証
- Lea Verou 推奨の「2段階アプローチ」: APCA で可読性確保 → WCAG 2.1 で法務コンプライアンスチェック

**参考文献:**
- Piepenbrock et al. (2013) "Positive display polarity is advantageous for both younger and older adults"
- Andrew Somers — APCA specification (W3C Visual Contrast Task Force)
- Lea Verou — Color.js (W3C CSS Color 4/5 共同エディター)
- `sample-repo/color.js/src/contrast/` — APCA 実装の参照コード

---

### ISSUE-4: light テーマ固有の課題

**深刻度:** 高
**発生キャラ:** Klee, Nahida, Faruzan, Hyacine, Aglaea, Yoimiya

light テーマには ISSUE-3 (APCA) とは独立した以下の問題がある。

#### 4a: ensureContrast がパステル色のアイデンティティを破壊する

light テーマでは白 bg に対して 4.5:1 を達成するために accent 色の L を大きく下げる必要がある。
明るいパステル色 (L > 0.7) は ΔL > 0.2 の変化を受け、元の色の印象が大幅に変わる。

```
例: Nahida secondary #f9fcf7 (L=0.98) → ensureContrast → #666e5f (L≈0.48)
    ΔL = 0.50 — 元のほぼ白色が暗い灰緑に変化
```

対策: L 調整時に chroma を補償 (L が離れるほど C を増加させ、元の色味を維持)

#### 4b: L_JITTER 帯が狭く弁別性が低い

light テーマの L_JITTER = [0.38, 0.42, 0.46, 0.50] — range = 0.12。
白 bg (L≈0.93) に対して contrast 4.5:1 を満たすために全色が L < 0.55 に制約され、
ensureContrast 後に L が収束しやすい。

対策: L_JITTER range を拡大 [0.30, 0.52, 0.38, 0.46] (range=0.22)、下限 0.25 程度

#### 4c: light テーマ判定の精度

light テーマになってほしいキャラ（淡い色合いのキャラ）が dark 判定されるケースがある。
現状プロンプトベースでしか制御できないため、VisionResultSchema の `theme_tone` description を調整して対応する。

---

### ISSUE-5: fixDiscrimination が seed 色ペア (c1-c3) や seed-error (c2/c3-c8) を修正できない

**深刻度:** 中
**発生キャラ:** Luocha (c1↔c3), Guinaifen (c2↔c8, c3↔c8)

fixDiscrimination の adjustableIndices は c4〜c7 (gap-filled) のみ。
seed 色同士や seed-error の衝突は調整対象外。

**Luocha:** primary H=88°, tertiary H=94° — ΔH=6° だが両方 C > threshold なので stabilizeHue 未適用。
**Guinaifen:** secondary H=32°, error H=25° — 暖色 seed + 固定 error hue が近接。

**対策案:**
- seed 間 ΔH が小さい場合、tertiary の L/C を微調整して ΔE を確保
- error hue の回避ロジックに secondary/tertiary との距離も考慮

---

### ISSUE-6: seed 3色の色相が極度に集中すると gap-fill が構造的に破綻する

**深刻度:** 高
**発生キャラ:** Aglaea (hue≈90° x3, 警告 7件), Kafka (hue≈2° x3, 警告 4件)

AI が「キャラの印象色は全て同系色」と判断した場合、3 seed が色相環の 1 点に集中する。
mergeCloseHues で実質 1 seed になり、gap-fill は 360° を 4 等分するが:
- gap-filled 色の L/C が均一 (cTarget × 0.9 + L_JITTER 範囲 0.38-0.50)
- 色相は散るが、暗い light テーマの L 帯では Oklab 距離が稼げない

```
Aglaea (light): L_JITTER = [0.38, 0.42, 0.46, 0.50] → ΔL_max = 0.12
  hue は 90° 間隔に散るが、L/C が似ているため ΔE が 0.04〜0.06 に留まる
```

**対策案:**
- seed 集中度 (3 seed の hue 標準偏差) に応じて L_JITTER の振幅を拡大する
- 例: hue σ < 20° なら L_JITTER を ±0.06 に拡張 → [0.32, 0.56, 0.38, 0.50]
- C にも Jitter を入れる (現在は cTarget 固定)

---

### ISSUE-7: config.ts が複雑で難解

**深刻度:** 中
**影響範囲:** 開発体験

`CONFIG` オブジェクトに色科学の定数・テーマ別パラメータ・UI パラメータ・弁別性パラメータが
フラットに詰まっており、「何のためのパラメータか」がコードを読んだだけではわからない。
良くないものが難解であること自体が問題。

**対策案:**
- パラメータの意図・根拠ごとにグルーピングを見直す
- ISSUE-3 (APCA 移行) や ISSUE-1 (bg/fg 自力導出) でパラメータ構造が変わるため、それらの後にリファクタする

---

### ISSUE-8: UI 表示の改善

**深刻度:** 低
**影響範囲:** フロントエンド

- AI が出力した impression 3色（primary / secondary / tertiary）の表示 UI がない
- 各 Swatch に書かれている文字が小さい

---

## 未実装機能

### TODO-3: ユニットテスト

**優先度:** 中

spec.md §11 に定義されたテスト観点に従い、各関数のユニットテストを作成する。
26 キャラ検証で発見した edge case を含める:
- stabilizeHue: 動的閾値の境界値 (L=0.3, L=0.85)
- computeGaps + mergeCloseHues: 重複 hue (全同値、5° 以内)
- ensureContrast: dark/light 両方向
- resolveErrorHue: 赤系 hue primary (hue 0°-55°)

---

### TODO-4: Valibot スキーマ定義

**優先度:** 低（本実装時に作成）

spec.md §9 に定義された VisionResultSchema / PaletteResultSchema を実装する。

---

## 今後の展望: V02 (既存カラースキーマ活用) との統合

V01 の gap-fill は色相を均等に散らすが、「この色の隣にはこういう色が合う」という
配色の知識を持たない。V02 の既存カラースキーマ (ghostty 437 テーマ) を活用する
アプローチは、人間のデザイナーの配色知識を借りることで色の調和を改善できる可能性がある。

### V01 → V02 統合の方針

V02 を V01 の「置き換え」ではなく、**V01 の後段補正** として組み込む:

```
V01 パイプライン (現在)
  AI 3色 → stabilizeHue → gap-fill → L Jittering → ensureContrast → 出力

V01+V02 統合パイプライン (将来)
  AI 3色 → stabilizeHue → gap-fill → L Jittering → ensureContrast
    │
    ├─ V01 パレット完成
    │
    ├─ findNearestTheme() で最近傍テーマを検索 (V02 spec §3)
    │    └─ V01 の gap-filled 色 vs テーマの palette を比較
    │
    ├─ adjustBorrowed() でテーマの色を V01 統計に合わせて微調整 (V02 spec §5)
    │    └─ L/C の相対関係を保持したまま AI 統計にシフト
    │
    └─ 品質スコア比較:
         V01 の弁別性スコア vs V02 のテーマ調和スコア
         → 良い方を採用、またはユーザー選択制
```

### 統合で解決が期待される V01 Issue

| Issue | V02 統合での解決 |
|---|---|
| ISSUE-6 seed 集中 | テーマの palette はデザイナーが多様な色を選定済み。borrowed 色で補完できる可能性 |
| ISSUE-4a パステル破壊 | テーマが元々コントラスト保証済みの色を持つため、L 大変動を回避 |
| ISSUE-5 seed-error 衝突 | テーマの palette[1] (red) を error に使えば自然な赤が得られる |

### 統合の前提条件

- V01 の 24 キャラ検証が完了し、基本パイプラインが安定していること ← **完了**
- V02 テスト (find-nearest-themes.ts) で品質改善が確認できること
- 437 テーマの Oklab プリコンパイルデータが生成済みであること (V02 spec §2)

詳細は [V02 plan.md](../V02/plan.md) と [V02 spec.md](../V02/spec.md) を参照。

---

## 定数の暫定値

以下の定数は追加検証後に調整する可能性がある:

| 定数 | 現在値 | 用途 | 備考 |
|---|---|---|---|
| frameChromaScale | 0.5 | frame 色の彩度スケール | 暫定 |
| frameL | dark: 0.35, light: 0.65 | frame 色の L | 暫定 |
| searchBgL | dark: 0.30, light: 0.85 | search_bg の L | 暫定 |
| lJitter.dark | [0.68, 0.76, 0.72, 0.80] | gap-filled の L 分散 | O'Donovan ベース |
| lJitter.light | [0.42, 0.50, 0.46, 0.38] | gap-filled の L 分散 | ISSUE-4b で拡大検討 |
| achromaticCBase | 0.015 | 低彩度判定閾値 (中間 L) | JND ベース |
| minHueGap | 30 | 最小色相距離 (°) | Cohen-Or ベース |
| minDeltaE | 0.08 | 弁別性閾値 | Gramazio ベース |
| mergeThreshold | 5 | 近接 hue マージ閾値 (°) | 暫定 |
| neutral fgLevels (light) | comment: 0.55, lineNr: 0.60 | neutral fg の固定 L | 暫定 |
