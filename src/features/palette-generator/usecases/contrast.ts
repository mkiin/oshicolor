/**
 * WCAG 2.x コントラスト保証
 */

import * as culori from "culori";

import { hexToOklch, toHex } from "./oklch-utils";

const lin = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

/** sRGB 相対輝度 */
export const relativeLuminance = (hex: string): number => {
  const rgb = culori.rgb(hex);
  if (!rgb) return 0;
  return (
    0.2126 * lin(Math.max(0, rgb.r)) +
    0.7152 * lin(Math.max(0, rgb.g)) +
    0.0722 * lin(Math.max(0, rgb.b))
  );
};

/** コントラスト比 */
export const contrastRatio = (hex1: string, hex2: string): number => {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

/**
 * fg の L を調整して bg とのコントラスト比 >= minRatio を保証する。
 * bg の L から探索方向を自動判定。
 */
export const ensureContrast = (
  fgHex: string,
  bgHex: string,
  minRatio: number,
): string => {
  if (contrastRatio(fgHex, bgHex) >= minRatio) return fgHex;
  const fg = hexToOklch(fgHex);
  const bgL = hexToOklch(bgHex).l;
  const step = 0.01;

  if (bgL < 0.5) {
    for (let ll = fg.l + step; ll <= 0.95; ll += step) {
      const hex = toHex(ll, fg.c, fg.h);
      if (contrastRatio(hex, bgHex) >= minRatio) return hex;
    }
    return toHex(0.95, fg.c, fg.h);
  }
  for (let ll = fg.l - step; ll >= 0.05; ll -= step) {
    const hex = toHex(ll, fg.c, fg.h);
    if (contrastRatio(hex, bgHex) >= minRatio) return hex;
  }
  return toHex(0.05, fg.c, fg.h);
};
