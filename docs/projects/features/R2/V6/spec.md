# R2/V6 仕様

## 実装スコープ

V6 では `scripts/gen-palette-svg-sharp.ts`（デバッグ SVG 生成スクリプト）に対して、3 target seed 選定ロジックを実装した。tonal palette 生成（Step 2〜4）は未実装。

## 全体フロー

```
画像 → colorthief getPalette (16色)
     → deriveColorAxes (R1: 3軸クラスタリング)
     → selectSeeds (各軸から V/DV/LV の最大3 seed を選定)
     → SVG 描画 (最大9 seeds 表示)
```

## Step 1: seed 選定（node-vibrant 3 target × 閾値段階緩和）

### target 定義

node-vibrant の Vibrant / DarkVibrant / LightVibrant の 3 target を採用。色空間は HSL（colorthief の `color.hsl()` を使用）。

| target | saturation | luma | 傾向 |
| --- | --- | --- | --- |
| V (Vibrant) | 0.74 | 0.45 | 鮮やかで中明度 |
| DV (DarkVibrant) | 0.74 | 0.26 | 鮮やかで暗め |
| LV (LightVibrant) | 0.74 | 0.74 | 鮮やかで明るい |

選定優先順: V → DV → LV

### 距離関数

node-vibrant 準拠の重み付きユークリッド距離。

```
W_SATURATION = 3
W_LUMA       = 6.5

distance = sqrt(W_SATURATION * (s - target.s)^2 + W_LUMA * (l - target.l)^2)
```

入力の saturation, luma は HSL の s/100, l/100（0〜1 に正規化）。

### 選定ロジック

`selectSeeds(colors: Color[]): SeedEntry[]`

各 target について順に:

1. 未使用色（他の target で既に選ばれた色を除外）の中から最小距離の色を探す
2. 距離 <= 閾値 → 採用し、次の target へ
3. 距離 > 閾値 → 閾値を `THRESHOLD_STEP` 分緩和して再判定
4. 未使用色がなくなったらその target はスキップ

閾値は無限に緩和されるため、未使用色がある限り必ず1色選ばれる。色合成によるフォールバックは行わない。

### seed 構成（最大9 seeds）

全軸共通で 3 target を適用:

| seed | 軸 | target |
| --- | --- | --- |
| main-V | main | Vibrant |
| main-DV | main | DarkVibrant |
| main-LV | main | LightVibrant |
| sub-V | sub | Vibrant |
| sub-DV | sub | DarkVibrant |
| sub-LV | sub | LightVibrant |
| accent-V | accent | Vibrant |
| accent-DV | accent | DarkVibrant |
| accent-LV | accent | LightVibrant |

軸内の色数が 3 未満の場合、seed 数はその色数に制限される。

## SVG 表示

- seed セクションは動的な slot 数（最大 9）を横並び表示
- 各 seed にラベル（`{axis}-{vibrantRole}`）と距離値（`d=X.XX`）を表示

## 主要な定数

| 定数 | 値 | 説明 |
| --- | --- | --- |
| `VIBRANT_TARGETS.V` | sat=0.74, luma=0.45 | Vibrant target |
| `VIBRANT_TARGETS.DV` | sat=0.74, luma=0.26 | DarkVibrant target |
| `VIBRANT_TARGETS.LV` | sat=0.74, luma=0.74 | LightVibrant target |
| `W_SATURATION` | 3 | 距離関数の saturation 重み |
| `W_LUMA` | 6.5 | 距離関数の luma 重み |
| `INITIAL_THRESHOLD` | 0.4 | 閾値の初期値 |
| `THRESHOLD_STEP` | 0.2 | 閾値の緩和ステップ |

## 主要な型定義

```typescript
type VibrantRole = "V" | "DV" | "LV";
type SeedEntry = { color: Color; distance: number; vibrantRole: VibrantRole };
type SeedInfo = ColorInfo & { distance: number; vibrantRole: VibrantRole };
type AxisInfo = {
  role: string;
  colors: ColorInfo[];
  seeds: SeedInfo[];
};
```

## 未実装（plan.md の Step 2〜4）

- tonal palette 生成（HCT Tone スケール）
- ロール割り当て（palette × Tone 値）
- ハイライトマッピング（HighlightMap への展開）

これらは本番の `src/features/` 側で実装予定。
