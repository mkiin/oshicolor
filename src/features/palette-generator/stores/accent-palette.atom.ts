import type { AccentPalette } from "../types/accent-palette";

import { atom } from "jotai";

import { paletteResultAtom } from "./palette-result.atom";

/** accent パレット (PaletteResult から派生) */
export const accentPaletteAtom = atom<AccentPalette | null>((get) => {
  const result = get(paletteResultAtom);
  return result?.accent ?? null;
});
