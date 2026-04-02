import type { HighlightBundle } from "../highlight-mapper.types";
import type { Candidate } from "./candidate-pool";

import { generateDiagnosticColors } from "./diagnostic-colors";
import { ensureContrast, CONTRAST_AA, CONTRAST_SUBDUED } from "./fg-adjuster";
import { mapHighlightGroups } from "./highlight-groups";
import { generateNeutralPalette } from "./neutral-palette";
import { hexToOklch } from "./oklch-utils";
import { assignRoles, type RoleMap, SYNTAX_ROLES } from "./role-assignment";

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
 * RoleMap の全色に WCAG コントラスト保証を適用する
 */
const adjustRoleContrast = (roles: RoleMap, bgHex: string): RoleMap => {
  const adjusted = {} as RoleMap;
  for (const role of SYNTAX_ROLES) {
    adjusted[role] = ensureContrast(roles[role], bgHex, CONTRAST_AA);
  }
  return adjusted;
};

/**
 * 候補プール + neutral hue から HighlightBundle を生成する
 */
export const buildHighlightMap = (
  candidates: Candidate[],
  neutralHue: number,
): HighlightBundle => {
  const neutralOklch = hexToOklch(candidates[0]?.hex ?? "#000000");
  const overriddenOklch = { ...neutralOklch, h: neutralHue };

  const rawNeutral = generateNeutralPalette(overriddenOklch);
  const neutral = adjustNeutralContrast(rawNeutral);
  const rawDiagnostic = generateDiagnosticColors(overriddenOklch);
  const diagnostic = adjustDiagnosticContrast(rawDiagnostic, neutral.bg);

  const rawRoles = assignRoles(candidates, neutralHue);
  const roles = adjustRoleContrast(rawRoles, neutral.bg);
  const highlights = mapHighlightGroups(roles, neutral, diagnostic);

  return {
    seeds: candidates.map((c) => c.hex),
    neutral,
    diagnostic,
    highlights,
  };
};
