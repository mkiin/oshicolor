/**
 * 低彩度入力の補正 (Tinted Gray)
 *
 * Oklab の JND (ΔE_ok ≈ 0.02) に基づき、C が低い入力色の hue を
 * primary から借用して安定化する。
 */

import type { Oklch } from "../types/accent-palette";

import { CONFIG } from "./config";

/**
 * L に応じた低彩度判定閾値
 * 暗い色 (L < 0.3): 閾値を上げる (彩度知覚が低い)
 * 明るい色 (L > 0.85): 閾値を上げる (同上)
 */
const achromaticThreshold = (l: number): number => {
  if (l < 0.3) return 0.035;
  if (l > 0.85) return 0.025;
  return CONFIG.achromaticCBase;
};

/** primary の hue を借用し、低彩度色を Tinted Gray に補正する */
export const stabilizeHue = (seeds: Oklch[]): Oklch[] => {
  const primaryHue = seeds[0].h;
  return seeds.map((s, i) => {
    if (i === 0) return s;
    if (s.c <= achromaticThreshold(s.l)) {
      return { l: s.l, c: CONFIG.tintedGrayC, h: primaryHue };
    }
    return s;
  });
};
