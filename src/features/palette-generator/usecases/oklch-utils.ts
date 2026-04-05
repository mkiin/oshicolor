/**
 * OKLCH / gamut mapping ユーティリティ
 *
 * Ottosson (2020) "A perceptual color space for image processing"
 */

import type { Oklch } from "../types/accent-palette";

import * as culori from "culori";

/** hex → OKLCH 変換 */
export const hexToOklch = (hex: string): Oklch => {
  const r = culori.oklch(hex);
  return { l: r?.l ?? 0, c: r?.c ?? 0, h: r?.h ?? 0 };
};

/** OKLCH → hex (gamut mapping: culori clampChroma) */
export const toHex = (l: number, c: number, h: number): string =>
  culori.formatHex(
    culori.clampChroma({ mode: "oklch", l, c, h }, "oklch", "rgb"),
  );

/** Oklch → hex */
export const vToHex = (v: Oklch): string => toHex(v.l, v.c, v.h);

/** 値を min〜max に制限する */
export const clamp = (v: number, min: number, max: number): number =>
  Math.min(Math.max(v, min), max);

/** 色相環上の最短距離 (0〜180°) */
export const hueDist = (h1: number, h2: number): number => {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
};
