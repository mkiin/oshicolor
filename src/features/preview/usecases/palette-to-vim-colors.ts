/**
 * Palette → VimPreview 内部カラー変換
 *
 * Palette の neutral / ui スロットを VimPreview の各パーツにマッピングする。
 */

import type { Palette } from "@/features/palette-design";

export type VimColors = {
  bg: string;
  fg: string;
  gutterBg: string;
  gutterFg: string;
  cursorLineBg: string;
  cursorLineNrFg: string;
  selectionBg: string;
  tabBg: string;
  tabFg: string;
  tabActiveBg: string;
  tabActiveFg: string;
  statusBg: string;
  statusFg: string;
  modeBg: string;
  modeFg: string;
  modeVisualBg: string;
};

export const paletteToVimColors = (palette: Palette): VimColors => ({
  bg: palette.neutral.bg,
  fg: palette.neutral.text,
  gutterBg: palette.neutral.bg,
  gutterFg: palette.neutral.subtle,
  cursorLineBg: palette.neutral.highlight,
  cursorLineNrFg: palette.neutral.bright,
  selectionBg: palette.neutral.overlay,
  tabBg: palette.neutral.surface,
  tabFg: palette.neutral.dim,
  tabActiveBg: palette.neutral.bg,
  tabActiveFg: palette.neutral.bright,
  statusBg: palette.neutral.surface,
  statusFg: palette.neutral.dim,
  modeBg: palette.ui.primary,
  modeFg: palette.neutral.bg,
  modeVisualBg: palette.ui.secondary,
});
