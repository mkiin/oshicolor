import type { Color } from "colorthief";
import type { HighlightBundle } from "../highlight-mapper.types";
import { generateNeutralPalette } from "./neutral-palette";
import { adjustFgLightness } from "./fg-adjuster";
import { generateDiagnosticColors } from "./diagnostic-colors";
import { mapHighlightGroups } from "./highlight-groups";

/**
 * ドミナント 5色から HighlightBundle を生成する
 *
 * 純粋関数。副作用なし。
 * seeds[0] (primary) → neutral palette + diagnostic の tone 基準
 * seeds[0..4] → fg 色調整 → 66 ハイライトグループへマッピング
 */
export const buildHighlightMap = (seeds: Color[]): HighlightBundle => {
  const primaryOklch = seeds[0].oklch();

  const neutral = generateNeutralPalette(primaryOklch);
  const diagnostic = generateDiagnosticColors(primaryOklch);

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
