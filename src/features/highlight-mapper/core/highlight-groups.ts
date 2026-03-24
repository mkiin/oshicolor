import type {
  DiagnosticColors,
  HighlightMap,
  NeutralPalette,
  RoleMap,
} from "../highlight-mapper.types";

/**
 * ロールベースの fg 色 + neutral + diagnostic から 66 ハイライトグループを構築する
 */
export const highlightGroupsFrom = (
  roles: RoleMap,
  neutral: NeutralPalette,
  diag: DiagnosticColors,
): HighlightMap => {
  return {
    // --- Editor UI (26) ---
    Normal: { fg: neutral.fg, bg: neutral.bg },
    NormalFloat: { fg: neutral.fg, bg: neutral.surface },
    FloatBorder: { fg: roles.keyword },
    CursorLine: { bg: neutral.cursorline },
    CursorLineNr: { fg: roles.accent, bold: true },
    LineNr: { fg: neutral.dim },
    Visual: { bg: neutral.visual },
    Search: { fg: roles.accent, bg: neutral.visual },
    IncSearch: { fg: neutral.bg, bg: roles.accent },
    CurSearch: { fg: neutral.bg, bg: roles.accent, bold: true },
    MatchParen: { bg: neutral.visual, bold: true },
    Pmenu: { fg: neutral.fg, bg: neutral.surface },
    PmenuSel: { bg: neutral.visual },
    PmenuSbar: { bg: neutral.surface },
    PmenuThumb: { bg: neutral.dim },
    StatusLine: { fg: neutral.fg, bg: neutral.surface },
    StatusLineNC: { fg: neutral.dim, bg: neutral.bg },
    TabLine: { fg: neutral.dim, bg: neutral.surface },
    TabLineSel: { fg: roles.accent, bg: neutral.surface, bold: true },
    TabLineFill: { bg: neutral.bg },
    WinSeparator: { fg: neutral.border },
    Folded: { fg: neutral.dim, bg: neutral.surface },
    FoldColumn: { fg: neutral.dim },
    SignColumn: { bg: neutral.bg },
    NonText: { fg: neutral.border },
    Title: { fg: roles.accent, bold: true },

    // --- Syntax (20) ---
    Comment: { fg: neutral.comment, italic: true },
    Keyword: { fg: roles.keyword },
    Statement: { fg: roles.keyword },
    Conditional: { fg: roles.keyword },
    Repeat: { fg: roles.keyword },
    Function: { fg: roles.function },
    Operator: { fg: roles.operator },
    String: { fg: roles.string },
    Character: { fg: roles.string },
    Type: { fg: roles.type },
    Number: { fg: roles.number },
    Boolean: { fg: roles.number },
    Float: { fg: roles.number },
    Constant: { fg: roles.number },
    Special: { fg: roles.accent },
    Delimiter: { fg: neutral.dim },
    Identifier: { fg: neutral.fg },
    PreProc: { fg: roles.keyword },
    Include: { fg: roles.keyword },
    Todo: { fg: roles.accent, bold: true },

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
