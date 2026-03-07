import type { Filter } from "@oshicolor/color";

/** ピクセルバッファ（RGBA 順の平坦配列） */
export type Pixels = Uint8ClampedArray;

/** 画像データ（Canvas の getImageData に相当） */
export type ImageData = {
    data: Pixels;
    width: number;
    height: number;
};

/** 画像ダウンサンプリングオプション */
export type ImageOptions = {
    /**
     * ダウンサンプリングの縮小係数。1 はダウンサンプリングなし。
     * `maxDimension` が設定されている場合は無視される。
     * @default 5
     */
    quality: number;
    /**
     * ダウンサンプリング後の長辺の最大ピクセル数。`quality` より優先される。
     * @default 0 (無効)
     */
    maxDimension: number;
};

/** 画像ソース（URL 文字列 / HTMLImageElement / ImageBitmap / Blob・File） */
export type ImageSource = string | HTMLImageElement | ImageBitmap | Blob;

/** Image 実装クラスのコンストラクタ型 */
export type ImageClass = new () => Image;

/** 画像操作の抽象インタフェース */
export type Image = {
    load(src: ImageSource): Promise<Image>;
    clear(): void;
    update(imageData: ImageData): void;
    getWidth(): number;
    getHeight(): number;
    resize(w: number, h: number, ratio: number): void;
    getPixelCount(): number;
    getImageData(): ImageData;
    remove(): void;
    scaleDown(opts: ImageOptions): void;
};

/** ヒストグラム構築オプション */
export type HistogramOptions = {
    sigBits: number;
};

/** RGB 空間の色頻度ヒストグラム */
export class Histogram {
    rmin: number;
    rmax: number;
    gmin: number;
    gmax: number;
    bmin: number;
    bmax: number;
    hist: Uint32Array;
    private _colorCount: number;

    get colorCount(): number {
        return this._colorCount;
    }

    /** sigBits ビットに量子化した (r, g, b) → hist インデックス */
    getColorIndex: (r: number, g: number, b: number) => number;

    constructor(
        public pixels: Pixels,
        public opts: HistogramOptions,
    ) {
        const { sigBits } = opts;
        const rshift = 8 - sigBits;
        const hn = 1 << (3 * sigBits);
        const hist = new Uint32Array(hn);

        const getColorIndex = (r: number, g: number, b: number): number => {
            return (r << (2 * sigBits)) + (g << sigBits) + b;
        };
        this.getColorIndex = getColorIndex;

        let rmax = 0;
        let rmin = Number.MAX_VALUE;
        let gmax = 0;
        let gmin = Number.MAX_VALUE;
        let bmax = 0;
        let bmin = Number.MAX_VALUE;

        const n = pixels.length / 4;
        let i = 0;
        while (i < n) {
            const offset = i * 4;
            i++;
            const r = pixels[offset] ?? 0;
            const g = pixels[offset + 1] ?? 0;
            const b = pixels[offset + 2] ?? 0;
            const a = pixels[offset + 3] ?? 0;

            // フィルタリング段階でアルファが 0 にマークされたピクセルを無視する
            if (a === 0) continue;

            const rq = r >> rshift;
            const gq = g >> rshift;
            const bq = b >> rshift;
            hist[getColorIndex(rq, gq, bq)] += 1;

            if (rq > rmax) rmax = rq;
            if (rq < rmin) rmin = rq;
            if (gq > gmax) gmax = gq;
            if (gq < gmin) gmin = gq;
            if (bq > bmax) bmax = bq;
            if (bq < bmin) bmin = bq;
        }

        this._colorCount = hist.reduce(
            (total, c) => (c > 0 ? total + 1 : total),
            0,
        );
        this.hist = hist;
        this.rmax = rmax;
        this.rmin = rmin;
        this.gmax = gmax;
        this.gmin = gmin;
        this.bmax = bmax;
        this.bmin = bmin;
    }
}

/**
 * 画像ダウンサンプリング処理の共通ロジックを提供する基底クラス
 */
export abstract class ImageBase {
    abstract load(src: ImageSource): Promise<ImageBase>;
    abstract clear(): void;
    abstract update(imageData: ImageData): void;
    abstract getWidth(): number;
    abstract getHeight(): number;
    abstract resize(w: number, h: number, ratio: number): void;
    abstract getPixelCount(): number;
    abstract getImageData(): ImageData;
    abstract remove(): void;

    scaleDown(opts: ImageOptions): void {
        const width = this.getWidth();
        const height = this.getHeight();
        let ratio = 1;
        if (opts.maxDimension > 0) {
            const maxSide = Math.max(width, height);
            if (maxSide > opts.maxDimension)
                ratio = opts.maxDimension / maxSide;
        } else {
            ratio = 1 / opts.quality;
        }
        if (ratio < 1) this.resize(width * ratio, height * ratio, ratio);
    }
}

// ── BrowserImage ────────────────────────────────────────────────────────────

const isRelativeUrl = (url: string): boolean => {
    const u = new URL(url, location.href);
    return (
        u.protocol === location.protocol &&
        u.host === location.host &&
        u.port === location.port
    );
};

const isSameOrigin = (a: string, b: string): boolean => {
    const ua = new URL(a);
    const ub = new URL(b);
    return (
        ua.protocol === ub.protocol &&
        ua.hostname === ub.hostname &&
        ua.port === ub.port
    );
};

/**
 * ブラウザの Canvas API を使った Image 実装
 *
 * URL 文字列を渡した場合、内部で新規 <img> を生成して naturalWidth/naturalHeight を使う。
 * HTMLImageElement を直接渡すと CSS レンダリングサイズ（img.width）が使われるため、
 * objectURL または画像 URL の文字列を渡すことを推奨する。
 */
export class BrowserImage extends ImageBase {
    image: HTMLImageElement | undefined;
    private _canvas: HTMLCanvasElement | undefined;
    private _context: CanvasRenderingContext2D | undefined;
    private _width: number | undefined;
    private _height: number | undefined;

    private _getCanvas(): HTMLCanvasElement {
        if (!this._canvas) throw new Error("Canvas is not initialized");
        return this._canvas;
    }

    private _getContext(): CanvasRenderingContext2D {
        if (!this._context) throw new Error("Context is not initialized");
        return this._context;
    }

    private _getWidth(): number {
        if (this._width === undefined)
            throw new Error("Width is not initialized");
        return this._width;
    }

    private _getHeight(): number {
        if (this._height === undefined)
            throw new Error("Height is not initialized");
        return this._height;
    }

    private _initCanvas(): void {
        const img = this.image;
        if (!img) throw new Error("Image is not initialized");

        const canvas = document.createElement("canvas");
        this._canvas = canvas;
        const context = canvas.getContext("2d");
        if (!context)
            throw new ReferenceError("Failed to create canvas context");

        this._context = context;
        canvas.className = "@oshicolor/canvas";
        canvas.style.display = "none";

        this._width = canvas.width = img.width;
        this._height = canvas.height = img.height;

        context.drawImage(img, 0, 0);
        document.body.appendChild(canvas);
    }

    load(src: ImageSource): Promise<this> {
        // ImageBitmap: canvas に直接描画
        if (src instanceof ImageBitmap) {
            const canvas = document.createElement("canvas");
            canvas.width = src.width;
            canvas.height = src.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                return Promise.reject(
                    new ReferenceError("Failed to create canvas context"),
                );
            }
            ctx.drawImage(src, 0, 0);
            this._canvas = canvas;
            this._context = ctx;
            this._width = src.width;
            this._height = src.height;
            return Promise.resolve(this);
        }

        // Blob / File: objectURL 経由で string ブランチに委譲
        if (src instanceof Blob) {
            const url = URL.createObjectURL(src);
            return this.load(url).then((result) => {
                URL.revokeObjectURL(url);
                return result;
            });
        }

        let img: HTMLImageElement;
        let srcStr: string;

        if (typeof src === "string") {
            img = document.createElement("img");
            srcStr = src;
            if (
                !isRelativeUrl(srcStr) &&
                !isSameOrigin(window.location.href, srcStr)
            ) {
                img.crossOrigin = "anonymous";
            }
            img.src = srcStr;
        } else if (src instanceof HTMLImageElement) {
            img = src;
            srcStr = src.src;
        } else {
            return Promise.reject(
                new Error("Cannot load buffer as an image in browser"),
            );
        }

        this.image = img;

        return new Promise<this>((resolve, reject) => {
            const onLoad = () => {
                this._initCanvas();
                resolve(this);
            };
            if (img.complete) {
                onLoad();
            } else {
                img.onload = onLoad;
                img.onerror = () =>
                    reject(new Error(`Fail to load image: ${srcStr}`));
            }
        });
    }

    clear(): void {
        this._getContext().clearRect(0, 0, this._getWidth(), this._getHeight());
    }

    update(imageData: ImageData): void {
        this._getContext().putImageData(
            imageData as globalThis.ImageData,
            0,
            0,
        );
    }

    getWidth(): number {
        return this._getWidth();
    }

    getHeight(): number {
        return this._getHeight();
    }

    resize(targetWidth: number, targetHeight: number, ratio: number): void {
        if (!this.image) throw new Error("Image is not initialized");
        this._width = this._getCanvas().width = targetWidth;
        this._height = this._getCanvas().height = targetHeight;
        this._getContext().scale(ratio, ratio);
        this._getContext().drawImage(this.image, 0, 0);
    }

    getPixelCount(): number {
        return this._getWidth() * this._getHeight();
    }

    getImageData(): ImageData {
        return this._getContext().getImageData(
            0,
            0,
            this._getWidth(),
            this._getHeight(),
        ) as ImageData;
    }

    remove(): void {
        if (this._canvas?.parentNode) {
            this._canvas.parentNode.removeChild(this._canvas);
        }
    }
}

// ── applyFilters ─────────────────────────────────────────────────────────────

/**
 * ピクセルデータにフィルタを適用する
 *
 * フィルタが false を返したピクセルはアルファ値を 0 にマークする。
 * Histogram の構築段階でアルファ 0 のピクセルは無視される。
 */
export const applyFilters = (
    imageData: ImageData,
    filters: Filter[],
): ImageData => {
    if (filters.length === 0) return imageData;
    const pixels = imageData.data;
    const n = pixels.length / 4;
    for (let i = 0; i < n; i++) {
        const offset = i * 4;
        const r = pixels[offset] ?? 0;
        const g = pixels[offset + 1] ?? 0;
        const b = pixels[offset + 2] ?? 0;
        const a = pixels[offset + 3] ?? 0;
        for (const f of filters) {
            if (!f(r, g, b, a)) {
                pixels[offset + 3] = 0;
                break;
            }
        }
    }
    return imageData;
};
