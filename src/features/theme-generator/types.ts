/**
 * Neovim ハイライトグループの属性
 */
export type HighlightAttr = {
    fg?: string;
    bg?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
};

/**
 * グループ名 → 属性 のマッピング
 */
export type HighlightMap = Record<string, HighlightAttr>;

/**
 * ダーク・ライト両テーマを保持するコンテナ
 */
export type ThemeVariants = { dark: HighlightMap; light: HighlightMap };
