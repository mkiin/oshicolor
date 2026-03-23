import type { Color, SwatchMap } from "colorthief";
import type { HighlightBundle } from "../highlight-mapper.types";
import { selectNeutralHue } from "./neutral-source";
import { generateNeutralPalette } from "./neutral-palette";
import { adjustFgLightness } from "./fg-adjuster";
import { generateDiagnosticColors } from "./diagnostic-colors";
import { mapHighlightGroups } from "./highlight-groups";

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
