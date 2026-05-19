import { describe, expect, it } from "vitest";

import type { HueName } from "../../../src/features/color-extract/types/ansi.ts";
import { extractAnsi } from "../../../src/features/color-extract/usecases/ansi.ts";
import { rgbToHsv } from "../../../src/features/color-extract/usecases/hsv.ts";

const makeRgba = (pixels: [number, number, number][]): Uint8ClampedArray => {
    const buf = new Uint8ClampedArray(pixels.length * 4);
    for (let i = 0; i < pixels.length; i++) {
        buf[i * 4] = pixels[i][0];
        buf[i * 4 + 1] = pixels[i][1];
        buf[i * 4 + 2] = pixels[i][2];
        buf[i * 4 + 3] = 255;
    }
    return buf;
};

const expectedHueRange: Record<HueName, [number, number]> = {
    red: [0, 60],
    yellow: [60, 120],
    green: [120, 180],
    cyan: [180, 210],
    blue: [210, 280],
    magenta: [280, 360],
};

describe("extractAnsi", () => {
    it("6 hue バケットと black / gray が揃って返る", () => {
        // 各 hue を 1 つずつ含む画素 + black + white で構成
        const rgba = makeRgba([
            [255, 50, 50],   // red 寄り
            [200, 200, 0],   // yellow
            [0, 200, 0],     // green
            [0, 200, 200],   // cyan
            [0, 0, 255],     // blue
            [200, 0, 200],   // magenta
            [0, 0, 0],       // black
            [255, 255, 255], // white
        ]);
        const out = extractAnsi(rgba, "dark");
        for (const name of Object.keys(expectedHueRange) as HueName[]) {
            expect(out.hueBuckets[name]).toBeDefined();
        }
        expect(out.black).toBeDefined();
        expect(out.gray).toBeDefined();
    });

    it("各 hue バケットの結果が期待 hue 範囲内に収まる", () => {
        // 各バケットの中央付近に画素を集中させる
        const rgba = makeRgba([
            [255, 50, 50],
            [220, 220, 0],
            [50, 220, 50],
            [50, 220, 220],
            [50, 50, 220],
            [220, 50, 220],
        ]);
        const out = extractAnsi(rgba, "dark");
        for (const name of Object.keys(expectedHueRange) as HueName[]) {
            const bucket = out.hueBuckets[name];
            const hsv = rgbToHsv(bucket);
            const [start, end] = expectedHueRange[name];
            expect(hsv.h).toBeGreaterThanOrEqual(start);
            expect(hsv.h).toBeLessThanOrEqual(end);
        }
    });

    it("画像に該当 hue が無くても defaults から合成して埋まる", () => {
        // 赤系の画素しかない画像
        const rgba = makeRgba([
            [255, 0, 0],
            [200, 0, 0],
            [180, 50, 50],
        ]);
        const out = extractAnsi(rgba, "dark");
        // green や blue は default 中央値で埋まる
        const greenHsv = rgbToHsv(out.hueBuckets.green);
        const blueHsv = rgbToHsv(out.hueBuckets.blue);
        expect(greenHsv.h).toBeGreaterThanOrEqual(120);
        expect(greenHsv.h).toBeLessThanOrEqual(180);
        expect(blueHsv.h).toBeGreaterThanOrEqual(210);
        expect(blueHsv.h).toBeLessThanOrEqual(280);
    });

    it("style=light のとき val_def が下がり結果が暗くなる", () => {
        // どの hue にも該当しない画像 (white) → 完全に defaults だけが効く
        const rgba = makeRgba(Array.from({ length: 4 }, () => [255, 255, 255] as [number, number, number]));
        const dark = extractAnsi(rgba, "dark");
        const light = extractAnsi(rgba, "light");
        // light style では各 hue バケットの value が dark より低い
        for (const name of Object.keys(expectedHueRange) as HueName[]) {
            const darkV = rgbToHsv(dark.hueBuckets[name]).v;
            const lightV = rgbToHsv(light.hueBuckets[name]).v;
            expect(lightV).toBeLessThan(darkV);
        }
    });

    it("画素が複数バケットに重複使用されない (drain 動作)", () => {
        // red 純色だけ、3 画素。red バケットだけが画素由来、他は default。
        const rgba = makeRgba([
            [255, 0, 0],
            [200, 0, 0],
            [180, 50, 50],
        ]);
        const out = extractAnsi(rgba, "dark");
        // red バケットは画素由来の hue ≈ 0 寄り、defaults との内分で 0..30 ぐらい
        const redHsv = rgbToHsv(out.hueBuckets.red);
        expect(redHsv.h).toBeGreaterThanOrEqual(0);
        expect(redHsv.h).toBeLessThan(60);
        // yellow / green / cyan / blue / magenta は画素が来ていないので default 中央値
        const yellowHsv = rgbToHsv(out.hueBuckets.yellow);
        expect(yellowHsv.h).toBeCloseTo((60 + 120) / 2, 1);
        const blueHsv = rgbToHsv(out.hueBuckets.blue);
        expect(blueHsv.h).toBeCloseTo((210 + 280) / 2, 1);
    });
});
