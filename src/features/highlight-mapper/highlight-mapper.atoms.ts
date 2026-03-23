import type { SwatchRole } from "colorthief";
import { atom } from "jotai";
import {
  seedColorsAtom,
  colorSwatchesAtom,
} from "@/features/color-extractor/color-extractor.atoms";
import { buildHighlightMap } from "./core/build-highlight-map";
import { toColorTokens } from "./core/to-color-tokens";
import type { HighlightBundle } from "./highlight-mapper.types";
import type { NeovimColorTokens } from "@/features/neovim-preview/neovim-preview.types";

/** neutral 源として使う swatch ロール（タブ切り替え用） */
const NEUTRAL_SOURCE_ROLES: SwatchRole[] = ["DarkMuted", "Muted", "LightMuted"];

export type NeutralSourceTab = {
  role: SwatchRole;
  hex: string;
};

/** swatch から neutral 源の候補タブ一覧を導出する（null の swatch は除外） */
export const neutralSourceTabsAtom = atom<Promise<NeutralSourceTab[] | null>>(
  async (get) => {
    const swatches = await get(colorSwatchesAtom);
    if (!swatches) return null;

    const tabs: NeutralSourceTab[] = [];
    for (const role of NEUTRAL_SOURCE_ROLES) {
      const swatch = swatches[role];
      if (swatch) {
        tabs.push({ role, hex: swatch.color.hex() });
      }
    }
    return tabs.length > 0 ? tabs : null;
  },
);

/** 現在選択中の neutral 源 swatch ロール */
export const activeNeutralRoleAtom = atom<SwatchRole>("DarkMuted");

/** 選択中の neutral 源の hue を使って HighlightBundle を生成する */
export const highlightBundleAtom = atom<Promise<HighlightBundle | null>>(
  async (get) => {
    const seeds = await get(seedColorsAtom);
    const swatches = await get(colorSwatchesAtom);
    if (!seeds || !swatches) return null;

    const activeRole = get(activeNeutralRoleAtom);
    const swatch = swatches[activeRole];
    const hueOverride = swatch ? swatch.color.oklch().h : undefined;

    return buildHighlightMap(seeds, swatches, hueOverride);
  },
);

/** HighlightBundle → NeovimColorTokens */
export const neovimColorTokensAtom = atom<Promise<NeovimColorTokens | null>>(
  async (get) => {
    const bundle = await get(highlightBundleAtom);
    if (!bundle) return null;
    return toColorTokens(bundle);
  },
);
