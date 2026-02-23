# @oshicolor パッケージ群

node-vibrant をベースに自前実装したカラー抽出ライブラリ。
画像 URL からカラーパレットを抽出し、Neovim カラースキーム等に利用できる。

## パッケージ構成

| パッケージ | 役割 |
|---|---|
| `@oshicolor/color` | `Swatch`, `Vec3`, `Palette`, 色変換関数 |
| `@oshicolor/image` | `ImageBase`, `BrowserImage`, `Histogram`, `applyFilters` |
| `@oshicolor/core` | `Extractor`, `BasicPipeline`, MMCQ, `DefaultGenerator` |

依存関係:
```
@oshicolor/core
  ├── @oshicolor/color
  └── @oshicolor/image
        └── @oshicolor/color
```

---

## クイックスタート

```ts
import { Extractor } from "@oshicolor/core";

// URL からパレットを取得（デフォルト設定）
const palette = await Extractor.from(imageUrl).getPalette();

console.log(palette.Vibrant?.hex);       // "#e84fa3" など
console.log(palette.DarkVibrant?.rgb);   // [120, 30, 60]
```

量子化後の全色にもアクセスしたい場合は `build()` を挟む:

```ts
import { Extractor } from "@oshicolor/core";
import type { ProcessResult } from "@oshicolor/core";

const extractor = Extractor.from(imageUrl).build();
const palette = await extractor.getPalette();

const allSwatches = (extractor.result as ProcessResult).colors;
// 量子化された全 Swatch（最大 colorCount 個）
```

---

## Swatch のプロパティ

```ts
import type { Swatch } from "@oshicolor/color";

swatch.rgb         // Vec3: [r, g, b]  (0–255)
swatch.r           // number (0–255)
swatch.g           // number (0–255)
swatch.b           // number (0–255)
swatch.hsl         // Vec3: [h, s, l]  (0–1)
swatch.hex         // "#rrggbb"
swatch.population  // 画像中のこの色のピクセル数

// テキスト用コントラスト色（YIQ ベース）
swatch.titleTextColor  // "#fff" | "#000"
swatch.bodyTextColor   // "#fff" | "#000"
```

---

## パイプライン

```
画像ロード → スケールダウン → Filter → Quantizer → Generator → Palette
```

### Filter

各ピクセルをパレットに含めるかを決定する関数。`false` を返すとそのピクセルは量子化から除外される。

```ts
type Filter = (r: number, g: number, b: number, a: number) => boolean;
```

### Quantizer

フィルタ済みピクセルバッファを受け取り、代表色 `Swatch[]` を返す関数。

```ts
type Quantizer = (pixels: Pixels, opts: QuantizerOptions) => Swatch[];
```

デフォルト実装 `MMCQ`（Modified Median Cut Quantization）は RGB 色空間の直方体（VBox）を population と volume の2フェーズで分割し代表色を抽出する。

### Generator

`Swatch[]` を受け取り、6スロットの `Palette` を返す関数。

```ts
type Generator = (swatches: Swatch[], opts?: object) => Palette;
```

---

## DefaultGenerator のスコアリング

### 6つのパレットスロット

| スロット | 明度（L） | 彩度（S） | 特徴 |
|---|---|---|---|
| `Vibrant` | 0.3 ≤ L ≤ 0.7 (目標 0.5) | S ≥ 0.35 (目標 1.0) | 最も鮮やかな色 |
| `LightVibrant` | L ≥ 0.55 (目標 0.74) | S ≥ 0.35 (目標 1.0) | 明るく鮮やかな色 |
| `DarkVibrant` | L ≤ 0.45 (目標 0.26) | S ≥ 0.35 (目標 1.0) | 暗く鮮やかな色 |
| `Muted` | 0.3 ≤ L ≤ 0.7 (目標 0.5) | S ≤ 0.4 (目標 0.3) | くすんだ色 |
| `LightMuted` | L ≥ 0.55 (目標 0.74) | S ≤ 0.4 (目標 0.3) | 明るくくすんだ色 |
| `DarkMuted` | L ≤ 0.45 (目標 0.26) | S ≤ 0.4 (目標 0.3) | 暗くくすんだ色 |

### スコア計算式

各スロットに最適な Swatch を以下の加重スコアで選ぶ。スロット条件（明度・彩度の範囲）を満たす Swatch の中でスコアが最大のものが選ばれる。

```
score = Σ(invertDiff(value, target) × weight) / Σweight

invertDiff(value, target) = 1 - |value - target|
```

| 要素 | デフォルト重み | 説明 |
|---|---|---|
| 彩度（saturation） | `weightSaturation = 3` | 目標彩度との近さ |
| 明度（luma） | `weightLuma = 6.5` | 目標明度との近さ |
| 人口（population） | `weightPopulation = 0.5` | 画像中の出現頻度 |

明度の重みが最大なのは「目標の明暗に近い色を優先する」ため。彩度は次点で重視される。人口の重みは意図的に低く設定されており、出現頻度が低くても色として適切な Swatch を選べるようにしている。

### フォールバック処理

スロット条件を満たす Swatch がゼロだった場合、関連する別スロットの HSL 値から目標明度を当てはめた合成 Swatch（`population = 0`）を生成してフォールバックする。

```
Vibrant がなく DarkVibrant がある場合
  → DarkVibrant の (H, S) + targetNormalLuma で合成
```

---

## カスタマイズ

### DefaultGenerator のパラメータ調整

`GeneratorOptions` を上書きすることで挙動を変更できる。

```ts
import { pipeline } from "@oshicolor/core";
import { DefaultGenerator, DEFAULT_OPTS } from "@oshicolor/core";

// 例: 明度の重みを下げて彩度を優先するジェネレータ
const saturationFirst = (swatches, opts) =>
    DefaultGenerator(swatches, {
        ...DEFAULT_OPTS,
        weightSaturation: 8,
        weightLuma: 2,
        weightPopulation: 0.5,
        ...opts,
    });

pipeline.generator.register("saturation-first", saturationFirst);
```

```ts
const palette = await Extractor.from(url)
    .build()
    .getPalette();
// または generators オプションで指定（現在は getPalette が "default" 固定）
```

### 完全にカスタムな Generator を作る

```ts
import type { Generator } from "@oshicolor/core";
import type { Palette, Swatch } from "@oshicolor/color";
import { pipeline } from "@oshicolor/core";

/**
 * 最頻出の色を Vibrant に、最も暗い色を DarkVibrant に割り当てる簡易ジェネレータ
 */
const simpleGenerator: Generator = (swatches: Swatch[]): Palette => {
    const sorted = [...swatches].sort((a, b) => b.population - a.population);
    const darkSorted = [...swatches].sort((a, b) => a.hsl[2] - b.hsl[2]);

    return {
        Vibrant:      sorted[0]     ?? null,
        DarkVibrant:  darkSorted[0] ?? null,
        LightVibrant: null,
        Muted:        sorted[1]     ?? null,
        DarkMuted:    null,
        LightMuted:   null,
    };
};

// パイプラインに登録
pipeline.generator.register("simple", simpleGenerator);
```

登録したジェネレータは `ExtractorBuilder` の `generators` オプションで指定できる（`BasicPipeline.process()` を直接呼ぶ場合）。

### カスタム Filter を追加する

```ts
import type { Filter } from "@oshicolor/color";
import { pipeline } from "@oshicolor/core";

// 例: 彩度の低い（グレーに近い）ピクセルを除外するフィルタ
const noGrayFilter: Filter = (r, g, b, a) => {
    if (a < 125) return false;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    return saturation > 0.15; // 彩度 15% 以下を除外
};

pipeline.filter.register("no-gray", noGrayFilter);
```

フィルタは `BasicPipeline.process()` の `filters` 配列に名前を渡すことで適用される。

### カスタム Quantizer を作る

```ts
import type { Quantizer } from "@oshicolor/core";
import { pipeline } from "@oshicolor/core";
import { Swatch } from "@oshicolor/color";

/**
 * ランダムサンプリングによる簡易量子化（デモ用）
 */
const randomQuantizer: Quantizer = (pixels, opts) => {
    const swatches: Swatch[] = [];
    const step = Math.max(1, Math.floor(pixels.length / 4 / opts.colorCount));

    for (let i = 0; i < pixels.length / 4; i += step) {
        const offset = i * 4;
        swatches.push(
            new Swatch(
                [pixels[offset]!, pixels[offset + 1]!, pixels[offset + 2]!],
                1,
            ),
        );
    }
    return swatches.slice(0, opts.colorCount);
};

pipeline.quantizer.register("random", randomQuantizer);
```

### Extractor オプション一覧

```ts
import { Extractor } from "@oshicolor/core";

const extractor = Extractor.from(imageUrl)
    .maxColorCount(128)   // 量子化後の最大色数（デフォルト: 64）
    .quality(3)           // ダウンサンプリング係数（1=なし、デフォルト: 5）
    .maxDimension(500)    // 長辺の最大ピクセル数（0=無効、デフォルト: 0）
    .clearFilters()       // デフォルトフィルタを外す
    .addFilter("no-gray") // カスタムフィルタを追加
    .build();

const palette = await extractor.getPalette();
```

---

## GeneratorOptions リファレンス

```ts
import { DEFAULT_OPTS } from "@oshicolor/core";
// DEFAULT_OPTS の値（パラメータ調整の基準値として使用する）
```

| パラメータ | デフォルト | 意味 |
|---|---|---|
| `targetDarkLuma` | `0.26` | Dark 系スロットの目標明度 |
| `maxDarkLuma` | `0.45` | Dark 系スロットの明度上限 |
| `minLightLuma` | `0.55` | Light 系スロットの明度下限 |
| `targetLightLuma` | `0.74` | Light 系スロットの目標明度 |
| `minNormalLuma` | `0.3` | Normal 系スロットの明度下限 |
| `targetNormalLuma` | `0.5` | Normal 系スロットの目標明度 |
| `maxNormalLuma` | `0.7` | Normal 系スロットの明度上限 |
| `targetMutesSaturation` | `0.3` | Muted 系スロットの目標彩度 |
| `maxMutesSaturation` | `0.4` | Muted 系スロットの彩度上限 |
| `targetVibrantSaturation` | `1.0` | Vibrant 系スロットの目標彩度 |
| `minVibrantSaturation` | `0.35` | Vibrant 系スロットの彩度下限 |
| `weightSaturation` | `3` | 彩度スコアの重み |
| `weightLuma` | `6.5` | 明度スコアの重み |
| `weightPopulation` | `0.5` | 人口スコアの重み |
