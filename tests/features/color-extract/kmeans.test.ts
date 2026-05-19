import { describe, expect, it } from "vitest";

import { DEFAULT_KMEANS_CONFIG } from "../../../src/features/color-extract/types/kmeans.ts";
import type { Lab } from "../../../src/features/color-extract/types/lab.ts";
import { runKmeans } from "../../../src/features/color-extract/usecases/kmeans.ts";
import { deltaE76, srgbToLab } from "../../../src/features/color-extract/usecases/lab.ts";

// 既知の 3 クラスタを持つ Lab 画素列。各クラスタは Lab 上で十分離れている。
const makeSeparatedClusters = (): Lab[] => {
    const pixels: Lab[] = [];
    // クラスタ A: dark gray あたり (200 px)
    for (let i = 0; i < 200; i++) pixels.push({ l: 20 + (i % 5), a: 0, b: 0 });
    // クラスタ B: bright red あたり (200 px)
    for (let i = 0; i < 200; i++) pixels.push({ l: 55 + (i % 5), a: 80, b: 67 });
    // クラスタ C: bright blue あたり (200 px)
    for (let i = 0; i < 200; i++) pixels.push({ l: 32 + (i % 5), a: 79, b: -108 });
    return pixels;
};

describe("runKmeans", () => {
    it("分離されたクラスタから期待数の重心が得られる", () => {
        const pixels = makeSeparatedClusters();
        const result = runKmeans(pixels, { k: 3, minDist: 5.0, seed: 0xbeef });

        expect(result.dominantSortedByLightness).toHaveLength(3);
        // lightness 昇順になっている
        const lightnessSeries = result.dominantSortedByLightness.map((c) => c.l);
        expect(lightnessSeries.toSorted((a, b) => a - b)).toEqual(lightnessSeries);
    });

    it("シード固定で同じ入力に対して同じ重心を返す (決定性)", () => {
        const pixels = makeSeparatedClusters();
        const r1 = runKmeans(pixels, { ...DEFAULT_KMEANS_CONFIG, k: 4 });
        const r2 = runKmeans(pixels, { ...DEFAULT_KMEANS_CONFIG, k: 4 });
        expect(r1.dominantSortedByLightness).toEqual(r2.dominantSortedByLightness);
    });

    it("minDist で近接重心が dedup される", () => {
        // 同色を 2 倍にする (4 クラスタだが 1 ペアは Lab 上で接近)
        const pixels: Lab[] = [];
        for (let i = 0; i < 100; i++) pixels.push({ l: 20, a: 0, b: 0 });
        for (let i = 0; i < 100; i++) pixels.push({ l: 22, a: 0, b: 0 }); // L=20 と近接
        for (let i = 0; i < 100; i++) pixels.push({ l: 60, a: 50, b: 30 });
        for (let i = 0; i < 100; i++) pixels.push({ l: 80, a: -40, b: 60 });

        // minDist=5 だと L=20 と L=22 が統合され 3 重心になる
        const tight = runKmeans(pixels, { k: 4, minDist: 5.0, seed: 0xbeef });
        // minDist=1 (緩い) なら 4 重心残る
        const loose = runKmeans(pixels, { k: 4, minDist: 1.0, seed: 0xbeef });

        expect(tight.dominantSortedByLightness.length).toBeLessThan(loose.dominantSortedByLightness.length);
    });

    it("画像由来 RGB 配列の支配色 (黒) が上位に来る", () => {
        // 大半が黒 + 一部に赤・青の合成画像
        const pixels: Lab[] = [];
        for (let i = 0; i < 800; i++) pixels.push(srgbToLab([0, 0, 0]));
        for (let i = 0; i < 100; i++) pixels.push(srgbToLab([255, 0, 0]));
        for (let i = 0; i < 100; i++) pixels.push(srgbToLab([0, 0, 255]));

        const result = runKmeans(pixels, { k: 3, minDist: 5.0, seed: 0xbeef });
        // dominantSortedByLightness は lightness 昇順、つまり [black, blue, red] の順 (Lab 上)
        // 黒の重心が先頭で、L が非常に小さい
        expect(result.dominantSortedByLightness[0].l).toBeLessThan(10);

        // 期待する 3 色との距離が許容範囲
        const black = srgbToLab([0, 0, 0]);
        const findClosest = (target: Lab): number =>
            Math.min(...result.dominantSortedByLightness.map((c) => deltaE76(c, target)));
        expect(findClosest(black)).toBeLessThan(5);
    });
});
