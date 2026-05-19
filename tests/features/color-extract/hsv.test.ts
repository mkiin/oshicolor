import { describe, expect, it } from "vitest";

import { hsvToRgb, rgbToHsv } from "../../../src/features/color-extract/usecases/hsv.ts";

const SAMPLES: { name: string; rgb: [number, number, number]; hsv: [number, number, number] }[] = [
    // RGB は 0..1 / HSV は (deg, 0..1, 0..1)
    { name: "black", rgb: [0, 0, 0], hsv: [0, 0, 0] },
    { name: "white", rgb: [1, 1, 1], hsv: [0, 0, 1] },
    { name: "red", rgb: [1, 0, 0], hsv: [0, 1, 1] },
    { name: "green", rgb: [0, 1, 0], hsv: [120, 1, 1] },
    { name: "blue", rgb: [0, 0, 1], hsv: [240, 1, 1] },
    { name: "yellow", rgb: [1, 1, 0], hsv: [60, 1, 1] },
    { name: "cyan", rgb: [0, 1, 1], hsv: [180, 1, 1] },
    { name: "magenta", rgb: [1, 0, 1], hsv: [300, 1, 1] },
    { name: "mid_gray", rgb: [0.5, 0.5, 0.5], hsv: [0, 0, 0.5] },
];

describe("rgbToHsv", () => {
    it.each(SAMPLES)("$name は期待する HSV を返す", ({ rgb, hsv }) => {
        const got = rgbToHsv({ r: rgb[0], g: rgb[1], b: rgb[2] });
        expect(got.h).toBeCloseTo(hsv[0], 4);
        expect(got.s).toBeCloseTo(hsv[1], 4);
        expect(got.v).toBeCloseTo(hsv[2], 4);
    });

    it("hue は常に非負 (0..360)", () => {
        // red の手前 (R 大、G 少、B 小) は wallust の `into_positive_degrees` と同じく 0..360 に揃える
        const got = rgbToHsv({ r: 1, g: 0.1, b: 0.2 });
        expect(got.h).toBeGreaterThanOrEqual(0);
        expect(got.h).toBeLessThan(360);
    });
});

describe("hsvToRgb", () => {
    it.each(SAMPLES)("$name は HSV から RGB に戻る", ({ rgb, hsv }) => {
        const got = hsvToRgb({ h: hsv[0], s: hsv[1], v: hsv[2] });
        expect(got.r).toBeCloseTo(rgb[0], 4);
        expect(got.g).toBeCloseTo(rgb[1], 4);
        expect(got.b).toBeCloseTo(rgb[2], 4);
    });
});

describe("HSV round-trip", () => {
    it("任意の RGB について HSV → RGB が元に戻る", () => {
        const samples: [number, number, number][] = [
            [0.3, 0.6, 0.9],
            [0.7, 0.4, 0.1],
            [0.99, 0.99, 0.5],
        ];
        for (const [r, g, b] of samples) {
            const hsv = rgbToHsv({ r, g, b });
            const back = hsvToRgb(hsv);
            expect(back.r).toBeCloseTo(r, 4);
            expect(back.g).toBeCloseTo(g, 4);
            expect(back.b).toBeCloseTo(b, 4);
        }
    });
});
