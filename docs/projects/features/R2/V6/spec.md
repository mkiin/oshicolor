# R2/V6 仕様

## 実装スコープ

V6 では `scripts/gen-palette-svg-sharp.ts`（デバッグ SVG 生成スクリプト）に対して、明度2分割 seed 選定ロジックを実装した。tonal palette 生成（Step 2〜4）は未実装。

## 全体フロー

```
画像 → colorthief getPalette (16色)
     → deriveColorAxes (R1: 3軸クラスタリング)
     → selectSeeds (各軸から bright/dark の2 seed を選定)
     → SVG 描画 (5 seeds 表示)
```

## Step 1: seed 選定（node-vibrant target 方式）

### target 定義

node-vibrant の Vibrant/DarkVibrant target を採用。色空間は HSL（colorthief の `color.hsl()` を使用）。

```
Vibrant target:     saturation = 0.74, luma = 0.45
DarkVibrant target: saturation = 0.74, luma = 0.26
```

### 距離関数

node-vibrant 準拠の重み付きユークリッド距離。

```
W_SATURATION = 3
W_LUMA       = 6.5

distance = sqrt(W_SATURATION * (s - target.s)^2 + W_LUMA * (l - target.l)^2)
```

入力の saturation, luma は HSL の s/100, l/100（0〜1 に正規化）。

### 選定ロジック

`selectSeeds(colors: Color[]): SeedPair`

1. 軸内の全色に対して Vibrant target / DarkVibrant target への距離をそれぞれ計算
2. 各 target で最小距離の色を選定
3. 以下の場合は dark seed を null とする:
   - 同一色が両方の target で選ばれた場合（Vibrant に割り当て）
   - DarkVibrant の距離が閾値（`DARK_DISTANCE_THRESHOLD = 0.5`）を超える場合

### フォールバック合成

dark seed が null かつ軸が accent でない場合、bright seed の HSL lightness を -20 して合成する。

```
fallbackHex = hslToHex(bright.h, bright.s, max(bright.l - 20, 5))
```

accent 軸は dark seed を持たない（plan.md の設計: accent は Vibrant target のみ）。

## seed 構成

| seed | 軸 | target | 用途（将来） |
| --- | --- | --- | --- |
| main-bright | main | Vibrant | 主要 syntax (Keyword, Function) |
| main-dark | main | DarkVibrant | UI アクセント (Search.bg, CursorLineNr) |
| sub-bright | sub | Vibrant | 副 syntax (String, Type) |
| sub-dark | sub | DarkVibrant | 控えめ UI (FloatBorder, StatusLine.fg) |
| accent | accent | Vibrant | アクセント syntax (Special, Constant) |

## SVG 表示

- seed セクションは最大 5 slots を横並び表示
- 各 seed にラベル（`{role}-B` / `{role}-D`）と距離値（`d=X.XX`）を表示
- フォールバック合成された seed は赤い破線ボーダー（`stroke="#ff6666" stroke-dasharray="4,2"`）で区別

## 主要な定数

| 定数 | 値 | 説明 |
| --- | --- | --- |
| `VIBRANT_TARGET.saturation` | 0.74 | node-vibrant Vibrant target |
| `VIBRANT_TARGET.luma` | 0.45 | node-vibrant Vibrant target |
| `DARK_VIBRANT_TARGET.saturation` | 0.74 | node-vibrant DarkVibrant target |
| `DARK_VIBRANT_TARGET.luma` | 0.26 | node-vibrant DarkVibrant target |
| `W_SATURATION` | 3 | 距離関数の saturation 重み |
| `W_LUMA` | 6.5 | 距離関数の luma 重み |
| `DARK_DISTANCE_THRESHOLD` | 0.5 | DarkVibrant フォールバック閾値 |

## 主要な型定義

```typescript
type SeedResult = { color: Color; distance: number };
type SeedPair = { bright: SeedResult; dark: SeedResult | null; isFallback: boolean };
type SeedInfo = ColorInfo & { distance: number; isFallback: boolean };
type AxisInfo = {
  role: string;
  colors: ColorInfo[];
  brightSeed: SeedInfo;
  darkSeed: SeedInfo | null;
};
```

## 未実装（plan.md の Step 2〜4）

- tonal palette 生成（HCT Tone スケール）
- ロール割り当て（6 palette × Tone 値）
- ハイライトマッピング（HighlightMap への展開）

これらは本番の `src/features/` 側で実装予定。
