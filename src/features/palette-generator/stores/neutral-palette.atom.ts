import type { NeutralPalette } from "../types/neutral-palette";

import { atom } from "jotai";

import { paletteResultAtom } from "./palette-result.atom";

/** neutral パレット (PaletteResult から派生) */
export const neutralPaletteAtom = atom<NeutralPalette | null>((get) => {
  const result = get(paletteResultAtom);
  return result?.neutral ?? null;
});
