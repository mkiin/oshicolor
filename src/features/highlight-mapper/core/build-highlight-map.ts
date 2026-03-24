import type { HighlightBundle, RoleMap } from "../highlight-mapper.types";
import { generateNeutralPalette } from "./neutral-palette";
import { ensureContrast, CONTRAST_AA, CONTRAST_SUBDUED } from "./fg-adjuster";
import { generateDiagnosticColors } from "./diagnostic-colors";
import { mapHighlightGroups } from "./highlight-groups";
import { hexToOklch } from "./oklch-utils";

/**
 * neutral palette 内の fg 系色に WCAG コントラスト保証を適用する
 */
const adjustNeutralContrast = (
  neutral: ReturnType<typeof generateNeutralPalette>,
): ReturnType<typeof generateNeutralPalette> => ({
  ...neutral,
  comment: ensureContrast(neutral.comment, neutral.bg, CONTRAST_SUBDUED),
  dim: ensureContrast(neutral.dim, neutral.bg, CONTRAST_SUBDUED),
  border: ensureContrast(neutral.border, neutral.bg, CONTRAST_SUBDUED),
  fg: ensureContrast(neutral.fg, neutral.bg, CONTRAST_AA),
});

/**
 * diagnostic 4色に WCAG コントラスト保証を適用する
 */
const adjustDiagnosticContrast = (
  diagnostic: ReturnType<typeof generateDiagnosticColors>,
  bgHex: string,
): ReturnType<typeof generateDiagnosticColors> => ({
  error: ensureContrast(diagnostic.error, bgHex, CONTRAST_AA),
  warn: ensureContrast(diagnostic.warn, bgHex, CONTRAST_AA),
  info: ensureContrast(diagnostic.info, bgHex, CONTRAST_AA),
  hint: ensureContrast(diagnostic.hint, bgHex, CONTRAST_AA),
});

/**
 * neutral hue から HighlightBundle を生成する
 *
 * TODO: syntax 色は現在 neutral.fg のフォールバック。node-vibrant 統合時に再設計する
 */
export const buildHighlightMap = (
  neutralHex: string,
  neutralHue: number,
): HighlightBundle => {
  const neutralOklch = hexToOklch(neutralHex);
  const overriddenOklch = { ...neutralOklch, h: neutralHue };

  const rawNeutral = generateNeutralPalette(overriddenOklch);
  const neutral = adjustNeutralContrast(rawNeutral);
  const rawDiagnostic = generateDiagnosticColors(overriddenOklch);
  const diagnostic = adjustDiagnosticContrast(rawDiagnostic, neutral.bg);

  const placeholderRoles: RoleMap = {
    accent: neutral.fg,
    keyword: neutral.fg,
    function: neutral.fg,
    string: neutral.fg,
    operator: neutral.fg,
    type: neutral.fg,
    number: neutral.fg,
  };

  const highlights = mapHighlightGroups(placeholderRoles, neutral, diagnostic);

  return {
    seeds: [neutralHex],
    neutral,
    diagnostic,
    highlights,
  };
};
