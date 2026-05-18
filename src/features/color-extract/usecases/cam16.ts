// sRGB から CAM16-UCS Jmh への変換。
// 元実装: palette クレート 0.7.6 の `src/cam16/math.rs::xyz_to_cam16` と
// `src/cam16/ucs_jmh.rs::FromColorUnclamped<Cam16Jmh>` を TS に移植。

import type { BakedParameters, Cam16UcsJmh } from "../types/cam16";
import { internals } from "./baked-parameters";

// sRGB ガンマ補正の逆変換 (sRGB 0..1 → linear sRGB 0..1)。
const linearizeChannel = (c: number): number =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

// linear sRGB → XYZ (D65) の標準変換行列。
const SRGB_TO_XYZ = [
    [0.4124564, 0.3575761, 0.1804375],
    [0.2126729, 0.7151522, 0.072175],
    [0.0193339, 0.119192, 0.9503041],
] as const;

const lerp = (from: number, to: number, factor: number): number => (1.0 - factor) * from + factor * to;

const srgbToXyz = (r: number, g: number, b: number): [number, number, number] => {
    const lr = linearizeChannel(r);
    const lg = linearizeChannel(g);
    const lb = linearizeChannel(b);
    return [
        SRGB_TO_XYZ[0][0] * lr + SRGB_TO_XYZ[0][1] * lg + SRGB_TO_XYZ[0][2] * lb,
        SRGB_TO_XYZ[1][0] * lr + SRGB_TO_XYZ[1][1] * lg + SRGB_TO_XYZ[1][2] * lb,
        SRGB_TO_XYZ[2][0] * lr + SRGB_TO_XYZ[2][1] * lg + SRGB_TO_XYZ[2][2] * lb,
    ];
};

// 0..255 の sRGB バイト列を 0..1 に正規化。
const normalizeByte = (b: number): number => b / 255.0;

const radToDeg = (rad: number): number => (rad * 180.0) / Math.PI;

// palette クレートの hue は -180..180 度で返るため、揃える。
const wrapHue = (deg: number): number => {
    let h = deg;
    while (h > 180.0) h -= 360.0;
    while (h <= -180.0) h += 360.0;
    return h;
};

// XYZ (0..1 スケール、D65) と焼き込み済みパラメータから CAM16 lightness/colorfulness/hue を導く。
// palette クレートと同じく XYZ は内部で 0..100 に変換してから処理する。
const xyzToCam16Jmh = (
    xyz: [number, number, number],
    baked: BakedParameters,
): { j: number; m: number; hDeg: number } => {
    const x = xyz[0] * 100.0;
    const y = xyz[1] * 100.0;
    const z = xyz[2] * 100.0;

    const rgb = internals.m16xyz(x, y, z);
    // d_rgb を baked からそのまま使うわけにはいかないので、ここで再計算する。
    // BakedParameters から外に持ち出していない理由は型を簡素に保つため。
    // 性能上のホットパスではないので素直に再計算する。
    const rgbW = internals.m16xyz(
        baked.whitePoint.x * 100.0,
        baked.whitePoint.y * 100.0,
        baked.whitePoint.z * 100.0,
    );
    const yW = baked.whitePoint.y * 100.0;
    const dRgb: [number, number, number] = [
        lerp(1.0, yW / rgbW[0], baked.d),
        lerp(1.0, yW / rgbW[1], baked.d),
        lerp(1.0, yW / rgbW[2], baked.d),
    ];

    const rA = internals.adaptComponent(rgb[0] * dRgb[0], baked.fl);
    const gA = internals.adaptComponent(rgb[1] * dRgb[1], baked.fl);
    const bA = internals.adaptComponent(rgb[2] * dRgb[2], baked.fl);

    const a = rA + (-12.0 * gA + bA) / 11.0;
    const bComp = (rA + gA - 2.0 * bA) / 9.0;
    const hRad = Math.atan2(bComp, a);
    const hDeg = wrapHue(radToDeg(hRad));

    const eT = 0.25 * (Math.cos(hRad + 2.0) + 3.8);

    const capitalA = baked.nbb * (2.0 * rA + gA + 0.05 * bA);
    const jRoot = Math.pow(capitalA / baked.aw, 0.5 * baked.c * baked.z);
    const j = 100.0 * jRoot * jRoot;

    const t =
        ((50000.0 / 13.0) *
            baked.nc *
            baked.ncb *
            eT *
            Math.sqrt(a * a + bComp * bComp)) /
        (rA + gA + 1.05 * bA + 0.305);
    const alpha = Math.pow(t, 0.9) * Math.pow(1.64 - Math.pow(0.29, baked.n), 0.73);
    const chroma = jRoot * alpha;
    const fL4 = Math.pow(baked.fl, 0.25);
    const m = fL4 * chroma;

    return { j, m, hDeg };
};

// CAM16 の J/M を CAM16-UCS の J'/M' に変換。ucs_jmh.rs:184-195 と同じ式。
const toUcs = (j: number, m: number): { jPrime: number; mPrime: number } => ({
    jPrime: (1.7 * j) / (1.0 + 0.007 * j),
    mPrime: Math.log(1.0 + 0.0228 * m) / 0.0228,
});

/**
 * 24-bit sRGB バイトトリプル (0..255) を CAM16-UCS Jmh に変換する。
 * @param rgb 入力色 (r, g, b それぞれ 0..255)
 * @param baked 焼き込み済みの観察条件
 */
export const srgbToCam16UcsJmh = (
    rgb: readonly [number, number, number] | { 0: number; 1: number; 2: number },
    baked: BakedParameters,
): Cam16UcsJmh => {
    const r = normalizeByte(rgb[0]);
    const g = normalizeByte(rgb[1]);
    const b = normalizeByte(rgb[2]);
    const xyz = srgbToXyz(r, g, b);
    const { j, m, hDeg } = xyzToCam16Jmh(xyz, baked);
    const { jPrime, mPrime } = toUcs(j, m);
    return { j: jPrime, m: mPrime, h: hDeg };
};
