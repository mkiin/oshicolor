import { useMode, modeRgb, type Oklch } from "culori/fn";

const toRgb = useMode(modeRgb);

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
