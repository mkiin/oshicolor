import { atom } from "jotai";
import {
  seedColorsAtom,
  colorSwatchesAtom,
} from "@/features/color-extractor/color-extractor.atoms";
import { buildHighlightMap } from "./core/build-highlight-map";
import { toColorTokens } from "./core/to-color-tokens";
import type { HighlightBundle } from "./highlight-mapper.types";
import type { NeovimColorTokens } from "@/features/neovim-preview/neovim-preview.types";

/** seeds + swatches → HighlightBundle */
export const highlightBundleAtom = atom<Promise<HighlightBundle | null>>(
  async (get) => {
    const seeds = await get(seedColorsAtom);
    const swatches = await get(colorSwatchesAtom);
    if (!seeds || !swatches) return null;
    return buildHighlightMap(seeds, swatches);
  },
);

/** HighlightBundle → NeovimColorTokens。route から読んで NeovimPreview に渡す */
export const neovimColorTokensAtom = atom<Promise<NeovimColorTokens | null>>(
  async (get) => {
    const bundle = await get(highlightBundleAtom);
    if (!bundle) return null;
    return toColorTokens(bundle);
  },
);
