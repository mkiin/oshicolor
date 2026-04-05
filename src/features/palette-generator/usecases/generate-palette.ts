/**
 * パレット生成パイプライン
 *
 * VisionResult → Palette
 */

import type { Palette } from "../types/palette";
import type { VisionResult } from "../types/vision-result";

import { generateDiagnostic } from "./diagnostic";
import { generateNeutral } from "./neutral";
import { oklchToHex } from "./oklch-utils";
import { selectSeeds } from "./seed-selection";
import { generateSyntax } from "./syntax";
import { generateUi } from "./ui";

export const generatePalette = (input: VisionResult): Palette => {
  const { tone } = { tone: input.theme_tone };
  const seeds = selectSeeds(input);

  const neutral = generateNeutral(seeds.primary.h, tone);
  const bgHex = neutral.bg;

  const syntax = generateSyntax(seeds.primary, seeds.secondary, tone, bgHex);
  const ui = generateUi(seeds.primary, seeds.secondary, bgHex);
  const diagnostic = generateDiagnostic(seeds.primary.c, tone, bgHex);

  return {
    tone,
    seeds: {
      primary: oklchToHex(seeds.primary.l, seeds.primary.c, seeds.primary.h),
      secondary: oklchToHex(
        seeds.secondary.l,
        seeds.secondary.c,
        seeds.secondary.h,
      ),
    },
    neutral,
    syntax,
    ui,
    diagnostic,
  };
};
