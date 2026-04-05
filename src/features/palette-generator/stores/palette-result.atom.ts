import type { PaletteResult } from "../types/palette-result";

import { atom } from "jotai";

import { generatePalette } from "../usecases/generate-palette";
import { visionResultAtom } from "./vision-result.atom";

/** VisionResult から PaletteResult を派生する atom */
export const paletteResultAtom = atom<PaletteResult | null>((get) => {
  const vision = get(visionResultAtom);
  if (!vision) return null;
  return generatePalette(vision);
});
