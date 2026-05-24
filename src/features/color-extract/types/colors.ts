export type Palette = "salience" | "ansi" | "kmeans";

export type Style = "dark" | "light";

export type ExtractConfig = {
  palette: Palette;
  style: Style;
  use16cols?: boolean;
  dynamic?: boolean;
  threshold?: number;
  checkContrast?: boolean;
  saturation?: number;
  k?: number;
  minDist?: number;
};

export type Colors = {
  background: string;
  foreground: string;
  cursor: string;
  color0: string;
  color1: string;
  color2: string;
  color3: string;
  color4: string;
  color5: string;
  color6: string;
  color7: string;
  color8: string;
  color9: string;
  color10: string;
  color11: string;
  color12: string;
  color13: string;
  color14: string;
  color15: string;
};
