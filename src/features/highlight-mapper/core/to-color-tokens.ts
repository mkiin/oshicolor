import type { HighlightBundle } from "../highlight-mapper.types";
import type { NeovimColorTokens } from "@/features/neovim-preview/neovim-preview.types";

/** HighlightBundle → NeovimColorTokens への純粋変換 */
export const toColorTokens = (bundle: HighlightBundle): NeovimColorTokens => {
  const { neutral, highlights } = bundle;

  return {
    bg: neutral.bg,
    bgPopup: neutral.popup,
    bgSurface: neutral.surface,
    bgCursorLine: neutral.cursorline,
    bgVisual: neutral.visual,

    fg: neutral.fg,
    comment: neutral.comment,
    lineNr: neutral.dim,
    cursorLineNr: highlights.CursorLineNr?.fg ?? neutral.fg,
    border: neutral.border,
    delimiter: neutral.dim,

    keyword: highlights.Keyword?.fg ?? neutral.fg,
    fn: highlights.Function?.fg ?? neutral.fg,
    operator: highlights.Operator?.fg ?? neutral.fg,
    string: highlights.String?.fg ?? neutral.fg,
    type: highlights.Type?.fg ?? neutral.fg,
    constant: highlights.Constant?.fg ?? neutral.fg,
    number: highlights.Number?.fg ?? neutral.fg,

    accent: highlights.CursorLineNr?.fg ?? neutral.fg,
    searchBg: neutral.visual,
    pmenuSelBg: neutral.visual,
  };
};
