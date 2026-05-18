// CAM16 観察条件パラメータの "焼き込み" 処理。
// 元実装: palette クレート 0.7.6 の `src/cam16/math.rs::prepare_parameters` を TS に移植。

import type { BakedParameters, Parameters, Surround } from "../types/cam16";

// D65 white point の XYZ (Y = 1.0 正規化)。palette クレートの `white_point::D65` と一致。
const D65_XYZ = { x: 0.95047, y: 1.0, z: 1.08883 } as const;

// CAT16 行列 (XYZ → 錐体応答 RGB)。palette クレート src/cam16/math.rs::m16 と同値。
const M16 = [
    [0.401288, 0.650173, -0.051461],
    [-0.250268, 1.204414, 0.045854],
    [-0.002079, 0.048952, 0.953127],
] as const;

const surroundToPercent = (s: Surround): number => {
    switch (s) {
        case "dark":
            return 0.0;
        case "dim":
            return 10.0;
        case "average":
            return 20.0;
    }
};

const lerp = (from: number, to: number, factor: number): number => (1.0 - factor) * from + factor * to;

const m16xyz = (x: number, y: number, z: number): [number, number, number] => [
    M16[0][0] * x + M16[0][1] * y + M16[0][2] * z,
    M16[1][0] * x + M16[1][1] * y + M16[1][2] * z,
    M16[2][0] * x + M16[2][1] * y + M16[2][2] * z,
];

const adaptComponent = (component: number, fL: number): number => {
    const x = Math.pow((fL * Math.abs(component)) / 100.0, 0.42);
    const sign = component >= 0 ? 1 : -1;
    return (sign * 400.0 * x) / (x + 27.13);
};

export const bake = (p: Parameters): BakedParameters => {
    // palette クレート参照系は XYZ を 0..100 スケールで扱うため、白点も 100 倍する。
    const xyzW = { x: D65_XYZ.x * 100.0, y: D65_XYZ.y * 100.0, z: D65_XYZ.z * 100.0 };
    const lA = p.lA;
    const yB = p.yB * 100.0;
    const yW = xyzW.y;

    const surroundPct = surroundToPercent(p.surround) * 0.1;
    const c =
        surroundPct >= 1.0
            ? lerp(0.59, 0.69, surroundPct - 1.0)
            : lerp(0.525, 0.59, surroundPct);
    const f =
        c >= 0.59
            ? lerp(0.9, 1.0, (c - 0.59) / 0.1)
            : lerp(0.8, 0.9, (c - 0.525) / 0.065);
    const nc = f;

    const k = 1.0 / (5.0 * lA + 1.0);
    const k4 = k * k * k * k;
    const k4Inv = 1.0 - k4;
    const fl = k4 * lA + 0.1 * k4Inv * k4Inv * Math.pow(5.0 * lA, 1.0 / 3.0);

    const n = yB / yW;
    const z = 1.48 + Math.sqrt(n);
    const nbb = 0.725 * Math.pow(n, -0.2);
    const ncb = nbb;

    // Discounting::Auto の D 計算。
    const dRaw = f * (1.0 - (1.0 / 3.6) * Math.exp((-lA - 42.0) / 92.0));
    const d = Math.max(0.0, Math.min(1.0, dRaw));

    // 白点を錐体応答に変換し、各色チャネルで適応係数 d_rgb を求める。
    const rgbW = m16xyz(xyzW.x, xyzW.y, xyzW.z);
    const dRgb: [number, number, number] = [
        lerp(1.0, yW / rgbW[0], d),
        lerp(1.0, yW / rgbW[1], d),
        lerp(1.0, yW / rgbW[2], d),
    ];

    // 白点 (chromatic adaptation 後の RGB) に対する achromatic response Aw を計算。
    const rgbCw: [number, number, number] = [rgbW[0] * dRgb[0], rgbW[1] * dRgb[1], rgbW[2] * dRgb[2]];
    const rgbAw: [number, number, number] = [
        adaptComponent(rgbCw[0], fl),
        adaptComponent(rgbCw[1], fl),
        adaptComponent(rgbCw[2], fl),
    ];
    const aw = nbb * (2.0 * rgbAw[0] + rgbAw[1] + 0.05 * rgbAw[2]);

    return {
        params: p,
        aw,
        f,
        c,
        nc,
        d,
        fl,
        n,
        z,
        nbb,
        ncb,
        whitePoint: D65_XYZ,
    };
};

// 後段の cam16 変換が同じ adapt / d_rgb / m16 行列を再利用できるように
// export しておく (Worker でも同じ実装を使えるよう純粋関数のまま)。
export const internals = {
    M16,
    D65_XYZ,
    adaptComponent,
    m16xyz,
    surroundToPercent,
};
