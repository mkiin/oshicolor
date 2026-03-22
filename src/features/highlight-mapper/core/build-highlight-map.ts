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
 * diagnostic: neutral 源と同じ色の tone を基準にする
 */
export const buildHighlightMap = (
  seeds: Color[],
  swatches: SwatchMap,
): HighlightBundle => {
  const neutralOklch = selectNeutralHue(seeds, swatches);

  const neutral = generateNeutralPalette(neutralOklch);
  const diagnostic = generateDiagnosticColors(neutralOklch);

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
