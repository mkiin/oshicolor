import type {
  DiagnosticColors,
  HighlightMap,
  NeutralPalette,
} from "../highlight-mapper.types";

/**
 * 5 seed の fg 色 + neutral + diagnostic から 66 ハイライトグループを構築する
 *
 * @param seedFgs - d1〜d5 の fg 調整済み hex（[primary, secondary, tertiary, quaternary, quinary]）
 * @param neutral - neutral palette
 * @param diag - diagnostic 4色
 */
export const mapHighlightGroups = (
  seedFgs: [string, string, string, string, string],
  neutral: NeutralPalette,
  diag: DiagnosticColors,
): HighlightMap => {
  const [d1, d2, d3, d4, d5] = seedFgs;

  return {
    // --- Editor UI (26) ---
    Normal: { fg: neutral.fg, bg: neutral.bg },
    NormalFloat: { fg: neutral.fg, bg: neutral.surface },
    FloatBorder: { fg: d2 },
    CursorLine: { bg: neutral.cursorline },
    CursorLineNr: { fg: d1, bold: true },
    LineNr: { fg: neutral.dim },
    Visual: { bg: neutral.visual },
    Search: { fg: d1, bg: neutral.visual },
    IncSearch: { fg: neutral.bg, bg: d1 },
    CurSearch: { fg: neutral.bg, bg: d1, bold: true },
    MatchParen: { bg: neutral.visual, bold: true },
    Pmenu: { fg: neutral.fg, bg: neutral.surface },
    PmenuSel: { bg: neutral.visual },
    PmenuSbar: { bg: neutral.surface },
    PmenuThumb: { bg: neutral.dim },
    StatusLine: { fg: neutral.fg, bg: neutral.surface },
    StatusLineNC: { fg: neutral.dim, bg: neutral.bg },
    TabLine: { fg: neutral.dim, bg: neutral.surface },
    TabLineSel: { fg: d1, bg: neutral.surface, bold: true },
    TabLineFill: { bg: neutral.bg },
    WinSeparator: { fg: neutral.border },
    Folded: { fg: neutral.dim, bg: neutral.surface },
    FoldColumn: { fg: neutral.dim },
    SignColumn: { bg: neutral.bg },
    NonText: { fg: neutral.border },
    Title: { fg: d1, bold: true },

    // --- Syntax (20) ---
    Comment: { fg: neutral.comment, italic: true },
    Keyword: { fg: d2 },
    Statement: { fg: d2 },
    Conditional: { fg: d2 },
    Repeat: { fg: d2 },
    Function: { fg: d3 },
    Operator: { fg: d4 },
    String: { fg: d3 },
    Character: { fg: d3 },
    Type: { fg: d4 },
    Number: { fg: d5 },
    Boolean: { fg: d5 },
    Float: { fg: d5 },
    Constant: { fg: d5 },
    Special: { fg: d5 },
    Delimiter: { fg: neutral.dim },
    Identifier: { fg: neutral.fg },
    PreProc: { fg: d2 },
    Include: { fg: d2 },
    Todo: { fg: d5, bold: true },

    // --- Diagnostic (16) ---
    DiagnosticError: { fg: diag.error },
    DiagnosticWarn: { fg: diag.warn },
    DiagnosticInfo: { fg: diag.info },
    DiagnosticHint: { fg: diag.hint },
    DiagnosticVirtualTextError: { fg: diag.error },
    DiagnosticVirtualTextWarn: { fg: diag.warn },
    DiagnosticVirtualTextInfo: { fg: diag.info },
    DiagnosticVirtualTextHint: { fg: diag.hint },
    DiagnosticUnderlineError: { undercurl: true },
    DiagnosticUnderlineWarn: { undercurl: true },
    DiagnosticUnderlineInfo: { undercurl: true },
    DiagnosticUnderlineHint: { undercurl: true },
    DiagnosticSignError: { fg: diag.error },
    DiagnosticSignWarn: { fg: diag.warn },
    DiagnosticSignInfo: { fg: diag.info },
    DiagnosticSignHint: { fg: diag.hint },

    // --- Diff (4) ---
    DiffAdd: { bg: diag.hint },
    DiffChange: { bg: diag.info },
    DiffDelete: { bg: diag.error },
    DiffText: { bg: diag.info },
  };
};
