import type { DiagnosticSlot } from "../types/palette";

import { atom } from "jotai";

import { MOOD_PRESET } from "../usecases/config";
import { generateDiagnostic } from "../usecases/diagnostic";
import { moodAtom } from "./mood.atom";
import { neutralAtom } from "./neutral.atom";
import { seedsAtom } from "./seeds.atom";

export const diagnosticAtom = atom(async (get) => {
  const mood = get(moodAtom);
  const seeds = await get(seedsAtom);
  const neutral = await get(neutralAtom);
  if (!mood || !seeds || !neutral) return null;
  return generateDiagnostic(seeds.primary.c, MOOD_PRESET[mood], neutral.bg);
});
