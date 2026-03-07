import type { Palette } from "@oshicolor/color";
import { hslToRgb, Swatch } from "@oshicolor/color";
import type { Generator } from "./types";

/** DefaultGenerator の調整パラメータ */
export type GeneratorOptions = {
    targetDarkLuma: number;
    maxDarkLuma: number;
    minLightLuma: number;
    targetLightLuma: number;
    minNormalLuma: number;
    targetNormalLuma: number;
    maxNormalLuma: number;
    targetMutesSaturation: number;
    maxMutesSaturation: number;
    targetVibrantSaturation: number;
    minVibrantSaturation: number;
    weightSaturation: number;
    weightLuma: number;
    weightPopulation: number;
};

/** DefaultGenerator のデフォルトパラメータ（YIQ/255 スケールに調整済み） */
export const DEFAULT_OPTS: GeneratorOptions = {
    targetDarkLuma: 0.2,
    maxDarkLuma: 0.35,
    minLightLuma: 0.6,
    targetLightLuma: 0.8,
    minNormalLuma: 0.25,
    targetNormalLuma: 0.45,
    maxNormalLuma: 0.65,
    targetMutesSaturation: 0.3,
    maxMutesSaturation: 0.4,
    targetVibrantSaturation: 1.0,
    minVibrantSaturation: 0.35,
    weightSaturation: 3,
    weightLuma: 6.5,
    weightPopulation: 0.5,
};

const findMaxPopulation = (swatches: Swatch[]): number => {
    return swatches.reduce((max, s) => Math.max(max, s.population), 0);
};

const isAlreadySelected = (palette: Palette, s: Swatch): boolean => {
    return (
        palette.Vibrant === s ||
        palette.DarkVibrant === s ||
        palette.LightVibrant === s ||
        palette.Muted === s ||
        palette.DarkMuted === s ||
        palette.LightMuted === s
    );
};

const createComparisonValue = (
    saturation: number,
    targetSaturation: number,
    luma: number,
    targetLuma: number,
    population: number,
    maxPopulation: number,
    opts: GeneratorOptions,
): number => {
    const invertDiff = (value: number, target: number): number => {
        return 1 - Math.abs(value - target);
    };

    // value=0 または weight=0 のペアはスキップする加重平均
    const pairs: [number, number][] = [
        [invertDiff(saturation, targetSaturation), opts.weightSaturation],
        [invertDiff(luma, targetLuma), opts.weightLuma],
        [population / maxPopulation, opts.weightPopulation],
    ];
    let sum = 0;
    let weightSum = 0;
    for (const [value, weight] of pairs) {
        if (!value || !weight) continue;
        sum += value * weight;
        weightSum += weight;
    }
    return weightSum === 0 ? 0 : sum / weightSum;
};

const findColorVariation = (
    palette: Palette,
    swatches: Swatch[],
    maxPopulation: number,
    targetLuma: number,
    minLuma: number,
    maxLuma: number,
    targetSaturation: number,
    minSaturation: number,
    maxSaturation: number,
    opts: GeneratorOptions,
): Swatch | null => {
    let max: Swatch | null = null;
    let maxValue = 0;

    for (const swatch of swatches) {
        const [, s] = swatch.hsl;
        const l = swatch.luma; // HSL L の代わりに知覚的輝度を使用
        if (
            s >= minSaturation &&
            s <= maxSaturation &&
            l >= minLuma &&
            l <= maxLuma &&
            !isAlreadySelected(palette, swatch)
        ) {
            const value = createComparisonValue(
                s,
                targetSaturation,
                l,
                targetLuma,
                swatch.population,
                maxPopulation,
                opts,
            );
            if (max === null || value > maxValue) {
                max = swatch;
                maxValue = value;
            }
        }
    }

    return max;
};

const generateVariationColors = (
    swatches: Swatch[],
    maxPopulation: number,
    opts: GeneratorOptions,
): Palette => {
    const palette: Palette = {
        Vibrant: null,
        DarkVibrant: null,
        LightVibrant: null,
        Muted: null,
        DarkMuted: null,
        LightMuted: null,
    };

    palette.Vibrant = findColorVariation(
        palette,
        swatches,
        maxPopulation,
        opts.targetNormalLuma,
        opts.minNormalLuma,
        opts.maxNormalLuma,
        opts.targetVibrantSaturation,
        opts.minVibrantSaturation,
        1,
        opts,
    );
    palette.LightVibrant = findColorVariation(
        palette,
        swatches,
        maxPopulation,
        opts.targetLightLuma,
        opts.minLightLuma,
        1,
        opts.targetVibrantSaturation,
        opts.minVibrantSaturation,
        1,
        opts,
    );
    palette.DarkVibrant = findColorVariation(
        palette,
        swatches,
        maxPopulation,
        opts.targetDarkLuma,
        0,
        opts.maxDarkLuma,
        opts.targetVibrantSaturation,
        opts.minVibrantSaturation,
        1,
        opts,
    );
    palette.Muted = findColorVariation(
        palette,
        swatches,
        maxPopulation,
        opts.targetNormalLuma,
        opts.minNormalLuma,
        opts.maxNormalLuma,
        opts.targetMutesSaturation,
        0,
        opts.maxMutesSaturation,
        opts,
    );
    palette.LightMuted = findColorVariation(
        palette,
        swatches,
        maxPopulation,
        opts.targetLightLuma,
        opts.minLightLuma,
        1,
        opts.targetMutesSaturation,
        0,
        opts.maxMutesSaturation,
        opts,
    );
    palette.DarkMuted = findColorVariation(
        palette,
        swatches,
        maxPopulation,
        opts.targetDarkLuma,
        0,
        opts.maxDarkLuma,
        opts.targetMutesSaturation,
        0,
        opts.maxMutesSaturation,
        opts,
    );

    return palette;
};

const generateEmptySwatches = (
    palette: Palette,
    opts: GeneratorOptions,
): void => {
    // Vibrant 系がすべて欠落している場合のフォールバック
    if (!palette.Vibrant && !palette.DarkVibrant && !palette.LightVibrant) {
        if (!palette.DarkVibrant && palette.DarkMuted) {
            const [h, s] = palette.DarkMuted.hsl;
            palette.DarkVibrant = new Swatch(
                hslToRgb(h, s, opts.targetDarkLuma),
                0,
            );
        }
        if (!palette.LightVibrant && palette.LightMuted) {
            const [h, s] = palette.LightMuted.hsl;
            // オリジナルと同じ動作を保持（targetDarkLuma を使う）
            palette.DarkVibrant = new Swatch(
                hslToRgb(h, s, opts.targetDarkLuma),
                0,
            );
        }
    }
    if (!palette.Vibrant && palette.DarkVibrant) {
        const [h, s] = palette.DarkVibrant.hsl;
        palette.Vibrant = new Swatch(hslToRgb(h, s, opts.targetNormalLuma), 0);
    } else if (!palette.Vibrant && palette.LightVibrant) {
        const [h, s] = palette.LightVibrant.hsl;
        palette.Vibrant = new Swatch(hslToRgb(h, s, opts.targetNormalLuma), 0);
    }
    if (!palette.DarkVibrant && palette.Vibrant) {
        const [h, s] = palette.Vibrant.hsl;
        palette.DarkVibrant = new Swatch(
            hslToRgb(h, s, opts.targetDarkLuma),
            0,
        );
    }
    if (!palette.LightVibrant && palette.Vibrant) {
        const [h, s] = palette.Vibrant.hsl;
        palette.LightVibrant = new Swatch(
            hslToRgb(h, s, opts.targetLightLuma),
            0,
        );
    }
    if (!palette.Muted && palette.Vibrant) {
        const [h, s] = palette.Vibrant.hsl;
        palette.Muted = new Swatch(hslToRgb(h, s, opts.targetNormalLuma), 0);
    }
    if (!palette.DarkMuted && palette.DarkVibrant) {
        const [h, s] = palette.DarkVibrant.hsl;
        palette.DarkMuted = new Swatch(hslToRgb(h, s, opts.targetDarkLuma), 0);
    }
    if (!palette.LightMuted && palette.LightVibrant) {
        const [h, s] = palette.LightVibrant.hsl;
        palette.LightMuted = new Swatch(
            hslToRgb(h, s, opts.targetLightLuma),
            0,
        );
    }
};

/**
 * Swatch 配列からデフォルトの6色パレットを生成するジェネレータ
 *
 * 各スロットに対して HSL 範囲と彩度・明度ターゲットへの近さ・人口による
 * 加重平均スコアで最適な Swatch を選択する。
 */
export const DefaultGenerator: Generator = (
    swatches: Swatch[],
    opts?: object,
): Palette => {
    const resolvedOpts: GeneratorOptions = Object.assign(
        {},
        DEFAULT_OPTS,
        opts,
    );
    const maxPopulation = findMaxPopulation(swatches);
    const palette = generateVariationColors(
        swatches,
        maxPopulation,
        resolvedOpts,
    );
    generateEmptySwatches(palette, resolvedOpts);
    return palette;
};
