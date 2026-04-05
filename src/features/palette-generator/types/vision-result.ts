/** AI Vision の出力（color-analyzer が返す型） */
type VisionResult = {
  impression: {
    primary: { hex: string; reason: string };
    secondary: { hex: string; reason: string };
    tertiary: { hex: string; reason: string };
  };
  theme_tone: "dark" | "light";
  neutral: {
    bg_base_hex: string;
    fg_base_hex: string;
  };
};

export type { VisionResult };
