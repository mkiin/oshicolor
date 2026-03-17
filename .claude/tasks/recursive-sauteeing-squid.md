# OklabKmeans Quantizer 実装プラン

## Context

現行の色抽出はRGB空間のMMCQに依存しており、知覚的均等性がない。
Rust製の okolors アルゴリズム（Oklab色空間 + k-meansクラスタリング）を
TypeScript で再実装し、パイプラインに `"oklab-kmeans"` として追加する。
色相多様性が高いキャラクターイラストでより正確な代表色抽出が期待できる。

---

## 変更ファイル

| ファイル                            | 種別     | 内容                            |
| ----------------------------------- | -------- | ------------------------------- |
| `packages/core/src/oklab-kmeans.ts` | **新規** | OklabKmeans Quantizer 本体      |
| `packages/core/package.json`        | 変更     | `culori` を dependencies に追加 |
| `packages/core/src/index.ts`        | 変更     | import + pipeline 登録を追加    |

---

## アルゴリズムの処理フロー

```
Pixels (Uint8ClampedArray RGBA)
  ↓ pixelsToOklabPoints()
OklabPoint[] (culori で変換, l *= lightnessWeight, 同一色はweightに統合)
  ↓ initKmeansPlusPlus()
Cluster[] (k個の初期重心)
  ↓ runKmeans()
Cluster[] (収束後の重心)
  ↓ clusterToSwatch()
Swatch[] (l /= lightnessWeight → Oklab→RGB → new Swatch([r,g,b], population))
```

---

## `oklab-kmeans.ts` 設計

### 定数

```typescript
const LIGHTNESS_WEIGHT = 0.325; // L軸圧縮係数（okolors デフォルト値）
const MAX_ITERATIONS = 16; // k-means 最大反復回数
const CONVERGENCE_THRESHOLD = 0.001; // 収束判定（全重心移動距離の合計）
```

### 内部型

```typescript
type OklabKmeansOptions = {
  colorCount: number;
  lightnessWeight?: number; // デフォルト: LIGHTNESS_WEIGHT
  maxIterations?: number; // デフォルト: MAX_ITERATIONS
  convergenceThreshold?: number; // デフォルト: CONVERGENCE_THRESHOLD
  // 将来拡張: chromaWeight（彩度方向の重み付け）
  // 現状はOKLab均等距離で十分か確認してから追加を検討
  // chromaWeight?: number;
};
type OklabPoint = { l: number; a: number; b: number; weight: number };
type Cluster = { l: number; a: number; b: number };
```

### 内部関数一覧

| 関数                                                    | 役割                                                                                                                                                                                |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pixelsToOklabPoints(pixels, lightnessWeight)`          | RGBA → OklabPoint[]。culori の `converter("oklab")` を使用。alpha < 125 はスキップ。半透明（125〜254）は `weight *= alpha / 255` で寄与を減衰。同一色は weight に加算してデデュープ |
| `squaredDistance(p, c)`                                 | Oklab空間でのユークリッド距離二乗                                                                                                                                                   |
| `initKmeansPlusPlus(points, k)`                         | k-means++ で初期重心を選択。距離二乗に比例した確率でサンプリング                                                                                                                    |
| `assignClusters(points, centers)`                       | 各点を最近傍クラスタに割り当て → `Int32Array`                                                                                                                                       |
| `updateCenters(points, assignments, prevCenters)`       | 重み付き平均で重心を更新。空クラスタは prevCenters を維持                                                                                                                           |
| `runKmeans(points, initialCenters, maxIter, threshold)` | 収束まで assign → update を反復                                                                                                                                                     |
| `clusterToSwatch(center, population, lightnessWeight)`  | L軸復元 → culori の `converter("rgb")` → [0,255]クリッピング → `new Swatch()`                                                                                                       |

### 初期化方法の選択理由（k-means++ を採用）

Wu量子化はRGB空間前提の3Dヒストグラム分割であり、Oklab空間（L:0–1, a/b:±0.5 と非対称）へのポートは複雑。
k-means++ はOklab距離ベースの確率的初期化で、シンプルかつ知覚均等空間との相性が良い。
収束後の最終品質差は実用上無視できる。

### エクスポート

```typescript
/**
 * Oklab色空間でk-meansクラスタリングを行うQuantizer
 * ...
 */
export const OklabKmeans = (pixels: Pixels, opts: QuantizerOptions): Swatch[] => { ... };
```

`opts` は `QuantizerOptions` で受け取り、内部で `OklabKmeansOptions` にキャストしてデフォルト値を適用。
これにより `Quantizer` 型の契約を満たしつつ、`StageOptions.options` 経由で拡張パラメータを渡せる。

---

## `packages/core/package.json` の変更

```json
"dependencies": {
    "@oshicolor/color": "workspace:*",
    "@oshicolor/image": "workspace:*",
    "culori": "^4.0.2"
}
```

---

## `packages/core/src/index.ts` の変更（2箇所）

```typescript
// 追加するimport
import { OklabKmeans } from "./oklab-kmeans";

// pipeline チェーンに1行追加
export const pipeline = new BasicPipeline().filter
  .register("default", defaultFilter)
  .quantizer.register("mmcq", MMCQ)
  .quantizer.register("oklab-kmeans", OklabKmeans) // 追加
  .generator.register("default", DefaultGenerator);
```

---

## 実装上の注意点

- **Oklab → RGB の色域外クリッピング**: Oklab はsRGBより広色域なため、`clusterToSwatch` で `Math.max(0, Math.min(1, v))` が必須
- **デデュープのキー**: `"${l.toFixed(4)},${a.toFixed(4)},${b.toFixed(4)}"` で Map 管理。culoriの変換は決定的なため同一ピクセルが異なるキーになる問題は起きない
- **culori コンバータ**: `converter("oklab")` / `converter("rgb")` はモジュールトップレベルで一度だけ生成（関数内で毎回生成しない）

---

## 動作確認方法

```bash
# 型チェック
pnpm tsc --noEmit

# アプリ側での切り替え確認
await extractColors(file, { quantizer: "oklab-kmeans", colorCount: 16 });

# カスタムパラメータ
await extractColors(file, {
    quantizer: { name: "oklab-kmeans", options: { lightnessWeight: 0.2 } },
    colorCount: 16,
});
```
