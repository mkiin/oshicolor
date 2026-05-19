// sRGB と HSV の相互変換。wallust の `palette::Hsv` と数値挙動が一致する。
//
// 入出力は次のとおりに揃える。
//   - sRGB は 0..1 の Rgb 型
//   - HSV の hue は 0..360 (degree、負にならない)、saturation と value は 0..1

import type { Hsv } from "../types/hsv.ts";
import type { Rgb } from "../types/rgb.ts";

export const rgbToHsv = (rgb: Rgb): Hsv => {
    const max = Math.max(rgb.r, rgb.g, rgb.b);
    const min = Math.min(rgb.r, rgb.g, rgb.b);
    const delta = max - min;

    let h = 0;
    if (delta > 0) {
        if (max === rgb.r) {
            h = ((rgb.g - rgb.b) / delta) % 6;
        } else if (max === rgb.g) {
            h = (rgb.b - rgb.r) / delta + 2;
        } else {
            h = (rgb.r - rgb.g) / delta + 4;
        }
        h *= 60;
        if (h < 0) h += 360;
    }

    const s = max === 0 ? 0 : delta / max;
    return { h, s, v: max };
};

export const hsvToRgb = (hsv: Hsv): Rgb => {
    const c = hsv.v * hsv.s;
    const hh = (hsv.h % 360) / 60;
    const x = c * (1 - Math.abs((hh % 2) - 1));
    const m = hsv.v - c;

    let r = 0;
    let g = 0;
    let b = 0;
    if (hh >= 0 && hh < 1) {
        r = c;
        g = x;
    } else if (hh < 2) {
        r = x;
        g = c;
    } else if (hh < 3) {
        g = c;
        b = x;
    } else if (hh < 4) {
        g = x;
        b = c;
    } else if (hh < 5) {
        r = x;
        b = c;
    } else {
        r = c;
        b = x;
    }
    return { r: r + m, g: g + m, b: b + m };
};

/**
 * RGBA バイト列を HSV タプル配列に一括変換する。Alpha は無視する。
 * 戻り値は wallust の `(hue_degrees, saturation, value)` と同じ並びで返す。
 */
export const rgbaToHsvTuples = (rgba: ArrayLike<number>): [number, number, number][] => {
    const pixels = rgba.length >>> 2;
    return Array.from({ length: pixels }, (_, i) => {
        const o = i * 4;
        const hsv = rgbToHsv({ r: rgba[o] / 255, g: rgba[o + 1] / 255, b: rgba[o + 2] / 255 });
        return [hsv.h, hsv.s, hsv.v];
    });
};
