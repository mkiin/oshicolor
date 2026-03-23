import { useMode, modeRgb, modeOklch, type Oklch, parse } from "culori/fn";

const toRgb = useMode(modeRgb);
const toOklch = useMode(modeOklch);

const clamp = (v: number, min: number, max: number): number =>
  Math.min(Math.max(v, min), max);

const toHex = (n: number): string => {
  const clamped = clamp(Math.round(n * 255), 0, 255);
  return clamped.toString(16).padStart(2, "0");
};

/** OkLch (L, C, H) → hex 文字列 */
export const oklchToHex = (l: number, c: number, h: number): string => {
  const oklch: Oklch = { mode: "oklch", l, c, h };
  const rgb = toRgb(oklch);
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
};

export type OklchValues = { l: number; c: number; h: number };

/** hex 文字列 → OkLch { l, c, h } */
export const hexToOklch = (hex: string): OklchValues => {
  const parsed = parse(hex);
  if (!parsed) return { l: 0, c: 0, h: 0 };
  const oklch = toOklch(parsed);
  return { l: oklch.l, c: oklch.c ?? 0, h: oklch.h ?? 0 };
};

/** sRGB チャンネル (0-1) → リニア値 */
const linearize = (c: number): number =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

/** hex → WCAG 相対輝度 (0-1) */
export const relativeLuminance = (hex: string): number => {
  const parsed = parse(hex);
  if (!parsed) return 0;
  const rgb = toRgb(parsed);
  const r = linearize(clamp(rgb.r, 0, 1));
  const g = linearize(clamp(rgb.g, 0, 1));
  const b = linearize(clamp(rgb.b, 0, 1));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** 2色の WCAG コントラスト比 (1-21) */
export const contrastRatio = (hex1: string, hex2: string): number => {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
};
