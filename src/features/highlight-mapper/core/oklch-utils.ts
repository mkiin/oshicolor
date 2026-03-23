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

type OklchValues = { l: number; c: number; h: number };

/** hex 文字列 → OkLch { l, c, h } */
export const hexToOklch = (hex: string): OklchValues => {
  const parsed = parse(hex);
  if (!parsed) return { l: 0, c: 0, h: 0 };
  const oklch = toOklch(parsed);
  return { l: oklch.l, c: oklch.c ?? 0, h: oklch.h ?? 0 };
};
