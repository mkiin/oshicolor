import type { AccentPalette, ThemeTone } from "./accent-palette";
import type { NeutralPalette } from "./neutral-palette";
import type { UiColors } from "./ui-colors";

/** パレット生成の最終出力 */
type PaletteResult = {
  theme_tone: ThemeTone;
  neutral: NeutralPalette;
  accent: AccentPalette;
  ui: UiColors;
};

export type { PaletteResult };
