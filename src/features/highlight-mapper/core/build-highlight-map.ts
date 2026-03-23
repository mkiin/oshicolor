import type { Color, SwatchMap } from "colorthief";
import type { HighlightBundle } from "../highlight-mapper.types";
import { selectNeutralHue } from "./neutral-source";
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
 * ドミナント 5色 + swatch から HighlightBundle を生成する
 *
 * neutral 源: DkMuted → Muted → dominant C 最低 の優先順で hue を選定
 * neutralHueOverride を渡すと selectNeutralHue をスキップしてその hue を使う
 */
export const buildHighlightMap = (
  seeds: Color[],
  swatches: SwatchMap,
  neutralHueOverride?: number,
): HighlightBundle => {
  const neutralOklch = selectNeutralHue(seeds, swatches);
  const hue = neutralHueOverride ?? neutralOklch.h;
  const overriddenOklch = { ...neutralOklch, h: hue };

  const rawNeutral = generateNeutralPalette(overriddenOklch);
  const neutral = adjustNeutralContrast(rawNeutral);
  const rawDiagnostic = generateDiagnosticColors(overriddenOklch);
  const diagnostic = adjustDiagnosticContrast(rawDiagnostic, neutral.bg);

  const seedFgs = seeds.map((seed) =>
    ensureContrast(seed.hex(), neutral.bg, CONTRAST_AA),
  ) as [string, string, string, string, string];

  const highlights = mapHighlightGroups(seedFgs, neutral, diagnostic);

  return {
    seeds: seeds.map((s) => s.hex()),
    neutral,
    diagnostic,
    highlights,
  };
};

/**
 * hex 色配列から HighlightBundle を生成する
 *
 * neutralHex を neutral 源に、fgHexes (5色) を fg に割り当てる。
 */
export const buildHighlightMapFromHex = (
  neutralHex: string,
  fgHexes: [string, string, string, string, string],
): HighlightBundle => {
  const neutralOklch = hexToOklch(neutralHex);
  const rawNeutral = generateNeutralPalette(neutralOklch);
  const neutral = adjustNeutralContrast(rawNeutral);
  const rawDiagnostic = generateDiagnosticColors(neutralOklch);
  const diagnostic = adjustDiagnosticContrast(rawDiagnostic, neutral.bg);

  const seedFgs = fgHexes.map((hex) =>
    ensureContrast(hex, neutral.bg, CONTRAST_AA),
  ) as [string, string, string, string, string];

  const highlights = mapHighlightGroups(seedFgs, neutral, diagnostic);

  return {
    seeds: [neutralHex, ...fgHexes],
    neutral,
    diagnostic,
    highlights,
  };
};
