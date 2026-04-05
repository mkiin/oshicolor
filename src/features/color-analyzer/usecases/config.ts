/**
 * color-analyzer の設定
 *
 * プロンプト・モデル・スキーマはドメイン知識（「キャラの色をどう分析するか」）。
 * adapter は AI 呼び出しの薄い層として、この設定を注入される。
 */

import * as v from "valibot";

const HexColor = v.pipe(
  v.string(),
  v.regex(/^#[0-9a-fA-F]{6}$/),
  v.description("Hex color code, e.g. #ff0000"),
);

const ColorImpressionSchema = v.object({
  hex: HexColor,
  reason: v.pipe(
    v.string(),
    v.description("Why this color was chosen from the character's design"),
  ),
});

export const VisionResultSchema = v.object({
  impression: v.pipe(
    v.object({
      primary: v.pipe(
        ColorImpressionSchema,
        v.description("The single most iconic/symbolic color of the character"),
      ),
      secondary: v.pipe(
        ColorImpressionSchema,
        v.description("The second most iconic color"),
      ),
      tertiary: v.pipe(
        ColorImpressionSchema,
        v.description("Third color from the character's design"),
      ),
    }),
    v.description(
      "The character's iconic colors extracted from the illustration (not background)",
    ),
  ),
  theme_tone: v.pipe(
    v.picklist(["dark", "light"]),
    v.description(
      "Choose the background tone that makes the character's colors look natural and comfortable for long reading sessions. Most characters suit dark. Choose light only when the character's palette is overwhelmingly pale or pastel.",
    ),
  ),
  neutral: v.pipe(
    v.object({
      bg_base_hex: v.pipe(
        HexColor,
        v.description(
          "Very dark bg for dark theme (OKLCH L≈0.14, C≈0.015) or very light for light theme (L≈0.95), tinted with the character's dominant hue",
        ),
      ),
      fg_base_hex: v.pipe(
        HexColor,
        v.description(
          "Light text for dark theme (OKLCH L≈0.87, C≈0.012) or dark text for light theme (L≈0.20)",
        ),
      ),
    }),
    v.description("Neutral background and foreground colors for the editor"),
  ),
});

export const COLOR_ANALYZER_CONFIG = {
  model: "gemini-3-flash-preview",
  prompt: `This is a character illustration. Analyze the character's colors for a Neovim color scheme.

Rules:
- impression: the CHARACTER's iconic colors (not background). primary = single most symbolic color
- theme_tone: choose the background tone that makes the character's colors look natural
- neutral: subtly tinted with the character's dominant hue
- Be precise with HEX values — estimate them as accurately as possible from what you see`,
  schema: VisionResultSchema,
} as const;
