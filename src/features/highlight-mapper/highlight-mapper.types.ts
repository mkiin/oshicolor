/** neutral palette の各段階（OkLch L 値ベース、hex 文字列で保持） */
export type NeutralPalette = {
  popup: string;
  bg: string;
  surface: string;
  cursorline: string;
  visual: string;
  dim: string;
  border: string;
  comment: string;
  fg: string;
};

/** diagnostic 4色（固定 hue、hex 文字列） */
export type DiagnosticColors = {
  error: string;
  warn: string;
  info: string;
  hint: string;
};

/** 1つのハイライトグループの定義 */
export type HighlightDef = {
  fg?: string;
  bg?: string;
  bold?: boolean;
  italic?: boolean;
  undercurl?: boolean;
};

/** 66 ハイライトグループ名 → 定義 */
export type HighlightMap = Record<string, HighlightDef>;

/** syntax ロール名 */
export const SYNTAX_ROLES = [
  "accent",
  "keyword",
  "function",
  "string",
  "operator",
  "type",
  "number",
] as const;

export type SyntaxRole = (typeof SYNTAX_ROLES)[number];

/** ロール → hex のマッピング */
export type RoleMap = Record<SyntaxRole, string>;

/** highlight-mapper の最終出力 */
export type HighlightBundle = {
  seeds: string[];
  neutral: NeutralPalette;
  diagnostic: DiagnosticColors;
  highlights: HighlightMap;
};
