import type { NeutralSlot } from "../types/palette";

import { atom } from "jotai";

import { generateNeutral } from "../usecases/neutral";
import { seedsAtom } from "./seeds.atom";
import { visionResultAtom } from "./vision-result.atom";

export const neutralAtom = atom<Record<NeutralSlot, string> | null>((get) => {
  const vr = get(visionResultAtom);
  const seeds = get(seedsAtom);
  if (!vr || !seeds) return null;
  return generateNeutral(seeds.primary.h, vr.theme_tone);
});
