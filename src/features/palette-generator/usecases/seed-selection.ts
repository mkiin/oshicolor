/**
 * Seed 選定
 *
 * AI impression 3色から seed 2色を選ぶ。
 * primary + (se/te のうちスコアが高い方)。
 * score = hueDist × lUsability で、bg/fg に被る色を避ける。
 */

import type { Oklch } from "../types/palette";
import type { VisionResult } from "../types/vision-result";

import { hexToOklch, hueDist } from "./oklch-utils";

/**
 * L の使いやすさスコア (0.1〜1.0)
 *
 * 0.30-0.75 が最適ゾーン。bg/fg に近い極端な L はペナルティ。
 */
const lUsability = (l: number): number => {
  if (l < 0.2) return 0.1;
  if (l < 0.3) return 0.5;
  if (l <= 0.75) return 1.0;
  if (l <= 0.85) return 0.5;
  return 0.1;
};

/** seed 候補のスコア = hue 距離 × L の使いやすさ */
const seedScore = (primary: Oklch, candidate: Oklch): number =>
  hueDist(primary.h, candidate.h) * lUsability(candidate.l);

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

  const secScore = seedScore(pri, sec);
  const terScore = seedScore(pri, ter);
  const chosen = secScore >= terScore ? sec : ter;

  const stablePri = stabilizeHue(pri, chosen);
  const stableSec = stabilizeHue(chosen, stablePri);

  return { primary: stablePri, secondary: stableSec };
};
