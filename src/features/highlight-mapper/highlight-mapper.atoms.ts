import { atom } from "jotai";
import { colorSwatchesAtom } from "@/features/color-extractor/color-extractor.atoms";
import { themeColorsFrom } from "./core/theme-pipeline";
import { toColorTokens } from "./core/preview-tokens";
import { generateLuaColorscheme } from "@/features/lua-generator/lua-generator";
import { hexToOklch } from "@/lib/oklch";
import type { HighlightBundle } from "./highlight-mapper.types";
import type { NeovimColorTokens } from "@/features/neovim-preview/neovim-preview.types";

/** neutral 源として使う swatch ロール */
export const NEUTRAL_ROLES = ["DarkMuted", "Muted", "LightMuted"] as const;

export type NeutralRole = (typeof NEUTRAL_ROLES)[number];

/** 現在選択中の neutral 源 swatch ロール */
export const activeNeutralRoleAtom = atom<NeutralRole>("DarkMuted");

/** 選択中 neutral swatch からテーマカラーを生成する */
export const themeColorsAtom = atom<Promise<HighlightBundle | null>>(
  async (get) => {
    const palette = await get(colorSwatchesAtom);
    if (!palette) return null;

    const activeRole = get(activeNeutralRoleAtom);
    const swatch = palette[activeRole];
    if (!swatch) return null;

    const hex = swatch.hex;
    const hue = hexToOklch(hex).h;

    return themeColorsFrom(hex, hue);
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
