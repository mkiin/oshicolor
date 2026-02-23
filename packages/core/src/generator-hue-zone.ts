import type { Palette, Swatch } from "@oshicolor/color";
import type { Generator } from "./types";

/** Hue Zone スロットの仕様 */
export type ZoneSpec = {
    /** スロット名（Palette のキーとして使用） */
    slot: string;
    /** 代表 Hue（0–1 スケール、HSL） */
    canonicalH: number;
    /** Hue 許容幅（0–1 スケール）。この幅を超えたスウォッチは即却下 */
    hTolerance: number;
    /** 目標明度（0–1 スケール、HSL） */
    targetL: number;
};

/**
 * Syntax カラーの6ゾーン仕様
 *
 * canonicalH は HSL H (0–1)、hTolerance も同スケール。
 */
export const ZONE_SPECS: readonly ZoneSpec[] = [
    {
        slot: "Function",
        canonicalH: 220 / 360,
        hTolerance: 35 / 360,
        targetL: 0.7,
    },
    {
        slot: "Keyword",
        canonicalH: 275 / 360,
        hTolerance: 35 / 360,
        targetL: 0.7,
    },
    {
        slot: "String",
        canonicalH: 115 / 360,
        hTolerance: 35 / 360,
        targetL: 0.7,
    },
    { slot: "Type", canonicalH: 172 / 360, hTolerance: 22 / 360, targetL: 0.7 },
    {
        slot: "Constant",
        canonicalH: 28 / 360,
        hTolerance: 20 / 360,
        targetL: 0.7,
    },
    {
        slot: "Identifier",
        canonicalH: 68 / 360,
        hTolerance: 23 / 360,
        targetL: 0.7,
    },
];

// ── スコアリング重み ───────────────────────────────────────────────────────────

const W_HUE = 5.0;
const W_L = 3.0;
const W_S = 2.0;
const W_POP = 0.5;

// ── フィルタ閾値 ──────────────────────────────────────────────────────────────

/** 明度の許容下限 */
const MIN_L = 0.4;
/** 明度の許容上限 */
const MAX_L = 0.9;
/** 彩度の最小値 */
const MIN_S = 0.25;

// ── ヘルパー ──────────────────────────────────────────────────────────────────

/**
 * HSL H 軸上の最短距離（0–1 スケール、ラップアラウンド考慮）
 */
const calcHueDist = (a: number, b: number): number => {
    const d = Math.abs(a - b);
    return d > 0.5 ? 1 - d : d;
};

// ── HueZoneGenerator ──────────────────────────────────────────────────────────

/**
 * Hue Zone に基づいて Syntax 用カラーを選択するジェネレータ
 *
 * 各スロット（Function / Keyword / String / Type / Constant / Identifier）について
 * 色相距離・明度・彩度・人口数の加重スコアで最良の Swatch を選ぶ。
 * hTolerance を超える Hue 距離のスウォッチはハードカットオフで除外する。
 * 同一 Swatch の複数スロットへの重複割り当ては防止する。
 */
export const HueZoneGenerator: Generator = (swatches: Swatch[]): Palette => {
    const maxPopulation = swatches.reduce(
        (max, s) => Math.max(max, s.population),
        0,
    );

    const palette: Palette = {
        Vibrant: null,
        DarkVibrant: null,
        LightVibrant: null,
        Muted: null,
        DarkMuted: null,
        LightMuted: null,
    };

    // 複数スロットへの同一 Swatch 重複割り当てを防ぐ
    const selected = new Set<Swatch>();

    for (const zone of ZONE_SPECS) {
        let bestSwatch: Swatch | null = null;
        let bestScore = -Infinity;

        for (const swatch of swatches) {
            if (selected.has(swatch)) continue;

            const [h, s, l] = swatch.hsl;

            // L・S フィルタ
            if (l < MIN_L || l > MAX_L || s < MIN_S) continue;

            // Hue ハードカットオフ
            const hd = calcHueDist(h, zone.canonicalH);
            if (hd > zone.hTolerance) continue;

            // スコア計算
            const hueScore = 1 - hd / zone.hTolerance;
            const lScore = 1 - Math.abs(l - zone.targetL);
            const sScore = s;
            const popScore =
                maxPopulation > 0 ? swatch.population / maxPopulation : 0;

            const score =
                hueScore * W_HUE +
                lScore * W_L +
                sScore * W_S +
                popScore * W_POP;

            if (score > bestScore) {
                bestScore = score;
                bestSwatch = swatch;
            }
        }

        if (bestSwatch) {
            palette[zone.slot] = bestSwatch;
            selected.add(bestSwatch);
        }
    }

    return palette;
};
