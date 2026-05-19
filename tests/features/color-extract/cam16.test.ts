import { describe, expect, it } from "vitest";
import fixture from "./fixtures/cam16-reference.json";
import { bake } from "../../../src/features/color-extract/usecases/baked-parameters";
import { srgbToCam16UcsJmh } from "../../../src/features/color-extract/usecases/cam16";
import type { Parameters } from "../../../src/features/color-extract/types/cam16";

const DARK_PARAMS: Parameters = { lA: 140, yB: 0.2, surround: "average" };
const LIGHT_PARAMS: Parameters = { lA: 500, yB: 0.8, surround: "average" };

// 許容誤差。fixture は palette クレート (Rust f32) で生成、TS は double 計算のため
// 1e-3 程度の差は CAM16 の計算精度として正常。
const ABS_TOL_JM = 1e-3;
const ABS_TOL_HUE = 1e-3;
// 彩度 M' がこれ未満のとき hue は数値的に不定 (atan2(~0, ~0)) なので比較を省略する。
// white や mid_gray は CAM16 上で M' ≈ 0.5-0.8 程度の微小彩度を持つが、知覚的には achromatic
// なので閾値を 5.0 に置く (Dorothy pink や Scarlet purple の M' は 30 以上)。
const HUE_VALID_M_THRESHOLD = 5.0;

const expectJmhClose = (
    actual: { j: number; m: number; h: number },
    expected: { j: number; m: number; h: number },
    sampleName: string,
) => {
    const diffJ = Math.abs(actual.j - expected.j);
    const diffM = Math.abs(actual.m - expected.m);
    expect(diffJ, `${sampleName}: J' diff ${diffJ}`).toBeLessThan(ABS_TOL_JM);
    expect(diffM, `${sampleName}: M' diff ${diffM}`).toBeLessThan(ABS_TOL_JM);
    if (expected.m > HUE_VALID_M_THRESHOLD) {
        // hue は -180..180 の循環値。境界 (180 ↔ -180) を跨ぐ差も考慮する。
        const rawDiff = Math.abs(actual.h - expected.h);
        const hDiffWrapped = Math.min(rawDiff, 360 - rawDiff);
        expect(hDiffWrapped, `${sampleName}: h diff ${hDiffWrapped}`).toBeLessThan(ABS_TOL_HUE);
    }
};

describe("srgbToCam16UcsJmh", () => {
    const darkBaked = bake(DARK_PARAMS);
    const lightBaked = bake(LIGHT_PARAMS);

    for (const sample of fixture.samples) {
        it(`${sample.name} - dark (L_A=140, Y_b=0.2)`, () => {
            const actual = srgbToCam16UcsJmh(sample.rgb as [number, number, number], darkBaked);
            expectJmhClose(actual, sample.dark, sample.name);
        });

        it(`${sample.name} - light (L_A=500, Y_b=0.8)`, () => {
            const actual = srgbToCam16UcsJmh(sample.rgb as [number, number, number], lightBaked);
            expectJmhClose(actual, sample.light, sample.name);
        });
    }

    it("dark と light で同じ sRGB が異なる Jmh を返す", () => {
        const rgb: [number, number, number] = [120, 92, 177];
        const dark = srgbToCam16UcsJmh(rgb, darkBaked);
        const light = srgbToCam16UcsJmh(rgb, lightBaked);
        // 観察条件が変われば M' は必ず変わる
        expect(Math.abs(dark.m - light.m)).toBeGreaterThan(0.5);
    });
});
