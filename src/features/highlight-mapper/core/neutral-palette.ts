import type { NeutralPalette } from "../highlight-mapper.types";
import type { OKLCH } from "colorthief";

import { oklchToHex } from "./oklch-utils";

const NEUTRAL_CHROMA = 0.02;

const NEUTRAL_STEPS: { key: keyof NeutralPalette; l: number }[] = [
  { key: "popup", l: 0.23 },
  { key: "bg", l: 0.24 },
  { key: "surface", l: 0.24 },
  { key: "cursorline", l: 0.3 },
  { key: "visual", l: 0.34 },
  { key: "dim", l: 0.44 },
  { key: "border", l: 0.52 },
  { key: "comment", l: 0.61 },
  { key: "fg", l: 0.88 },
];

/**
 * primary seed の hue を借りて neutral palette を生成する
 *
 * 全段階で同一 hue / chroma、lightness のみ変化。
 * 背景にキャラクターの色味がほんのり乗る。
 */
export const generateNeutralPalette = (primaryOklch: OKLCH): NeutralPalette => {
  const hue = primaryOklch.h;
  const entries = NEUTRAL_STEPS.map(
    ({ key, l }) => [key, oklchToHex(l, NEUTRAL_CHROMA, hue)] as const,
  );
  return Object.fromEntries(entries) as NeutralPalette;
};
