# @oshicolor パッケージ API 改良

## Context

現在の API は以下の課題がある:

1. **3ステップ必要** — `build()` → `getPalette()` → `result.colors` で全色取得
2. **ImageSource が狭い** — `string | HTMLImageElement` のみ。`File` や `ImageBitmap` を直接渡せない
3. **proportion がない** — population (ピクセル数) はあるが全体比率がない
4. **不足 export** — `Generator`, `Quantizer`, `DefaultGenerator`, `DEFAULT_OPTS` が外から使えない

方針: node-vibrant の意味付けパレット × colorthief のシンプル関数 API + 豊富な Color 情報 のいいとこどり。

---

## 変更ファイルと内容

### 1. `packages/image/src/index.ts`

**`ImageSource` に `ImageBitmap` と `Blob` を追加**

```ts
export type ImageSource = string | HTMLImageElement | ImageBitmap | Blob;
```

**`BrowserImage.load()` に 2ブランチを追加**

```ts
// ImageBitmap: canvas に直接描画
if (src instanceof ImageBitmap) {
    const canvas = document.createElement("canvas");
    canvas.width = src.width;
    canvas.height = src.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(src, 0, 0);
    this._canvas = canvas;
    this._context = ctx;
    this._width = src.width;
    this._height = src.height;
    return Promise.resolve(this);
}
// Blob / File: objectURL 経由で既存 string ブランチに委譲
if (src instanceof Blob) {
    const url = URL.createObjectURL(src);
    const result = await this.load(url);
    URL.revokeObjectURL(url);
    return result;
}
```

---

### 2. `packages/color/src/index.ts`

**`Swatch` コンストラクタに `proportion` を追加**

```ts
constructor(rgb: Vec3, population: number, proportion = 0) {
    this._proportion = proportion;
    ...
}
get proportion(): number { return this._proportion; }
```

`proportion` は pipeline 側で計算して渡す（MMCQ は変更しない）。

---

### 3. `packages/core/src/pipeline.ts`

**`_quantizeColors()` (private) で proportion を計算**

量子化後の Swatch[] から合計 population を求め、各 Swatch を proportion 付きで再生成:

```ts
const raw = task.fn(pixels, opts);
const total = raw.reduce((s, c) => s + c.population, 0);
return raw.map(
    (s) =>
        new Swatch(s.rgb, s.population, total > 0 ? s.population / total : 0),
);
```

---

### 4. `packages/core/src/index.ts`

**不足 export を追加**

```ts
export type { Generator, Quantizer, QuantizerOptions } from "./types";
export { DefaultGenerator, DEFAULT_OPTS } from "./generator-default";
export type { GeneratorOptions } from "./generator-default";
```

**`extractColors` convenience function を追加**（colorthief スタイル）

```ts
export const extractColors = async (
    src: ImageSource,
    opts?: Partial<ExtractorOptions>,
): Promise<{ colors: Swatch[]; palette: Palette }> => {
    const extractor = new Extractor(src, opts);
    const palette = await extractor.getPalette();
    return { colors: extractor.result!.colors, palette };
};
```

---

## 改良後の新しい API 全体像

```ts
// ① シンプル関数（colorthief スタイル） ← 新規
const { colors, palette } = await extractColors(file, { colorCount: 48 });
colors[0].population; // ピクセル数
colors[0].proportion; // 0–1 の全体比率 ← 新規
colors[0].hex; // "#e84fa3"

// ② ビルダーパターン（node-vibrant スタイル） ← 既存・引き続き使える
const extractor = Extractor.from(file).maxColorCount(48).build(); // File 直接渡し ← 新規
await extractor.getPalette();
const colors = extractor.result?.colors;

// ③ 意味付けパレット（node-vibrant スタイル） ← 既存
palette.Vibrant?.hex;
palette.DarkVibrant?.hex;
```

---

## 検証

- `File` を `Extractor.from(file)` に渡して画像ロードが成功すること
- `extractColors(file, { colorCount: 48 })` で 48 色の配列が返ること
- `colors[i].proportion` が 0–1 の値で、全要素の合計が 1.0 になること
- `palette.Vibrant` などのセマンティックスロットが正常に返ること
- `import { extractColors, DefaultGenerator, DEFAULT_OPTS } from "@oshicolor/core"` がエラーなく通ること
