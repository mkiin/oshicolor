# packages/ API 設計 + アルゴリズム精度改善プラン

## Context

パッケージは2つの観点で改善が必要:

1. **API 設計の使いにくさ** — 入口が多く、型安全でないパターンが発生している
2. **アルゴリズム精度の問題** — 代表色計算・色変換で切り捨てによる誤差が発生

---

## Part A: アルゴリズム精度の修正

### A-1: `hslToRgb` が float を返す問題（hex 精度に影響）

**ファイル**: `packages/color/src/index.ts`

`hslToRgb` の戻り値は `hue2rgb() * 255` で float になる。
この float を `Swatch` に渡すと `rgbToHex` のビットシフト（`r << 16`）で**常に切り捨て**になる。

```ts
// Before（float を返す）
return [
    hue2rgb(p, q, h + 1 / 3) * 255,
    hue2rgb(p, q, h) * 255,
    hue2rgb(p, q, h - 1 / 3) * 255,
];

// After（整数に丸める）
return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
] as Vec3;
```

s === 0 の分岐も同様:
```ts
// Before
return [l * 255, l * 255, l * 255];
// After
return [Math.round(l * 255), Math.round(l * 255), Math.round(l * 255)] as Vec3;
```

**影響**: `generateEmptySwatches` で生成するフォールバック Swatch（`hslToRgb` 経由）の hex 値が正確になる。

---

### A-2: `VBox.avg()` の切り捨てを丸めに変更

**ファイル**: `packages/core/src/vbox.ts`

`~~()` は `Math.trunc`（0方向への切り捨て）と等価。
加重平均計算後の量子化で最大 0.5 の誤差が生じ、毎分割で累積する。

```ts
// Before（切り捨て）
this._avg = [~~(rsum / ntot), ~~(gsum / ntot), ~~(bsum / ntot)];

// After（丸め）
this._avg = [
    Math.round(rsum / ntot),
    Math.round(gsum / ntot),
    Math.round(bsum / ntot),
];
```

空ボックス時の中心色計算も同様:
```ts
// Before
this._avg = [
    ~~((mult * (r1 + r2 + 1)) / 2),
    ~~((mult * (g1 + g2 + 1)) / 2),
    ~~((mult * (b1 + b2 + 1)) / 2),
];
// After（Math.round に統一）
this._avg = [
    Math.round((mult * (r1 + r2 + 1)) / 2),
    Math.round((mult * (g1 + g2 + 1)) / 2),
    Math.round((mult * (b1 + b2 + 1)) / 2),
];
```

**影響**: MMCQ が生成する代表色が統計的に正確になる（切り捨てバイアスが消える）。

---

### A-3: `DefaultGenerator` の luma 評価を知覚的輝度（YIQ）に切り替え

**ファイル**: `packages/color/src/index.ts`、`packages/core/src/generator-default.ts`

HSL の L 値は知覚的に均一でない（例: 黄色と青が同じ L=0.5 でも見た目の明るさは大きく異なる）。
`Swatch` クラスには YIQ（`_getYiq()`）が既にあるが private。

**Step 1**: `@oshicolor/color` の `Swatch` に正規化 luma ゲッターを追加:

```ts
// packages/color/src/index.ts - Swatch クラスに追加
/** 知覚的輝度（0–1）。YIQ ウェイトによる加重平均 */
get luma(): number {
    return this._getYiq() / 255;
}
```

**Step 2**: `DefaultGenerator` の `findColorVariation` で `swatch.luma` を使う:

```ts
// packages/core/src/generator-default.ts
for (const swatch of swatches) {
    const [, s] = swatch.hsl;
    const l = swatch.luma; // HSL L の代わりに知覚的輝度を使用
    if (
        s >= minSaturation && s <= maxSaturation &&
        l >= minLuma && l <= maxLuma &&
        ...
```

**DEFAULT_OPTS の調整**: HSL L → YIQ luma への切り替えに伴い、閾値を YIQ スケールに合わせる:

```ts
// 現行（HSL L スケール）
export const DEFAULT_OPTS: GeneratorOptions = {
    targetDarkLuma: 0.26,
    maxDarkLuma: 0.45,
    minLightLuma: 0.55,
    targetLightLuma: 0.74,
    minNormalLuma: 0.3,
    targetNormalLuma: 0.5,
    maxNormalLuma: 0.7,
    ...
};

// 変更後（YIQ/255 スケール、知覚的に調整）
export const DEFAULT_OPTS: GeneratorOptions = {
    targetDarkLuma: 0.2,
    maxDarkLuma: 0.35,
    minLightLuma: 0.6,
    targetLightLuma: 0.8,
    minNormalLuma: 0.25,
    targetNormalLuma: 0.45,
    maxNormalLuma: 0.65,
    ...
};
```

> **Note**: YIQ の閾値は実際に画像を試して視覚的に調整する余地がある。上記は YIQ 特性（輝度係数: R=0.299, G=0.587, B=0.114）から逆算した初期値。

**影響**: Vibrant / Light / Dark スロットの選定精度が向上する。特に黄色・青系の色が多い画像（キャラクターイラスト）で効果が出やすい。

---

## Part B: API 設計の改善

### B-1: `Palette` 型のインデックスシグネチャを削除

**ファイル**: `packages/color/src/index.ts`

```ts
// Before
export type Palette = {
    Vibrant: Swatch | null;
    Muted: Swatch | null;
    DarkVibrant: Swatch | null;
    DarkMuted: Swatch | null;
    LightVibrant: Swatch | null;
    LightMuted: Swatch | null;
    [name: string]: Swatch | null; // ← 削除（使用箇所ゼロ）
};
```

**型安全性確認済み**: `vibrant-extractor.ts` の `palette[slot]` は `slot: VibrantSlot`（= `keyof Palette` と完全一致）なのでエラーにならない。

---

### B-2: `vibrant-extractor.ts` を `extractColors()` に統一

**ファイル**: `src/features/color-extractor/vibrant-extractor.ts`

```ts
// Before — 型アサーション必須（3ステップ）
const extractor = Extractor.from(url).build();
const palette = await extractor.getPalette();
const result = extractor.result as ProcessResult; // 型 unsafe
const swatches: Swatch[] = result.colors;

// After — 1ステップ、型安全
const { palette, colors } = await extractColors(url);
```

削除されるインポート:
- `import type { ProcessResult } from "@oshicolor/core"`
- `import { Extractor } from "@oshicolor/core"`

---

### B-3: `core/src/index.ts` にAPI 層コメントを追加

エクスポートを「日常用」「プラグイン拡張用」に分けるセクションコメントを追加。
エクスポート内容自体は変更しない（`StageOptions` は `ExtractorOptions.quantizer` の型に必要）。

```ts
// ── 日常的な使い方（これだけ知っていれば十分） ────────────────────────────────
export { extractColors, Extractor, ExtractorBuilder };
export type { ExtractorOptions, ProcessResult };

// ── プラグイン拡張（カスタム Quantizer / Generator を登録する場合のみ） ─────
export { pipeline, BasicPipeline };
export type { Generator, Quantizer, QuantizerOptions, StageOptions };
export { DefaultGenerator, DEFAULT_OPTS };
export type { GeneratorOptions };
```

---

### B-4: `ExtractorBuilder` JSDoc の更新

通常は `.build()` が不要であることを明示する。

```ts
/**
 * Extractor の設定をチェーンで構築するヘルパークラス
 *
 * **通常は `extractColors()` を使ってください**（パレット + 全量子化色を返す）。
 *
 * オプションをチェーンで設定したい場合は `.getPalette()` を直接呼ぶ:
 * ```ts
 * const palette = await Extractor.from(src).maxColorCount(48).getPalette();
 * ```
 *
 * `build()` が必要なのは `getPalette()` 後に `opts` を参照したい場合のみ。
 */
```

---

## 実施順序

```
A-1: hslToRgb 丸め修正（color パッケージ）
A-2: VBox.avg() 丸め修正（core パッケージ）
A-3: DefaultGenerator luma 切り替え（color + core）
  ├─ Swatch.luma ゲッター追加
  ├─ findColorVariation を swatch.luma に変更
  └─ DEFAULT_OPTS の閾値調整（動作確認しながら）
        ↓
B-1: Palette インデックスシグネチャ削除（color）
B-2: vibrant-extractor.ts を extractColors() に統一（app）
B-3 + B-4: JSDoc 更新（core）
```

---

## 対象ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `packages/color/src/index.ts` | `hslToRgb` 丸め、`Palette` index signature 削除、`Swatch.luma` 追加 |
| `packages/core/src/vbox.ts` | `VBox.avg()` 丸め（`~~` → `Math.round`） |
| `packages/core/src/generator-default.ts` | `swatch.luma` 使用、`DEFAULT_OPTS` 閾値調整 |
| `packages/core/src/index.ts` | JSDoc セクションコメント + `ExtractorBuilder` JSDoc 更新 |
| `src/features/color-extractor/vibrant-extractor.ts` | `extractColors()` に統一 |

---

## 検証方法

```bash
# 1. 型チェック
pnpm tsc --noEmit

# 2. Biome（未使用インポート / フォーマット）
pnpm exec biome check packages/ src/features/color-extractor/

# 3. 動作確認（ブラウザでキャラクター画像をアップロードして6色パレットを目視確認）
pnpm dev
# → Vibrant / Dark / Light スロットが知覚的に妥当な色に対応しているか確認
# → A-3 の DEFAULT_OPTS 閾値は視覚的に調整する
```
