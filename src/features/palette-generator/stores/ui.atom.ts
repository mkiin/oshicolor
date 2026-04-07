import type { UiSlot } from "../types/palette";

import { atom } from "jotai";

import { MOOD_PRESET } from "../usecases/config";
import { generateUi } from "../usecases/ui";
import { moodAtom } from "./mood.atom";
import { neutralAtom } from "./neutral.atom";
import { seedsAtom } from "./seeds.atom";

export const uiAtom = atom(async (get) => {
  const mood = get(moodAtom);
  const seeds = await get(seedsAtom);
  const neutral = await get(neutralAtom);
  if (!mood || !seeds || !neutral) return null;
  return generateUi(
    seeds.primary,
    seeds.secondary,
    MOOD_PRESET[mood],
    neutral.bg,
  );
});
