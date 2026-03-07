import type { Palette, Swatch } from "@oshicolor/color";
import type { ImageClass, ImageSource } from "@oshicolor/image";
import { BrowserImage } from "@oshicolor/image";
import { DefaultGenerator } from "./generator-default";
import { MMCQ } from "./mmcq";
import type { ProcessOptions, ProcessResult, StageOptions } from "./pipeline";
import { BasicPipeline } from "./pipeline";

// ── 日常的な使い方（これだけ知っていれば十分） ────────────────────────────────
// extractColors / Extractor / ExtractorBuilder はクラス定義と同じファイルで export される

// ── プラグイン拡張（カスタム Quantizer / Generator を登録する場合のみ） ─────
export type { GeneratorOptions } from "./generator-default";
export { DEFAULT_OPTS, DefaultGenerator } from "./generator-default";
export type { ProcessResult, StageOptions } from "./pipeline";
export type { Generator, Quantizer, QuantizerOptions } from "./types";

/** Extractor の設定オプション */
export type ExtractorOptions = {
    /** 量子化後の最大色数 @default 64 */
    colorCount: number;
    /**
     * ダウンサンプリング係数（1 = なし）。maxDimension が設定された場合は無視。
     * @default 5
     */
    quality: number;
    /**
     * ダウンサンプリング後の長辺の最大ピクセル数。quality より優先。
     * @default 0 (無効)
     */
    maxDimension: number;
    /** Image 実装クラス */
    ImageClass: ImageClass;
    /** 使用する量子化器の名前または設定 */
    quantizer: string | StageOptions;
    /** 使用するジェネレータの名前または設定の配列 */
    generators: (string | StageOptions)[];
    /** 使用するフィルタ名の配列 */
    filters: string[];
};

// ── パイプラインの組み立て ───────────────────────────────────────────────────

// 透明ピクセル（a < 125）と純白に近いピクセルをフィルタリングする
const defaultFilter = (r: number, g: number, b: number, a: number): boolean => {
    return a >= 125 && !(r > 250 && g > 250 && b > 250);
};

/**
 * デフォルト設定のパイプライン
 *
 * - filter "default": 透明・純白を除外
 * - quantizer "mmcq": MMCQ アルゴリズム
 * - generator "default": DefaultGenerator
 */
export const pipeline = new BasicPipeline().filter
    .register("default", defaultFilter)
    .quantizer.register("mmcq", MMCQ)
    .generator.register("default", DefaultGenerator);

// ── Extractor ──────────────────────────────────────────────────────────────

const buildProcessOptions = (
    opts: ExtractorOptions,
    override?: Partial<ProcessOptions>,
): ProcessOptions => {
    const quantizer =
        typeof opts.quantizer === "string"
            ? { name: opts.quantizer, options: { colorCount: opts.colorCount } }
            : {
                  ...opts.quantizer,
                  options: {
                      colorCount: opts.colorCount,
                      ...opts.quantizer.options,
                  },
              };
    return {
        quantizer,
        generators: opts.generators,
        filters: opts.filters,
        ...override,
    };
};

/**
 * 画像 URL から色を抽出するメインクラス
 *
 * `Extractor.from(url).getPalette()` で簡単に使える。
 * `build()` でインスタンスを取得すると `getPalette()` 後に `result` で
 * 量子化全色（`result.colors`）にアクセスできる。
 *
 * @example
 * ```ts
 * const extractor = Extractor.from(url).build();
 * const palette = await extractor.getPalette();
 * const allSwatches = extractor.result?.colors;
 * ```
 */
export class Extractor {
    private _result: ProcessResult | undefined;

    /** デフォルト設定（上書き可能） */
    static DefaultOpts: Partial<ExtractorOptions> = {
        colorCount: 64,
        quality: 5,
        maxDimension: 0,
        filters: ["default"],
        quantizer: "mmcq",
        generators: ["default"],
        ImageClass: BrowserImage,
    };

    /**
     * URL からビルダーを生成する
     *
     * @param src - 画像の URL または objectURL
     */
    static from(src: ImageSource): ExtractorBuilder {
        return new ExtractorBuilder(src);
    }

    /** getPalette() 後に量子化全色などにアクセスできる処理結果 */
    get result(): ProcessResult | undefined {
        return this._result;
    }

    opts: ExtractorOptions;

    constructor(
        private _src: ImageSource,
        opts?: Partial<ExtractorOptions>,
    ) {
        this.opts = Object.assign(
            {},
            Extractor.DefaultOpts,
            opts,
        ) as ExtractorOptions;
    }

    /**
     * デフォルトジェネレータで6色パレットを抽出する
     *
     * @returns 6スロットのカラーパレット
     */
    async getPalette(): Promise<Palette> {
        const image = new this.opts.ImageClass();
        try {
            const loaded = await image.load(this._src);
            loaded.scaleDown(this.opts);
            const processOpts = buildProcessOptions(this.opts, {
                generators: ["default"],
            });
            this._result = await pipeline.process(
                loaded.getImageData(),
                processOpts,
            );
            const palette = this._result.palettes.default;
            if (!palette) {
                throw new Error("Generator 'default' returned no palette");
            }
            image.remove();
            return palette;
        } catch (err) {
            image.remove();
            throw err;
        }
    }
}

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
export class ExtractorBuilder {
    private _opts: Partial<ExtractorOptions>;

    constructor(
        private _src: ImageSource,
        opts: Partial<ExtractorOptions> = {},
    ) {
        this._opts = { ...Extractor.DefaultOpts, ...opts };
    }

    maxColorCount(n: number): this {
        this._opts.colorCount = n;
        return this;
    }

    maxDimension(d: number): this {
        this._opts.maxDimension = d;
        return this;
    }

    quality(q: number): this {
        this._opts.quality = q;
        return this;
    }

    addFilter(name: string): this {
        if (!this._opts.filters) {
            this._opts.filters = [name];
        } else {
            this._opts.filters.push(name);
        }
        return this;
    }

    clearFilters(): this {
        this._opts.filters = [];
        return this;
    }

    useImageClass(imageClass: ImageClass): this {
        this._opts.ImageClass = imageClass;
        return this;
    }

    /** インスタンスを生成する */
    build(): Extractor {
        return new Extractor(this._src, this._opts);
    }

    /** ビルドして getPalette() を呼ぶ */
    getPalette(): Promise<Palette> {
        return this.build().getPalette();
    }
}

/**
 * 画像ソースから色を抽出するシンプル関数（colorthief スタイル）
 *
 * @param src - 画像ソース（URL / HTMLImageElement / ImageBitmap / Blob・File）
 * @param opts - 抽出オプション
 * @returns 量子化全色（`colors`）と意味付きパレット（`palette`）
 *
 * @example
 * ```ts
 * const { colors, palette } = await extractColors(file, { colorCount: 48 });
 * colors[0].proportion; // 0–1 の全体比率
 * palette.Vibrant?.hex;
 * ```
 */
export const extractColors = async (
    src: ImageSource,
    opts?: Partial<ExtractorOptions>,
): Promise<{ colors: Swatch[]; palette: Palette }> => {
    const extractor = new Extractor(src, opts);
    const palette = await extractor.getPalette();
    // biome-ignore lint/style/noNonNullAssertion: getPalette() が成功した場合 result は必ず存在する
    return { colors: extractor.result!.colors, palette };
};
