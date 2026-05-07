import type { SyntaxSlot } from "../types/palette";

import { atom } from "jotai";

import { MOOD_PRESET } from "../usecases/config";
import { generateSyntax } from "../usecases/syntax";
import { moodAtom } from "./mood.atom";
import { neutralAtom } from "./neutral.atom";
import { seedsAtom } from "./seeds.atom";

export const syntaxAtom = atom(async (get) => {
  const mood = get(moodAtom);
  const seeds = await get(seedsAtom);
  const neutral = await get(neutralAtom);
  if (!mood || !seeds || !neutral) return null;
  return generateSyntax(
    seeds.primary,
    seeds.secondary,
    MOOD_PRESET[mood],
    neutral.bg,
  );
});
