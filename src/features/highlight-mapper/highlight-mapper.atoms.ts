import { atom } from "jotai";
import {
  seedColorsAtom,
  colorSwatchesAtom,
  vibrantPaletteAtom,
} from "@/features/color-extractor/color-extractor.atoms";
import { buildHighlightMap } from "./core/build-highlight-map";
import { toColorTokens } from "./core/to-color-tokens";
import type { HighlightBundle } from "./highlight-mapper.types";
import type { NeovimColorTokens } from "@/features/neovim-preview/neovim-preview.types";

/** colorthief DkMuted/Muted ベースの HighlightBundle */
export const highlightBundleAtom = atom<Promise<HighlightBundle | null>>(
  async (get) => {
    const seeds = await get(seedColorsAtom);
    const swatches = await get(colorSwatchesAtom);
    if (!seeds || !swatches) return null;
    return buildHighlightMap(seeds, swatches);
  },
);

/** node-vibrant DkMuted ベースの HighlightBundle（比較用） */
export const highlightBundleVibrantAtom = atom<Promise<HighlightBundle | null>>(
  async (get) => {
    const seeds = await get(seedColorsAtom);
    const swatches = await get(colorSwatchesAtom);
    const vibrantPalette = await get(vibrantPaletteAtom);
    if (!seeds || !swatches || !vibrantPalette) return null;

    const dkMuted = vibrantPalette.DarkMuted;
    if (!dkMuted) return buildHighlightMap(seeds, swatches);

    const hue = dkMuted.hsl[0] * 360;
    return buildHighlightMap(seeds, swatches, hue);
  },
);

/** colorthief 版 → NeovimColorTokens */
export const neovimColorTokensAtom = atom<Promise<NeovimColorTokens | null>>(
  async (get) => {
    const bundle = await get(highlightBundleAtom);
    if (!bundle) return null;
    return toColorTokens(bundle);
  },
);

/** node-vibrant 版 → NeovimColorTokens（比較用） */
export const neovimColorTokensVibrantAtom = atom<
  Promise<NeovimColorTokens | null>
>(async (get) => {
  const bundle = await get(highlightBundleVibrantAtom);
  if (!bundle) return null;
  return toColorTokens(bundle);
});
