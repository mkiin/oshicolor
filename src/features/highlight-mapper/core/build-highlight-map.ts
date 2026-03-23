import type { Color, SwatchMap } from "colorthief";
import type { HighlightBundle } from "../highlight-mapper.types";
import { selectNeutralHue } from "./neutral-source";
import { generateNeutralPalette } from "./neutral-palette";
import { adjustFgLightness } from "./fg-adjuster";
import { generateDiagnosticColors } from "./diagnostic-colors";
import { mapHighlightGroups } from "./highlight-groups";
import { hexToOklch, oklchToHex } from "./oklch-utils";

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

  const neutral = generateNeutralPalette(overriddenOklch);
  const diagnostic = generateDiagnosticColors(overriddenOklch);

  const seedFgs = seeds.map((seed) => adjustFgLightness(seed.oklch())) as [
    string,
    string,
    string,
    string,
    string,
  ];

  const highlights = mapHighlightGroups(seedFgs, neutral, diagnostic);

  return {
    seeds: seeds.map((s) => s.hex()),
    neutral,
    diagnostic,
    highlights,
  };
};

const MIN_FG_LIGHTNESS = 0.65;
const MAX_FG_LIGHTNESS = 0.85;

/**
 * hex 6色から HighlightBundle を生成する（MCU seed 用）
 *
 * 6色のうち最低 C の色を neutral 源に使い、残り5色を fg に割り当てる。
 */
export const buildHighlightMapFromHex = (
  hexSeeds: string[],
): HighlightBundle => {
  const withOklch = hexSeeds.map((hex) => ({ hex, oklch: hexToOklch(hex) }));

  let neutralIdx = 0;
  let lowestC = withOklch[0].oklch.c;
  for (let i = 1; i < withOklch.length; i++) {
    if (withOklch[i].oklch.c < lowestC) {
      lowestC = withOklch[i].oklch.c;
      neutralIdx = i;
    }
  }

  const neutralOklch = withOklch[neutralIdx].oklch;
  const fgSeeds = withOklch.filter((_, i) => i !== neutralIdx);

  const neutral = generateNeutralPalette(neutralOklch);
  const diagnostic = generateDiagnosticColors(neutralOklch);

  const seedFgs = fgSeeds.map(({ oklch }) => {
    const l = Math.min(Math.max(oklch.l, MIN_FG_LIGHTNESS), MAX_FG_LIGHTNESS);
    return oklchToHex(l, oklch.c, oklch.h);
  }) as [string, string, string, string, string];

  const highlights = mapHighlightGroups(seedFgs, neutral, diagnostic);

  return {
    seeds: hexSeeds,
    neutral,
    diagnostic,
    highlights,
  };
};
