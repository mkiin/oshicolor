/** OKLCH 値 */
type Oklch = { l: number; c: number; h: number };

/** Oklab 値 (距離計算用) */
type Oklab = { l: number; a: number; b: number };

/** 色相環上のギャップ */
type HueGap = { start: number; end: number; size: number };

/** テーマトーン */
type ThemeTone = "dark" | "light";

/** accent 8色 + variant 2色 */
type AccentPalette = {
  color1: string;
  color1_variant: string;
  color2: string;
  color3: string;
  color3_variant: string;
  color4: string;
  color5: string;
  color6: string;
  color7: string;
  color8: string;
};

export type { Oklch, Oklab, HueGap, ThemeTone, AccentPalette };
