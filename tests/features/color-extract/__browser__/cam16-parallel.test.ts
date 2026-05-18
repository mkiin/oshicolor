import { describe, expect, it } from "vitest";

import { bake } from "../../../../src/features/color-extract/usecases/baked-parameters.ts";
import { srgbToCam16UcsJmh } from "../../../../src/features/color-extract/usecases/cam16.ts";
import { convertPixelsParallel } from "../../../../src/features/color-extract/usecases/cam16-parallel.ts";
import type { Parameters } from "../../../../src/features/color-extract/types/cam16.ts";

const DARK_PARAMS: Parameters = { lA: 140, yB: 0.2, surround: "average" };

const seededRandom = (seed: number): (() => number) => {
    let s = seed >>> 0;
    return () => {
        s += 0x6d2b79f5;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const generateRgba = (size: number, seed: number): Uint8ClampedArray => {
    const rnd = seededRandom(seed);
    const pixels = size * size;
    const buf = new Uint8ClampedArray(pixels * 4);
    for (let i = 0; i < pixels; i++) {
        buf[i * 4] = Math.floor(rnd() * 256);
        buf[i * 4 + 1] = Math.floor(rnd() * 256);
        buf[i * 4 + 2] = Math.floor(rnd() * 256);
        buf[i * 4 + 3] = 255;
    }
    return buf;
};

describe("convertPixelsParallel", () => {
    it("出力長は画素数 × 3 で、同期版 srgbToCam16UcsJmh と等価", async () => {
        const size = 64;
        const rgba = generateRgba(size, 0xbeef);
        const pixels = size * size;
        const out = await convertPixelsParallel(rgba, DARK_PARAMS, { workerCount: 4 });
        expect(out.length).toBe(pixels * 3);

        // 単一スレッドの参照値を計算してサンプリングで一致を見る
        const baked = bake(DARK_PARAMS);
        const checkIdxs = [0, Math.floor(pixels / 2), pixels - 1];
        for (const i of checkIdxs) {
            const expected = srgbToCam16UcsJmh(
                [rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]],
                baked,
            );
            expect(out[i * 3]).toBeCloseTo(expected.j, 5);
            expect(out[i * 3 + 1]).toBeCloseTo(expected.m, 5);
            expect(out[i * 3 + 2]).toBeCloseTo(expected.h, 5);
        }
    });

    it("workerCount を変えても同じ画像から同じ結果を返す", async () => {
        const size = 32;
        const rgba = generateRgba(size, 0x42);
        const out1 = await convertPixelsParallel(rgba, DARK_PARAMS, { workerCount: 1 });
        const out4 = await convertPixelsParallel(rgba, DARK_PARAMS, { workerCount: 4 });
        expect(out1.length).toBe(out4.length);
        for (let i = 0; i < out1.length; i++) {
            // 同じ実装を別 Worker で動かしているだけなので完全一致を期待
            expect(out4[i]).toBeCloseTo(out1[i], 6);
        }
    });
});
