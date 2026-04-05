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

### ISSUE-1: light テーマで ensureContrast がパステル色のアイデンティティを破壊する

**深刻度:** 高
**発生キャラ:** Klee, Nahida, Faruzan, Hyacine, Aglaea, Yoimiya

light テーマでは白 bg に対して 4.5:1 を達成するために accent 色の L を大きく下げる必要がある。
明るいパステル色 (L > 0.7) は ΔL > 0.2 の変化を受け、元の色の印象が大幅に変わる。

```
例: Nahida secondary #f9fcf7 (L=0.98) → ensureContrast → #666e5f (L≈0.48)
    ΔL = 0.50 — 元のほぼ白色が暗い灰緑に変化
```

**原因:** ensureContrast は L のみを変化させる。大きな L 変化は chroma boost で軽減できる余地がある。

**対策案:**
- L 調整時に chroma を補償 (L が離れるほど C を増加させ、元の色味を維持)
- APCA (Accessible Perceptual Contrast Algorithm) の採用を検討
  - WCAG 2.x の luminance ratio はテキストサイズを考慮しない
  - APCA は太字・サイズに応じた柔軟な閾値を提供

**リサーチプロンプト:**

> WCAG contrast adjustment algorithms that preserve perceived color identity:
>
> I'm implementing a color palette generator for syntax highlighting. When a light pastel color (e.g., oklch(0.81, 0.06, 14)) needs to meet WCAG AA (4.5:1) against a white background, adjusting only Lightness darkens it so much that the color loses its distinctive character.
>
> I'm looking for research or algorithms that:
> 1. Jointly adjust L and C (chroma) to reach a target contrast ratio while minimizing perceptual change (ΔE in Oklab)
> 2. Use APCA (Accessible Perceptual Contrast Algorithm, Somers 2022) instead of WCAG 2.x luminance ratio — APCA is designed for text on backgrounds and may allow lighter foreground colors
> 3. Any published approach to "contrast-aware color correction" that minimizes ΔE_ok while satisfying a minimum contrast
>
> Keywords: APCA, WCAG 3.0, perceptual contrast, Oklab gamut mapping, color identity preservation, accessible color palettes

---

### ISSUE-2: fixDiscrimination が seed 色ペア (c1-c3) や seed-error (c2/c3-c8) を修正できない

**深刻度:** 中
**発生キャラ:** Luocha (c1↔c3), Guinaifen (c2↔c8, c3↔c8)

fixDiscrimination の adjustableIndices は c4〜c7 (gap-filled) のみ。
seed 色同士やseed-error の衝突は調整対象外。

**Luocha:** primary H=88°, tertiary H=94° — ΔH=6° だが両方 C > threshold なので stabilizeHue 未適用。
**Guinaifen:** secondary H=32°, error H=25° — 暖色 seed + 固定 error hue が近接。

**対策案:**
- seed 間 ΔH が小さい場合、tertiary の L/C を微調整して ΔE を確保
- error hue の回避ロジックに secondary/tertiary との距離も考慮

---

### ISSUE-3: seed 3色の色相が極度に集中すると gap-fill が構造的に破綻する

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

**リサーチプロンプト:**

> Maximizing perceptual discriminability in low-hue-diversity palettes:
>
> I'm generating 8-color syntax highlighting palettes from 3 AI-suggested character colors. When all 3 source colors have nearly identical hues (e.g., all around 90° in OKLCH), gap-filling spreads hues evenly, but the derived colors end up with very similar L and C values, making them hard to distinguish (ΔE_ok < 0.08 for many pairs).
>
> Currently I use "Luminance Jittering" (O'Donovan 2011) with fixed L offsets [0.68, 0.76, 0.72, 0.80] for dark themes. But when hue diversity is already low, I need MORE L/C variation.
>
> Questions:
> 1. Are there adaptive jittering strategies where the amplitude of L/C variation increases as hue diversity decreases?
> 2. Would a Chroma Jitter (varying C per slot) be effective in addition to L Jitter? Any perceptual risks?
> 3. How does Colorgorical (Gramazio 2017) handle palettes where the user constrains hue range to a narrow band?
>
> Keywords: palette discriminability, low hue diversity, adaptive luminance jitter, chroma jitter, Colorgorical, Oklab

---

### ISSUE-4: light テーマの L_JITTER 帯が狭く弁別性が低い

**深刻度:** 中
**発生キャラ:** 全 light テーマキャラ (特に Aglaea, Nahida, Faruzan)

light テーマの L_JITTER = [0.38, 0.42, 0.46, 0.50] — range = 0.12。
dark テーマの L_JITTER = [0.68, 0.72, 0.76, 0.80] — range = 0.12。

range は同じだが、light テーマでは白 bg (L≈0.93) に対して contrast 4.5:1 を満たすために
全色が L < 0.55 に制約される。ensureContrast 後に L が収束しやすい。

**対策案:**
- light テーマの L_JITTER range を拡大: [0.30, 0.52, 0.38, 0.46] (range=0.22)
- ただし L が低すぎると暗すぎて読みにくい → 下限 0.25 程度

---

## 未実装機能

### TODO-3: src/features/ への本実装

**優先度:** 中（24 キャラ検証後）

現在の全ロジックは `scripts/test-palette-v01.ts` にフラットに実装されている。
リアーキテクチャ済みのセクション構造 (§1-§8) に沿って分割する:

```
src/features/palette-generator/usecases/
├── config.ts          (§1 CONFIG)
├── types.ts           (§2 Types)
├── color-utils.ts     (§3 Color utilities + contrast)
├── stabilize-hue.ts   (§4.1)
├── hue-gap.ts         (§4.2-§4.3 computeGaps, fillGaps, enforceMinHueGap)
├── accent-palette.ts  (§4.4-§4.5 L assignment, error hue)
├── neutral-palette.ts (§4.6-§4.7 clampNeutral, deriveNeutralPalette)
├── variants.ts        (§4.8)
├── discrimination.ts  (§4.9 check + fix)
├── ui-colors.ts       (§4.11 assignUiRoles, deriveUiColors)
└── generate-palette.ts (§5 pipeline orchestrator)
```

---

### TODO-4: ユニットテスト

**優先度:** 中（本実装と同時）

spec.md §11 に定義されたテスト観点に従い、各関数のユニットテストを作成する。
24 キャラ検証で発見した edge case を含める:
- stabilizeHue: 動的閾値の境界値 (L=0.3, L=0.85)
- computeGaps + mergeCloseHues: 重複 hue (全同値、5° 以内)
- ensureContrast: dark/light 両方向
- resolveErrorHue: 赤系 hue primary (hue 0°-55°)

---

### TODO-5: Valibot スキーマ定義

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
| ISSUE-3 seed 集中 | テーマの palette はデザイナーが多様な色を選定済み。borrowed 色で補完できる可能性 |
| ISSUE-1 パステル破壊 | テーマが元々コントラスト保証済みの色を持つため、L 大変動を回避 |
| ISSUE-2 seed-error 衝突 | テーマの palette[1] (red) を error に使えば自然な赤が得られる |

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
| lJitter.light | [0.42, 0.50, 0.46, 0.38] | gap-filled の L 分散 | ISSUE-4 で拡大検討 |
| achromaticCBase | 0.015 | 低彩度判定閾値 (中間 L) | JND ベース |
| minHueGap | 30 | 最小色相距離 (°) | Cohen-Or ベース |
| minDeltaE | 0.08 | 弁別性閾値 | Gramazio ベース |
| mergeThreshold | 5 | 近接 hue マージ閾値 (°) | 暫定 |
| neutral fgLevels (light) | comment: 0.55, lineNr: 0.60 | neutral fg の固定 L | 暫定 |
