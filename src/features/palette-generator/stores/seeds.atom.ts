import { atom } from "jotai";

import { oklchToHex } from "../usecases/oklch-utils";
import { selectSeeds } from "../usecases/seed-selection";
import { visionResultAtom } from "./vision-result.atom";

export const seedsAtom = atom((get) => {
  const vr = get(visionResultAtom);
  if (!vr) return null;

  const seeds = selectSeeds(vr);
  return {
    primary: seeds.primary,
    secondary: seeds.secondary,
    primaryHex: oklchToHex(seeds.primary.l, seeds.primary.c, seeds.primary.h),
    secondaryHex: oklchToHex(
      seeds.secondary.l,
      seeds.secondary.c,
      seeds.secondary.h,
    ),
  };
});
