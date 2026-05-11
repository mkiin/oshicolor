/** AI Vision の出力 */
type VisionResult = {
  impression: {
    primary: { hex: string; reason: string };
    secondary: { hex: string; reason: string };
    tertiary: { hex: string; reason: string };
  };
  theme_tone: "dark" | "light";
};

export type { VisionResult };
