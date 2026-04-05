import type { EditorState } from "@/features/vim-preview/types/vim-preview.types";

export type VimStatuslineProps = {
  fileName: string;
  editorState: EditorState;
  bg: string;
  fg: string;
  modeBg: string;
  modeFg: string;
};

const MODE_LABELS = {
  NORMAL: "NORMAL",
  INSERT: "INSERT",
  VISUAL: "VISUAL",
} as const;

export const VimStatusline: React.FC<VimStatuslineProps> = ({
  fileName,
  editorState,
  bg,
  fg,
  modeBg,
  modeFg,
}) => {
  const { cursorLine, cursorCol, mode } = editorState;

  return (
    <div
      className="flex items-center text-xs leading-6 select-none"
      style={{ backgroundColor: bg, color: fg }}
    >
      {/* モード表示 */}
      <div
        className="px-2 font-bold"
        style={{ backgroundColor: modeBg, color: modeFg }}
      >
        {MODE_LABELS[mode]}
      </div>

      {/* ファイル名 */}
      <div className="px-3">{fileName}</div>

      {/* スペーサー */}
      <div className="flex-1" />

      {/* ファイルタイプ */}
      <div className="px-2 opacity-70">utf-8</div>

      {/* カーソル位置（1-indexed 表示） */}
      <div className="px-2" style={{ backgroundColor: modeBg, color: modeFg }}>
        {cursorLine + 1}:{cursorCol + 1}
      </div>
    </div>
  );
};
