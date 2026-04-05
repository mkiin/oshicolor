import type { NeutralSlot } from "../types/palette";

import { atom } from "jotai";

import { MOOD_PRESET } from "../usecases/config";
import { generateNeutral } from "../usecases/neutral";
import { moodAtom } from "./mood.atom";
import { seedsAtom } from "./seeds.atom";

export const neutralAtom = atom<Record<NeutralSlot, string> | null>((get) => {
  const mood = get(moodAtom);
  const seeds = get(seedsAtom);
  if (!mood || !seeds) return null;
  return generateNeutral(seeds.primary.h, MOOD_PRESET[mood]);
});
