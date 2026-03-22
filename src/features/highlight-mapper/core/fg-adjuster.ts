import type { OKLCH } from "colorthief";
import { oklchToHex } from "./oklch-utils";

const MIN_FG_LIGHTNESS = 0.65;
const MAX_FG_LIGHTNESS = 0.85;

/**
 * seed の hue/chroma を保ちつつ、bg とのコントラストが取れる L に調整して hex を返す
 *
 * seed の L が MIN_FG_LIGHTNESS 未満なら引き上げ、
 * MAX_FG_LIGHTNESS を超えるなら抑える。
 */
export const adjustFgLightness = (seedOklch: OKLCH): string => {
  const l = Math.min(Math.max(seedOklch.l, MIN_FG_LIGHTNESS), MAX_FG_LIGHTNESS);
  return oklchToHex(l, seedOklch.c, seedOklch.h);
};
