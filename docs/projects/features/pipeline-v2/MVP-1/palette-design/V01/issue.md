# V01 palette-design 未解決 Issue

## 既知のバグ・品質問題

### ~~BUG-1: error 色 (c8) が primary と重複する~~ ✅ 修正済

**修正:** `resolveErrorHue()` を追加。primary hue と ERROR_HUE (25°) の距離が 30° 未満の場合、
赤系範囲 (0°〜55°) 内で primary から最も離れた hue を自動選択する。
Hyacine: c8 hue 25° → 55° に移動、ΔE 0.014 → 0.08+ に改善。

---

### ~~BUG-2: Acheron の tertiary が stabilizeHue の閾値を超える~~ ✅ 修正済

**修正:** `achromaticThreshold(l)` を導入し、L に応じた動的閾値に変更。
- L < 0.3: 0.035 (暗い色は彩度知覚が低い)
- L > 0.85: 0.025 (明るい色も同様)
- 中間: 0.015 (JND ベース)
- 比較演算子を `<` → `<=` に修正 (境界値を無彩色側に倒す)
- Acheron (L=0.24, C=0.026) と Albedo (L=0.93, C=0.015) の両方を修正。

---

### ~~WARN-1: gap-filled 色間の弁別性不足 (ΔE < 0.08)~~ ✅ 修正済

**修正:** 3つの改善で全4キャラの全ペアが ΔE ≥ 0.08 を達成:
1. **L Jitter zigzag 割り当て:** 色相順にソートし、L を交互配置して隣接 hue の ΔL を最大化
2. **enforceMinHueGap バネモデル化:** 力蓄積→一括更新で振動を防止し、安定した色相分散を実現
3. **fixDiscrimination 自動修正:** ΔE < 0.08 のペアを検出し、gap-filled 色の L を ±0.03 双方向に試行して最適方向を採用

---

## 未実装機能

### ~~TODO-1: 弁別性警告の自動修正~~ ✅ 実装済

`fixDiscrimination()` として実装。WARN-1 の修正に含まれる。

---

### TODO-2: 24 キャラの SVG 検証

**優先度:** 高

spec.md §10 に定義された 24 キャラ (原神 12 + スタレ 12) でテストする。
現在は 4 キャラのみ (Albedo, Amber, Acheron, Hyacine)。
残り 20 キャラ分の AI 入力データ取得と SVG 出力が必要。

---

### TODO-3: src/features/ への本実装

**優先度:** 中（24 キャラ検証後）

現在の全ロジックは `scripts/test-palette-v01.ts` にフラットに実装されている。
spec.md の配置先ファイル構成に従って分割する:

```
src/features/palette-generator/usecases/
├── stabilize-hue.ts
├── hue-gap.ts
├── accent-palette.ts
├── neutral-palette.ts
├── ui-colors.ts
├── contrast.ts
├── discrimination.ts
├── oklab-utils.ts
└── oklch-utils.ts
```

---

### TODO-4: ユニットテスト

**優先度:** 中（本実装と同時）

spec.md §11 に定義されたテスト観点に従い、各関数のユニットテストを作成する。
対象: stabilizeHue, computeGaps, fillGaps, enforceMinHueGap, computeTargetLC,
clampNeutral, ensureContrast, gamutClamp, generateVariants, assignUiRoles,
oklabDist, checkDiscrimination

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
| WARN-1 弁別性不足 | テーマの palette はデザイナーが弁別性を検証済み。borrowed 色で置き換えると解消する可能性 |
| BUG-1 error 重複 | テーマの palette[1] (red) を error に使えば、セマンティクスに適合した赤が得られる |
| 定数の暫定値 | テーマの統計から frame/search の L/C 値を自動導出できる可能性 |

### 統合の前提条件

- V01 の 24 キャラ検証が完了し、基本パイプラインが安定していること
- V02 テスト (find-nearest-themes.ts) で品質改善が確認できること
- 437 テーマの Oklab プリコンパイルデータが生成済みであること (V02 spec §2)

### V02 の理論的根拠 (再掲)

- **Harmony Preservation**: 既に調和しているテーマの色を、知覚的に近い色で上書きすれば調和は保存される
- Cohen-Or et al. (SIGGRAPH 2006) — 色相テンプレートによる調和判定
- O'Donovan et al. (SIGGRAPH 2011) — ML による調和予測
- Oklab ユークリッド距離で知覚的類似度を測定 (V02 spec §1)
- 120 通りの自由スロットマッチングで最適配置を保証 (V02 spec §3)

### 検討が必要な設計判断

1. **V01 only / V02 only / ハイブリッド** — どの戦略を採用するか
2. **ユーザー選択制** — V01/V02 両方の結果をプレビューして選ばせるか
3. **自動判定** — 弁別性スコアや調和スコアで自動的に良い方を選ぶか
4. **V02 の borrowed 色が AI 3 色と調和しないケース** — フォールバック戦略

詳細は [V02 plan.md](../V02/plan.md) と [V02 spec.md](../V02/spec.md) を参照。

---

## 定数の暫定値

以下の定数は 24 キャラ検証後に調整する可能性がある:

| 定数 | 現在値 | 用途 | 備考 |
|---|---|---|---|
| FRAME_CHROMA_SCALE | 0.5 | frame 色の彩度スケール | 暫定 |
| FRAME_L_DARK | 0.35 | frame 色の L (dark) | 暫定 |
| FRAME_L_LIGHT | 0.65 | frame 色の L (light) | 暫定 |
| SEARCH_BG_L_DARK | 0.30 | search_bg の L (dark) | 暫定 |
| SEARCH_BG_L_LIGHT | 0.85 | search_bg の L (light) | 暫定 |
| L_JITTER_DARK | [0.68, 0.76, 0.72, 0.80] | gap-filled の L 分散 | O'Donovan ベース |
| L_JITTER_LIGHT | [0.42, 0.50, 0.46, 0.38] | gap-filled の L 分散 | O'Donovan ベース |
| ACHROMATIC_C_THRESHOLD | 0.015 | 低彩度判定閾値 | JND ベース、BUG-2 で要検討 |
| MIN_HUE_GAP | 30 | 最小色相距離 (°) | Cohen-Or ベース |
| MIN_DELTA_E | 0.08 | 弁別性閾値 | Gramazio ベース |
