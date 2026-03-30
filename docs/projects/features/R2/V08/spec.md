# R2/V8 仕様

## 実装スコープ

`scripts/gen-palette-svg-sharp.ts` の seed 選定を colorthief 準拠の OkLch Vibrant + Muted スコアリングに変更した。

## 全体フロー

```
画像 → colorthief getPalette (16色)
     → deriveColorAxes (R1: K=3 hue クラスタリング → main/sub/accent)
     → selectSeeds (各軸から Vibrant + Muted の 2 seed を選定)
     → SVG 描画 (最大6 seeds 表示)
```

## seed 選定（colorthief 準拠スコアリング）

### target 定義

colorthief の `swatches.ts` と同じ OkLch ベース:

| target | targetL | targetC | 用途 |
| --- | --- | --- | --- |
| Vibrant (V) | 0.65 | 0.20 | 鮮やかな特徴色 → syntax fg |
| Muted (M) | 0.65 | 0.04 | 控えめな色味 → UI |

### スコアリング関数

```
score(color, target, maxPopulation) =
  lDist * W_L + cDist * W_C + popNorm * W_POP

lDist = 1 - |color.l - target.targetL|
cDist = 1 - min(|color.c - target.targetC| / 0.2, 1)
popNorm = color.population / maxPopulation
```

高いほど良い。範囲フィルタ（minL/maxL/minC）は廃止。colorthief は画像全体の 16色から選ぶため範囲フィルタが有効だが、軸内の少数色（3〜5色）では厳しすぎて seed が取れなくなるため。

### 選定ロジック

`selectSeeds(colors: Color[]): [SeedEntry, SeedEntry] | [SeedEntry]`

1. 軸内の全色の population 最大値を取得（正規化用）
2. Vibrant target で最高スコアの色を1色目に選定
3. 1色目を除外し、Muted target で最高スコアの色を2色目に選定

## 主要な定数

| 定数 | 値 | 説明 |
| --- | --- | --- |
| `SWATCH_TARGETS.V.targetL` | 0.65 | Vibrant の OkLch lightness target |
| `SWATCH_TARGETS.V.targetC` | 0.20 | Vibrant の OkLch chroma target |
| `SWATCH_TARGETS.M.targetL` | 0.65 | Muted の OkLch lightness target |
| `SWATCH_TARGETS.M.targetC` | 0.04 | Muted の OkLch chroma target |
| `W_L` | 6 | lightness の重み |
| `W_C` | 3 | chroma の重み |
| `W_POP` | 1 | population の重み |

## 主要な型定義

```typescript
type SwatchTarget = "V" | "M";
type TargetDef = { targetL: number; targetC: number };
type SeedEntry = { color: Color; score: number; swatchTarget: SwatchTarget };
type SeedInfo = ColorInfo & { score: number; swatchTarget: SwatchTarget };
```

## 未実装

- tonal palette 生成
- ロール割り当て
- ハイライトマッピング
- 本番コード `src/features/` への移植
