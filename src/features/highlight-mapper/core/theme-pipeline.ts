import type { HighlightBundle, RoleMap } from "../highlight-mapper.types";
import { neutralPaletteFrom } from "./neutral-palette";
import { ensureContrast, CONTRAST_AA, CONTRAST_SUBDUED } from "@/lib/contrast";
import { diagnosticColorsFrom } from "./diagnostic-colors";
import { highlightGroupsFrom } from "./highlight-groups";
import { hexToOklch } from "@/lib/oklch";

/**
 * neutral palette 内の fg 系色に WCAG コントラスト保証を適用する
 */
const withNeutralContrast = (
  neutral: ReturnType<typeof neutralPaletteFrom>,
): ReturnType<typeof neutralPaletteFrom> => ({
  ...neutral,
  comment: ensureContrast(neutral.comment, neutral.bg, CONTRAST_SUBDUED),
  dim: ensureContrast(neutral.dim, neutral.bg, CONTRAST_SUBDUED),
  border: ensureContrast(neutral.border, neutral.bg, CONTRAST_SUBDUED),
  fg: ensureContrast(neutral.fg, neutral.bg, CONTRAST_AA),
});

/**
 * diagnostic 4色に WCAG コントラスト保証を適用する
 */
const withDiagnosticContrast = (
  diagnostic: ReturnType<typeof diagnosticColorsFrom>,
  bgHex: string,
): ReturnType<typeof diagnosticColorsFrom> => ({
  error: ensureContrast(diagnostic.error, bgHex, CONTRAST_AA),
  warn: ensureContrast(diagnostic.warn, bgHex, CONTRAST_AA),
  info: ensureContrast(diagnostic.info, bgHex, CONTRAST_AA),
  hint: ensureContrast(diagnostic.hint, bgHex, CONTRAST_AA),
});

/**
 * neutral hex + hue からテーマカラー一式を組み立てる
 *
 * TODO: syntax 色は現在 neutral.fg のフォールバック。node-vibrant 統合時に再設計する
 */
export const themeColorsFrom = (
  neutralHex: string,
  neutralHue: number,
): HighlightBundle => {
  const neutralOklch = hexToOklch(neutralHex);
  const overriddenOklch = { ...neutralOklch, h: neutralHue };

  const rawNeutral = neutralPaletteFrom(overriddenOklch);
  const neutral = withNeutralContrast(rawNeutral);
  const rawDiagnostic = diagnosticColorsFrom(overriddenOklch);
  const diagnostic = withDiagnosticContrast(rawDiagnostic, neutral.bg);

  const placeholderRoles: RoleMap = {
    accent: neutral.fg,
    keyword: neutral.fg,
    function: neutral.fg,
    string: neutral.fg,
    operator: neutral.fg,
    type: neutral.fg,
    number: neutral.fg,
  };

  const highlights = highlightGroupsFrom(placeholderRoles, neutral, diagnostic);

  return {
    seeds: [neutralHex],
    neutral,
    diagnostic,
    highlights,
  };
};
