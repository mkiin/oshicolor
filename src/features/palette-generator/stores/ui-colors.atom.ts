import type { UiColors } from "../types/ui-colors";

import { atom } from "jotai";

import { paletteResultAtom } from "./palette-result.atom";

/** UI カラー (PaletteResult から派生) */
export const uiColorsAtom = atom<UiColors | null>((get) => {
  const result = get(paletteResultAtom);
  return result?.ui ?? null;
});
