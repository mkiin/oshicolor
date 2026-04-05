import type { UiSlot } from "../types/palette";

import { atom } from "jotai";

import { generateUi } from "../usecases/ui";
import { neutralAtom } from "./neutral.atom";
import { seedsAtom } from "./seeds.atom";

export const uiAtom = atom<Record<UiSlot, string> | null>((get) => {
  const seeds = get(seedsAtom);
  const neutral = get(neutralAtom);
  if (!seeds || !neutral) return null;
  return generateUi(seeds.primary, seeds.secondary, neutral.bg);
});
