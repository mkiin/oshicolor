import { atom } from "jotai";
import { seedColorsAtom } from "@/features/color-extractor/color-extractor.atoms";
import { buildHighlightMap } from "./core/build-highlight-map";
import { toColorTokens } from "./core/to-color-tokens";
import type { HighlightBundle } from "./highlight-mapper.types";
import type { NeovimColorTokens } from "@/features/neovim-preview/neovim-preview.types";

/** seeds → HighlightBundle（neutral + diagnostic + 66 highlights） */
export const highlightBundleAtom = atom<Promise<HighlightBundle | null>>(
  async (get) => {
    const seeds = await get(seedColorsAtom);
    if (!seeds) return null;
    return buildHighlightMap(seeds);
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
