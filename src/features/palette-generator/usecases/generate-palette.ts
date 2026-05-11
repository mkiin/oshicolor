/**
 * パレット生成パイプライン
 *
 * VisionResult + ThemeMood → Palette
 */

import type { Palette, ThemeMood } from "../types/palette";
import type { VisionResult } from "../types/vision-result";

import { MOOD_PRESET } from "./config";
import { generateDiagnostic } from "./diagnostic";
import { generateNeutral } from "./neutral";
import { oklchToHex } from "./oklch-utils";
import { selectSeeds } from "./seed-selection";
import { generateSyntax } from "./syntax";
import { generateUi } from "./ui";

export const generatePalette = (
  input: VisionResult,
  mood: ThemeMood,
): Palette => {
  const preset = MOOD_PRESET[mood];
  const seeds = selectSeeds(input);

  const neutral = generateNeutral(seeds.primary.h, preset);
  const bgHex = neutral.bg;

  const syntax = generateSyntax(seeds.primary, seeds.secondary, preset, bgHex);
  const ui = generateUi(seeds.primary, seeds.secondary, preset, bgHex);
  const diagnostic = generateDiagnostic(seeds.primary.c, preset, bgHex);

  return {
    mood,
    tone: preset.tone,
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
