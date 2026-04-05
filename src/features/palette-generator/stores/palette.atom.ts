import type { Palette } from "../types/palette";

import { atom } from "jotai";

import { diagnosticAtom } from "./diagnostic.atom";
import { neutralAtom } from "./neutral.atom";
import { seedsAtom } from "./seeds.atom";
import { syntaxAtom } from "./syntax.atom";
import { uiAtom } from "./ui.atom";
import { visionResultAtom } from "./vision-result.atom";

export const paletteAtom = atom<Palette | null>((get) => {
  const vr = get(visionResultAtom);
  const seeds = get(seedsAtom);
  const neutral = get(neutralAtom);
  const syntax = get(syntaxAtom);
  const ui = get(uiAtom);
  const diagnostic = get(diagnosticAtom);

  if (!vr || !seeds || !neutral || !syntax || !ui || !diagnostic) return null;

  return {
    tone: vr.theme_tone,
    seeds: {
      primary: seeds.primaryHex,
      secondary: seeds.secondaryHex,
    },
    neutral,
    syntax,
    ui,
    diagnostic,
  };
});
