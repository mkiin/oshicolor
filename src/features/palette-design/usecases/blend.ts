/**
 * sRGB 線形補間 (Catppuccin 準拠)
 *
 * blend(accent, base, ratio) = ratio * accent + (1 - ratio) * base
 */

import { hexToSrgb } from "./oklch-utils";

const toHex2 = (n: number): string => {
  const clamped = Math.round(Math.min(Math.max(n, 0), 1) * 255);
  return clamped.toString(16).padStart(2, "0");
};

export const blend = (
  accentHex: string,
  baseHex: string,
  ratio: number,
): string => {
  const a = hexToSrgb(accentHex);
  const b = hexToSrgb(baseHex);

  const r = ratio * a.r + (1 - ratio) * b.r;
  const g = ratio * a.g + (1 - ratio) * b.g;
  const bl = ratio * a.b + (1 - ratio) * b.b;

  return `#${toHex2(r)}${toHex2(g)}${toHex2(bl)}`;
};
