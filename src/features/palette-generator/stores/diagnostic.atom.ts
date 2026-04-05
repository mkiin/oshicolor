import type { DiagnosticSlot } from "../types/palette";

import { atom } from "jotai";

import { MOOD_PRESET } from "../usecases/config";
import { generateDiagnostic } from "../usecases/diagnostic";
import { moodAtom } from "./mood.atom";
import { neutralAtom } from "./neutral.atom";
import { seedsAtom } from "./seeds.atom";

export const diagnosticAtom = atom<Record<DiagnosticSlot, string> | null>(
  (get) => {
    const mood = get(moodAtom);
    const seeds = get(seedsAtom);
    const neutral = get(neutralAtom);
    if (!mood || !seeds || !neutral) return null;
    return generateDiagnostic(seeds.primary.c, MOOD_PRESET[mood], neutral.bg);
  },
);
