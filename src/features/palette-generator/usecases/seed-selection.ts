/**
 * Seed 選定
 *
 * AI impression 3色から seed 2色を選ぶ。
 * primary + (se/te のうち hue が離れている方)。
 */

import type { Oklch } from "../types/palette";
import type { VisionResult } from "../types/vision-result";

import { hexToOklch, hueDist } from "./oklch-utils";

/** 低彩度 seed の hue を安定化する */
const stabilizeHue = (seed: Oklch, reference: Oklch): Oklch => {
  if (seed.c >= 0.015) return seed;
  return { ...seed, h: (reference.h + 180) % 360 };
};

export const selectSeeds = (
  input: VisionResult,
): { primary: Oklch; secondary: Oklch } => {
  const pri = hexToOklch(input.impression.primary.hex);
  const sec = hexToOklch(input.impression.secondary.hex);
  const ter = hexToOklch(input.impression.tertiary.hex);

  const secDist = hueDist(pri.h, sec.h);
  const terDist = hueDist(pri.h, ter.h);
  const chosen = secDist >= terDist ? sec : ter;

  const stablePri = stabilizeHue(pri, chosen);
  const stableSec = stabilizeHue(chosen, stablePri);

  return { primary: stablePri, secondary: stableSec };
};
