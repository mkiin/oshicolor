import type { Palette } from "../types/palette";

import { atom } from "jotai";

import { MOOD_PRESET } from "../usecases/config";
import { diagnosticAtom } from "./diagnostic.atom";
import { moodAtom } from "./mood.atom";
import { neutralAtom } from "./neutral.atom";
import { seedsAtom } from "./seeds.atom";
import { syntaxAtom } from "./syntax.atom";
import { uiAtom } from "./ui.atom";

export const paletteAtom = atom(async (get) => {
  const mood = get(moodAtom);
  const seeds = await get(seedsAtom);
  const neutral = await get(neutralAtom);
  const syntax = await get(syntaxAtom);
  const ui = await get(uiAtom);
  const diagnostic = await get(diagnosticAtom);

  if (!mood || !seeds || !neutral || !syntax || !ui || !diagnostic) return null;

  return {
    mood,
    tone: MOOD_PRESET[mood].tone,
    seeds: {
      primary: seeds.primaryHex,
      secondary: seeds.secondaryHex,
    },
    neutral,
    syntax,
    ui,
    diagnostic,
  } satisfies Palette;
});
