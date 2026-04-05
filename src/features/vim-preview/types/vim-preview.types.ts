import type { BundledTheme, ThemedToken } from "shiki";

/** shiki トークナイズ結果 */
export type ShikiTokensResult = {
  tokens: ThemedToken[][] | null;
  bg: string;
  fg: string;
};

/** ビジュアル選択範囲（0-indexed） */
export type VisualSelection = {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
};

/** バッファタブ */
export type BufferTab = {
  name: string;
  active: boolean;
};

/** Neo-tree ファイルツリーノード */
export type TreeNode = {
  name: string;
  kind: "file" | "directory";
  children?: TreeNode[];
  expanded?: boolean;
  gitStatus?: "M" | "A" | "?" | "D";
  active?: boolean;
};

/** エディタ表示状態（カーソル位置等） */
export type EditorState = {
  cursorLine: number;
  cursorCol: number;
  mode: "NORMAL" | "INSERT" | "VISUAL";
  visualSelection?: VisualSelection;
};

/** VimPreview の Props */
export type VimPreviewProps = {
  theme?: BundledTheme;
  variant?: "compact" | "full";
};
