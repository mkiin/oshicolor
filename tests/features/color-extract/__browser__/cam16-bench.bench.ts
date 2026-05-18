import { converter } from "culori";
import { bench, describe } from "vitest";

import { bake } from "../../../../src/features/color-extract/usecases/baked-parameters.ts";
import { srgbToCam16UcsJmh } from "../../../../src/features/color-extract/usecases/cam16.ts";
import { convertPixelsParallel } from "../../../../src/features/color-extract/usecases/cam16-parallel.ts";
import type { Parameters } from "../../../../src/features/color-extract/types/cam16.ts";

const DARK_PARAMS: Parameters = { lA: 140, yB: 0.2, surround: "average" };
const BENCH_OPTS = { iterations: 3, warmupIterations: 1 } as const;

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

const benchOklchSync = (rgba: Uint8ClampedArray) => {
    const toOklch = converter("oklch");
    const pixels = rgba.length >>> 2;
    for (let i = 0; i < pixels; i++) {
        toOklch({
            mode: "rgb",
            r: rgba[i * 4] / 255,
            g: rgba[i * 4 + 1] / 255,
            b: rgba[i * 4 + 2] / 255,
        });
    }
};

const benchCam16Sync = (rgba: Uint8ClampedArray, baked: ReturnType<typeof bake>) => {
    const pixels = rgba.length >>> 2;
    for (let i = 0; i < pixels; i++) {
        srgbToCam16UcsJmh([rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]], baked);
    }
};

for (const size of [256, 512, 1024]) {
    describe(`${size}x${size} (${(size * size) / 1000} k px)`, () => {
        const rgba = generateRgba(size, 0xbeef);
        const baked = bake(DARK_PARAMS);

        bench(
            "OKLch (culori) single",
            () => {
                benchOklchSync(rgba);
            },
            BENCH_OPTS,
        );

        bench(
            "CAM16-UCS single",
            () => {
                benchCam16Sync(rgba, baked);
            },
            BENCH_OPTS,
        );

        for (const workers of [1, 2, 4, 8]) {
            bench(
                `CAM16-UCS parallel x${workers}`,
                async () => {
                    await convertPixelsParallel(rgba, DARK_PARAMS, { workerCount: workers });
                },
                BENCH_OPTS,
            );
        }
    });
}
