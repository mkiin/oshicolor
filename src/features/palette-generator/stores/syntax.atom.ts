import type { SyntaxSlot } from "../types/palette";

import { atom } from "jotai";

import { MOOD_PRESET } from "../usecases/config";
import { generateSyntax } from "../usecases/syntax";
import { moodAtom } from "./mood.atom";
import { neutralAtom } from "./neutral.atom";
import { seedsAtom } from "./seeds.atom";

export const syntaxAtom = atom<Record<SyntaxSlot, string> | null>((get) => {
  const mood = get(moodAtom);
  const seeds = get(seedsAtom);
  const neutral = get(neutralAtom);
  if (!mood || !seeds || !neutral) return null;
  return generateSyntax(
    seeds.primary,
    seeds.secondary,
    MOOD_PRESET[mood],
    neutral.bg,
  );
});
