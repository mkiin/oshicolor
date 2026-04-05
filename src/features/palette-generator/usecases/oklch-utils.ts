/**
 * OKLCH / Oklab ユーティリティ
 *
 * culori を利用した色空間変換と距離計算。
 */

import type { Oklch } from "../types/palette";

import { clampChroma, formatHex, parse, converter } from "culori";

const toOklch = converter("oklch");
const toRgb = converter("rgb");

/** hex → Oklch */
export const hexToOklch = (hex: string): Oklch => {
  const parsed = toOklch(parse(hex));
  if (!parsed) return { l: 0, c: 0, h: 0 };
  return { l: parsed.l, c: parsed.c ?? 0, h: parsed.h ?? 0 };
};

/** Oklch → hex (gamut clamp 付き) */
export const oklchToHex = (l: number, c: number, h: number): string => {
  const color = clampChroma({ mode: "oklch", l, c, h }, "oklch");
  return formatHex(color);
};

/** hex → sRGB [0-1] */
export const hexToSrgb = (hex: string): { r: number; g: number; b: number } => {
  const parsed = toRgb(parse(hex));
  if (!parsed) return { r: 0, g: 0, b: 0 };
  return { r: parsed.r, g: parsed.g, b: parsed.b };
};

/** Oklab ユークリッド距離 (deltaE OK) */
export const deltaEOk = (hex1: string, hex2: string): number => {
  const a = toOklch(parse(hex1));
  const b = toOklch(parse(hex2));
  if (!a || !b) return 0;

  const dL = a.l - b.l;
  const aC = a.c ?? 0;
  const bC = b.c ?? 0;
  const aH = ((a.h ?? 0) * Math.PI) / 180;
  const bH = ((b.h ?? 0) * Math.PI) / 180;

  const da = aC * Math.cos(aH) - bC * Math.cos(bH);
  const db = aC * Math.sin(aH) - bC * Math.sin(bH);

  return Math.sqrt(dL * dL + da * da + db * db);
};

/** 数値を範囲内にクランプ */
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/** 色相の circular distance (0-180) */
export const hueDist = (h1: number, h2: number): number => {
  const raw = Math.abs(h1 - h2) % 360;
  return raw > 180 ? 360 - raw : raw;
};
