/**
 * Neutral パレット生成
 *
 * seed primary の hue を tint として N0-N7 を導出する。
 */

import type { NeutralSlot, ThemeTone } from "../types/palette";

import {
  NEUTRAL_C,
  NEUTRAL_L,
  YELLOW_C_OVERRIDE,
  YELLOW_HUE_RANGE,
} from "./config";
import { oklchToHex } from "./oklch-utils";

const SLOTS: readonly NeutralSlot[] = [
  "bg",
  "surface",
  "overlay",
  "highlight",
  "subtle",
  "dim",
  "text",
  "bright",
];

const chromaForIndex = (i: number, bgC: number): number => {
  if (i <= 3) return bgC;
  if (i <= 5) return NEUTRAL_C.mid;
  if (i === 6) return NEUTRAL_C.text;
  return NEUTRAL_C.bright;
};

export const generateNeutral = (
  primaryHue: number,
  tone: ThemeTone,
): Record<NeutralSlot, string> => {
  const isYellow =
    primaryHue >= YELLOW_HUE_RANGE.min && primaryHue <= YELLOW_HUE_RANGE.max;
  const bgC = isYellow ? YELLOW_C_OVERRIDE : NEUTRAL_C.bg;

  const entries = SLOTS.map((slot, i) => {
    const l = NEUTRAL_L[tone][i];
    const c = chromaForIndex(i, bgC);
    return [slot, oklchToHex(l, c, primaryHue)] as const;
  });

  return Object.fromEntries(entries) as Record<NeutralSlot, string>;
};
