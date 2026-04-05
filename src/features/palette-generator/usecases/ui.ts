/**
 * UI パレット生成
 *
 * seed 2色を ensureContrast して U0, U1 として返す。
 */

import type { Oklch, UiSlot } from "../types/palette";

import { LC_UI } from "./config";
import { ensureContrast } from "./contrast";
import { oklchToHex } from "./oklch-utils";

export const generateUi = (
  seed1: Oklch,
  seed2: Oklch,
  bgHex: string,
): Record<UiSlot, string> => ({
  primary: ensureContrast(oklchToHex(seed1.l, seed1.c, seed1.h), bgHex, LC_UI),
  secondary: ensureContrast(
    oklchToHex(seed2.l, seed2.c, seed2.h),
    bgHex,
    LC_UI,
  ),
});
