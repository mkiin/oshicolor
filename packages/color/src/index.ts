/** 3次元浮動小数点ベクトル（RGB または HSL） */
export type Vec3 = [number, number, number];

/**
 * ピクセルをパレットに含める場合は true を返すフィルタ関数
 *
 * @param r - 赤 (0-255)
 * @param g - 緑 (0-255)
 * @param b - 青 (0-255)
 * @param a - アルファ (0-255)
 * @returns 色を保持するなら true
 */
export type Filter = (r: number, g: number, b: number, a: number) => boolean;

/** 6スロットのカラーパレット */
export type Palette = {
    Vibrant: Swatch | null;
    Muted: Swatch | null;
    DarkVibrant: Swatch | null;
    DarkMuted: Swatch | null;
    LightVibrant: Swatch | null;
    LightMuted: Swatch | null;
};

/**
 * RGB → HEX 文字列 (#rrggbb)
 */
export const rgbToHex = (r: number, g: number, b: number): string => {
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1, 7)}`;
};

/**
 * RGB → HSL 変換（各値は 0–1）
 */
export const rgbToHsl = (r: number, g: number, b: number): Vec3 => {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case rn:
                h = (gn - bn) / d + (gn < bn ? 6 : 0);
                break;
            case gn:
                h = (bn - rn) / d + 2;
                break;
            case bn:
                h = (rn - gn) / d + 4;
                break;
        }
        h /= 6;
    }
    return [h, s, l];
};

/**
 * HSL → RGB 変換（h, s, l は 0–1、戻り値は 0–255）
 */
export const hslToRgb = (h: number, s: number, l: number): Vec3 => {
    const hue2rgb = (p: number, q: number, t: number): number => {
        let tt = t;
        if (tt < 0) tt += 1;
        if (tt > 1) tt -= 1;
        if (tt < 1 / 6) return p + (q - p) * 6 * tt;
        if (tt < 1 / 2) return q;
        if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
        return p;
    };

    if (s === 0) {
        return [
            Math.round(l * 255),
            Math.round(l * 255),
            Math.round(l * 255),
        ] as Vec3;
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [
        Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
        Math.round(hue2rgb(p, q, h) * 255),
        Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
    ] as Vec3;
};

/**
 * 画像パレットから生成された1色分のデータを保持するクラス
 */
export class Swatch {
    /**
     * フィルタを適用して条件を満たさない Swatch を除外する
     */
    static applyFilters(colors: Swatch[], filters: Filter[]): Swatch[] {
        if (filters.length === 0) return colors;
        return colors.filter(({ r, g, b }) => {
            return filters.every((f) => f(r, g, b, 255));
        });
    }

    static clone(swatch: Swatch): Swatch {
        return new Swatch(swatch._rgb, swatch._population, swatch._proportion);
    }

    private _rgb: Vec3;
    private _population: number;
    private _proportion: number;
    private _hsl: Vec3 | undefined;
    private _hex: string | undefined;
    private _yiq: number | undefined;
    private _titleTextColor: string | undefined;
    private _bodyTextColor: string | undefined;

    get r(): number {
        return this._rgb[0];
    }
    get g(): number {
        return this._rgb[1];
    }
    get b(): number {
        return this._rgb[2];
    }
    get rgb(): Vec3 {
        return this._rgb;
    }

    get hsl(): Vec3 {
        if (!this._hsl) {
            const [r, g, b] = this._rgb;
            this._hsl = rgbToHsl(r, g, b);
        }
        return this._hsl;
    }

    get hex(): string {
        if (!this._hex) {
            const [r, g, b] = this._rgb;
            this._hex = rgbToHex(r, g, b);
        }
        return this._hex;
    }

    get population(): number {
        return this._population;
    }

    /** 全ピクセルに対するこの色の占有比率（0–1） */
    get proportion(): number {
        return this._proportion;
    }

    private _getYiq(): number {
        if (this._yiq === undefined) {
            this._yiq =
                (this._rgb[0] * 299 + this._rgb[1] * 587 + this._rgb[2] * 114) /
                1000;
        }
        return this._yiq;
    }

    /** 知覚的輝度（0–1）。YIQ ウェイトによる加重平均 */
    get luma(): number {
        return this._getYiq() / 255;
    }

    /** タイトルテキスト用の推奨コントラスト色 */
    get titleTextColor(): string {
        if (!this._titleTextColor) {
            this._titleTextColor = this._getYiq() < 200 ? "#fff" : "#000";
        }
        return this._titleTextColor;
    }

    /** 本文テキスト用の推奨コントラスト色 */
    get bodyTextColor(): string {
        if (!this._bodyTextColor) {
            this._bodyTextColor = this._getYiq() < 150 ? "#fff" : "#000";
        }
        return this._bodyTextColor;
    }

    toJSON(): { rgb: Vec3; population: number; proportion: number } {
        return {
            rgb: this.rgb,
            population: this.population,
            proportion: this.proportion,
        };
    }

    /**
     * @param rgb - `[r, g, b]` (0–255)
     * @param population - 画像中のこの色のピクセル数
     * @param proportion - 全ピクセルに対する占有比率（0–1）。パイプライン側で計算して渡す
     */
    constructor(rgb: Vec3, population: number, proportion = 0) {
        this._rgb = rgb;
        this._population = population;
        this._proportion = proportion;
    }
}
