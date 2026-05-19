import { describe, expect, it } from "vitest";

import { deltaE76, rgbaToLabArray, srgbToLab } from "../../../src/features/color-extract/usecases/lab.ts";

// Bruce Lindbloom CIE Lab (D65 standard observer 2°) の参照値。
// http://brucelindbloom.com/index.html?ColorCalculator.html
const REFERENCE_SAMPLES: { name: string; rgb: [number, number, number]; lab: [number, number, number] }[] = [
    { name: "white", rgb: [255, 255, 255], lab: [100.0, 0.0, 0.0] },
    { name: "black", rgb: [0, 0, 0], lab: [0.0, 0.0, 0.0] },
    { name: "mid_gray", rgb: [128, 128, 128], lab: [53.585, 0.0, 0.0] },
    { name: "pure_red", rgb: [255, 0, 0], lab: [53.241, 80.092, 67.203] },
    { name: "pure_green", rgb: [0, 255, 0], lab: [87.735, -86.182, 83.179] },
    { name: "pure_blue", rgb: [0, 0, 255], lab: [32.297, 79.188, -107.86] },
    { name: "pure_yellow", rgb: [255, 255, 0], lab: [97.139, -21.554, 94.478] },
];

describe("srgbToLab", () => {
    it.each(REFERENCE_SAMPLES)("$name は Bruce Lindbloom の参照値と一致する", ({ rgb, lab }) => {
        const actual = srgbToLab(rgb);
        expect(actual.l).toBeCloseTo(lab[0], 2);
        expect(actual.a).toBeCloseTo(lab[1], 2);
        expect(actual.b).toBeCloseTo(lab[2], 2);
    });
});

describe("rgbaToLabArray", () => {
    it("RGBA バイト列の各画素を Lab に変換する", () => {
        const rgba = new Uint8ClampedArray([
            255, 255, 255, 255, // white
            0, 0, 0, 255,        // black
            255, 0, 0, 255,      // red
        ]);
        const labs = rgbaToLabArray(rgba);
        expect(labs).toHaveLength(3);
        expect(labs[0].l).toBeCloseTo(100, 2);
        expect(labs[1].l).toBeCloseTo(0, 2);
        expect(labs[2].l).toBeCloseTo(53.241, 2);
    });

    it("Alpha チャネルは無視される", () => {
        const opaque = new Uint8ClampedArray([100, 100, 100, 255]);
        const transparent = new Uint8ClampedArray([100, 100, 100, 0]);
        expect(rgbaToLabArray(opaque)[0]).toEqual(rgbaToLabArray(transparent)[0]);
    });
});

describe("deltaE76", () => {
    it("同じ Lab 同士の距離は 0", () => {
        const c = { l: 50, a: 10, b: -20 };
        expect(deltaE76(c, c)).toBe(0);
    });

    it("white と black の距離は L=100 軸の差に近い", () => {
        const white = srgbToLab([255, 255, 255]);
        const black = srgbToLab([0, 0, 0]);
        expect(deltaE76(white, black)).toBeCloseTo(100, 2);
    });

    it("対称性 deltaE(a, b) === deltaE(b, a)", () => {
        const red = srgbToLab([255, 0, 0]);
        const blue = srgbToLab([0, 0, 255]);
        expect(deltaE76(red, blue)).toBeCloseTo(deltaE76(blue, red), 6);
    });
});
