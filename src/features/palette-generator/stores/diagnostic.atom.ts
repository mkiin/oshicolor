import type { DiagnosticSlot } from "../types/palette";

import { atom } from "jotai";

import { generateDiagnostic } from "../usecases/diagnostic";
import { neutralAtom } from "./neutral.atom";
import { seedsAtom } from "./seeds.atom";
import { visionResultAtom } from "./vision-result.atom";

export const diagnosticAtom = atom<Record<DiagnosticSlot, string> | null>(
  (get) => {
    const vr = get(visionResultAtom);
    const seeds = get(seedsAtom);
    const neutral = get(neutralAtom);
    if (!vr || !seeds || !neutral) return null;
    return generateDiagnostic(seeds.primary.c, vr.theme_tone, neutral.bg);
  },
);
