import type { SwatchRole } from "colorthief";
import { atom } from "jotai";
import { colorSwatchesAtom } from "@/features/color-extractor/color-extractor.atoms";
import { buildHighlightMap } from "./core/build-highlight-map";
import { toColorTokens } from "./core/to-color-tokens";
import { generateLuaColorscheme } from "@/features/lua-generator/lua-generator";
import type { HighlightBundle } from "./highlight-mapper.types";
import type { NeovimColorTokens } from "@/features/neovim-preview/neovim-preview.types";

/** neutral 源として使う swatch ロール */
export const NEUTRAL_ROLES: SwatchRole[] = ["DarkMuted", "Muted", "LightMuted"];

/** 現在選択中の neutral 源 swatch ロール */
export const activeNeutralRoleAtom = atom<SwatchRole>("DarkMuted");

/** 選択中 neutral swatch からテーマカラーを生成する */
export const themeColorsAtom = atom<Promise<HighlightBundle | null>>(
  async (get) => {
    const swatches = await get(colorSwatchesAtom);
    if (!swatches) return null;

    const activeRole = get(activeNeutralRoleAtom);
    const swatch = swatches[activeRole];
    if (!swatch) return null;

    const hex = swatch.color.hex();
    const hue = swatch.color.oklch().h;

    return buildHighlightMap(hex, hue);
  },
);

/** テーマカラー → プレビュー用トークン */
export const previewTokensAtom = atom<Promise<NeovimColorTokens | null>>(
  async (get) => {
    const bundle = await get(themeColorsAtom);
    if (!bundle) return null;
    return toColorTokens(bundle);
  },
);

/** テーマカラー → Lua カラースキーム文字列 */
export const luaOutputAtom = atom<Promise<string | null>>(async (get) => {
  const bundle = await get(themeColorsAtom);
  if (!bundle) return null;
  return generateLuaColorscheme(bundle);
});
