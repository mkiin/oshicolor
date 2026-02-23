import type { Swatch } from "@oshicolor/color";
import { ZONE_SPECS } from "@oshicolor/core";
import { converter } from "culori";

import type { HueCoverage, SignatureColor, ToneProfile } from "./types";

const toOklch = converter("oklch");

/** OKLch C がこの値未満のスウォッチは無彩色として扱う */
const ACHROMATIC_C_THRESHOLD = 0.04;

/** シグネチャカラー候補の最低 C 値 */
const SIGNATURE_MIN_C = 0.06;
/** シグネチャカラー候補の明度範囲 */
const SIGNATURE_MIN_L = 0.35;
const SIGNATURE_MAX_L = 0.88;

/**
 * 画像を代表するシグネチャカラーを選ぶ
 *
 * スコア: C² × (pop / maxPop)。
 * l ∈ [0.35, 0.88]、c ≥ 0.06 でフィルタ。
 * 適合色がない場合は null を返す。
 *
 * @param swatches - 量子化で得た全 Swatch
 */
export const analyzeSignatureColor = (
    swatches: Swatch[],
): SignatureColor | null => {
    const maxPop = swatches.reduce((m, s) => Math.max(m, s.population), 0);

    let bestScore = -Infinity;
    let bestSwatch: Swatch | null = null;
    let bestL = 0;
    let bestC = 0;
    let bestH = 0;

    for (const swatch of swatches) {
        const oklch = toOklch({
            mode: "rgb",
            r: swatch.r / 255,
            g: swatch.g / 255,
            b: swatch.b / 255,
        });
        if (!oklch) continue;

        const l = oklch.l;
        const c = oklch.c;
        const h = oklch.h;

        if (l < SIGNATURE_MIN_L || l > SIGNATURE_MAX_L) continue;
        if (c < SIGNATURE_MIN_C) continue;
        // h が undefined = 無彩色なのでスキップ
        if (h === undefined) continue;

        const score = c * c * (swatch.population / maxPop);
        if (score > bestScore) {
            bestScore = score;
            bestSwatch = swatch;
            bestL = l;
            bestC = c;
            bestH = h;
        }
    }

    if (!bestSwatch) return null;

    return {
        hex: bestSwatch.hex.toLowerCase(),
        l: bestL,
        c: bestC,
        h: bestH,
    };
};

/**
 * 画像の「空気感」= トーンプロファイルを分析する
 *
 * characterSaturation: 有彩色スウォッチの population 加重平均 OKLch C。
 * 高い値（0.15+）は鮮やかなキャラクター、低い値（0.05 前後）はくすみ系。
 *
 * temperatureSign: 低彩度スウォッチの Hue 偏りから背景の色温度を推定する。
 *
 * @param swatches - 量子化で得た全 Swatch
 */
export const analyzeToneProfile = (swatches: Swatch[]): ToneProfile => {
    let weightedC = 0;
    let totalPop = 0;
    let warmScore = 0;
    let coolScore = 0;

    for (const swatch of swatches) {
        const oklch = toOklch({
            mode: "rgb",
            r: swatch.r / 255,
            g: swatch.g / 255,
            b: swatch.b / 255,
        });
        if (!oklch) continue;

        const c = oklch.c;
        const h = oklch.h;
        const pop = swatch.population;

        if (c >= ACHROMATIC_C_THRESHOLD) {
            // 有彩色: characterSaturation の計算に使う
            weightedC += c * pop;
            totalPop += pop;
        } else if (h !== undefined) {
            // ニュートラル色: Hue 偏りから温度感を判定する
            // 赤〜オレンジ〜黄色系 (0°–80°, 330°–360°) → warm
            const normH = ((h % 360) + 360) % 360;
            if (normH < 80 || normH > 330) {
                warmScore += pop;
            } else {
                coolScore += pop;
            }
        }
    }

    const characterSaturation = totalPop > 0 ? weightedC / totalPop : 0;

    let temperatureSign: "warm" | "cool" | "neutral" = "neutral";
    if (warmScore > coolScore * 1.5) {
        temperatureSign = "warm";
    } else if (coolScore > warmScore * 1.5) {
        temperatureSign = "cool";
    }

    return { characterSaturation, temperatureSign };
};

/**
 * HueZone パレットから有効なゾーン数を診断する
 *
 * @param hueZonePalette - HueZoneGenerator が生成したパレット
 * @returns 有効ゾーン数と各ゾーンの有効フラグ
 */
export const diagnoseHueCoverage = (
    hueZonePalette: Record<string, { hex: string } | null | undefined>,
): HueCoverage => {
    const zones: Record<string, boolean> = {};
    let coveredCount = 0;

    for (const { slot } of ZONE_SPECS) {
        const covered =
            hueZonePalette[slot] !== null && hueZonePalette[slot] !== undefined;
        zones[slot] = covered;
        if (covered) coveredCount++;
    }

    return { coveredCount, zones };
};
