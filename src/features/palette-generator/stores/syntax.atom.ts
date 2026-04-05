import type { SyntaxSlot } from "../types/palette";

import { atom } from "jotai";

import { generateSyntax } from "../usecases/syntax";
import { neutralAtom } from "./neutral.atom";
import { seedsAtom } from "./seeds.atom";
import { visionResultAtom } from "./vision-result.atom";

export const syntaxAtom = atom<Record<SyntaxSlot, string> | null>((get) => {
  const vr = get(visionResultAtom);
  const seeds = get(seedsAtom);
  const neutral = get(neutralAtom);
  if (!vr || !seeds || !neutral) return null;
  return generateSyntax(
    seeds.primary,
    seeds.secondary,
    vr.theme_tone,
    neutral.bg,
  );
});
