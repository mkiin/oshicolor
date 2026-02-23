import type { Palette, Swatch } from "@oshicolor/color";
import type { Pixels } from "@oshicolor/image";

/** 量子化オプション */
export type QuantizerOptions = {
    /** 量子化後の最大色数 @default 64 */
    colorCount: number;
};

/**
 * ピクセルバッファを量子化して Swatch 配列を返す関数型
 */
export type Quantizer = (pixels: Pixels, opts: QuantizerOptions) => Swatch[];

/**
 * Swatch 配列からカラーパレットを生成する関数型
 */
export type Generator = (swatches: Swatch[], opts?: object) => Palette;
