/**
 * UI パレット生成
 *
 * seed 2色を ensureContrast して U0, U1 として返す。
 */

import type { Oklch, UiSlot } from "../types/palette";

import type { MoodPreset } from "./config";
import { ensureContrast } from "./contrast";
import { oklchToHex } from "./oklch-utils";

export const generateUi = (
  seed1: Oklch,
  seed2: Oklch,
  preset: MoodPreset,
  bgHex: string,
): Record<UiSlot, string> => ({
  primary: ensureContrast(
    oklchToHex(seed1.l, seed1.c, seed1.h),
    bgHex,
    preset.lcUi,
    preset.chromaBoost,
    preset.chromaDampen,
  ),
  secondary: ensureContrast(
    oklchToHex(seed2.l, seed2.c, seed2.h),
    bgHex,
    preset.lcUi,
    preset.chromaBoost,
    preset.chromaDampen,
  ),
});
