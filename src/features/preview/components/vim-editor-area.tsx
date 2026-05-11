import type {
  EditorState,
  VisualSelection,
} from "@/features/preview/types/vim-preview.types";
import type { ThemedToken } from "shiki/core";

export type VimEditorAreaProps = {
  tokens: ThemedToken[][];
  editorState: EditorState;
  bg: string;
  fg: string;
  gutterFg: string;
  gutterBg: string;
  cursorLineBg: string;
  cursorLineNrFg: string;
  selectionBg: string;
};

export const VimEditorArea: React.FC<VimEditorAreaProps> = ({
  tokens,
  editorState,
  bg,
  fg,
  gutterFg,
  gutterBg,
  cursorLineBg,
  cursorLineNrFg,
  selectionBg,
}) => {
  const totalLines = tokens.length;
  const gutterWidth = `${String(totalLines).length + 1}ch`;

  return (
    <div
      className="flex-1 overflow-hidden font-mono text-sm leading-5"
      style={{ backgroundColor: bg, color: fg }}
    >
      {tokens.map((lineTokens, lineIdx) => {
        const isCursorLine = lineIdx === editorState.cursorLine;
        const lineKey = `L${String(lineIdx + 1)}`;

        return (
          <div
            key={lineKey}
            className="flex"
            style={isCursorLine ? { backgroundColor: cursorLineBg } : undefined}
          >
            {/* ガター（行番号） */}
            <span
              className="shrink-0 pr-2 text-right select-none"
              style={{
                width: gutterWidth,
                color: isCursorLine ? cursorLineNrFg : gutterFg,
                backgroundColor: isCursorLine ? cursorLineBg : gutterBg,
              }}
            >
              {lineIdx + 1}
            </span>

            {/* コード行 */}
            <span className="pl-2 whitespace-pre">
              <LineTokens
                tokens={lineTokens}
                lineIdx={lineIdx}
                editorState={editorState}
                selectionBg={selectionBg}
                fg={fg}
              />
            </span>
          </div>
        );
      })}
    </div>
  );
};

/** 1行分のトークン描画（ビジュアル選択対応） */
type LineTokensProps = {
  tokens: ThemedToken[];
  lineIdx: number;
  editorState: EditorState;
  selectionBg: string;
  fg: string;
};

const LineTokens: React.FC<LineTokensProps> = ({
  tokens,
  lineIdx,
  editorState,
  selectionBg,
  fg,
}) => {
  const selection = editorState.visualSelection;
  const hasSelection = selection && isLineInSelection(lineIdx, selection);

  if (!hasSelection) {
    let col = 0;
    return (
      <>
        {tokens.map((token) => {
          const tokenKey = `c${String(col)}`;
          col += token.content.length;
          return (
            <TokenSpan
              key={tokenKey}
              token={token}
              editorState={editorState}
              lineIdx={lineIdx}
              fg={fg}
            />
          );
        })}
      </>
    );
  }

  return (
    <>
      {renderTokensWithSelection(
        tokens,
        lineIdx,
        selection,
        selectionBg,
        editorState,
        fg,
      )}
    </>
  );
};

/** トークン単体の描画（カーソル含む） */
type TokenSpanProps = {
  token: ThemedToken;
  editorState: EditorState;
  lineIdx: number;
  fg: string;
  colOffset?: number;
  selectedBg?: string;
};

const TokenSpan: React.FC<TokenSpanProps> = ({
  token,
  editorState,
  lineIdx,
  fg,
  colOffset = 0,
  selectedBg,
}) => {
  const baseStyle: React.CSSProperties = {
    color: token.color || fg,
    fontStyle: token.fontStyle === 1 ? "italic" : undefined,
    fontWeight: token.fontStyle === 2 ? "bold" : undefined,
    backgroundColor: selectedBg,
  };

  // ブロックカーソルの描画
  if (lineIdx === editorState.cursorLine && editorState.mode !== "INSERT") {
    const cursorCol = editorState.cursorCol;
    const tokenEnd = colOffset + token.content.length;

    if (cursorCol >= colOffset && cursorCol < tokenEnd) {
      const relIdx = cursorCol - colOffset;
      const before = token.content.slice(0, relIdx);
      const cursorChar = token.content[relIdx] || " ";
      const after = token.content.slice(relIdx + 1);

      return (
        <>
          {before && <span style={baseStyle}>{before}</span>}
          <span
            style={{
              ...baseStyle,
              backgroundColor: "#c0caf5",
              color: "#1a1b26",
            }}
          >
            {cursorChar}
          </span>
          {after && <span style={baseStyle}>{after}</span>}
        </>
      );
    }
  }

  return <span style={baseStyle}>{token.content}</span>;
};

/** 選択範囲を考慮してトークンを分割描画 */
const renderTokensWithSelection = (
  tokens: ThemedToken[],
  lineIdx: number,
  selection: VisualSelection,
  selectionBg: string,
  editorState: EditorState,
  fg: string,
): React.ReactNode[] => {
  const result: React.ReactNode[] = [];
  let col = 0;

  const selStart = lineIdx === selection.startLine ? selection.startCol : 0;
  const selEnd =
    lineIdx === selection.endLine ? selection.endCol : Number.POSITIVE_INFINITY;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const tokenStart = col;
    const tokenEnd = col + token.content.length;

    if (tokenEnd <= selStart || tokenStart > selEnd) {
      result.push(
        <TokenSpan
          key={`c${String(tokenStart)}`}
          token={token}
          editorState={editorState}
          lineIdx={lineIdx}
          fg={fg}
          colOffset={tokenStart}
        />,
      );
    } else if (tokenStart >= selStart && tokenEnd <= selEnd + 1) {
      result.push(
        <TokenSpan
          key={`c${String(tokenStart)}`}
          token={token}
          editorState={editorState}
          lineIdx={lineIdx}
          fg={fg}
          colOffset={tokenStart}
          selectedBg={selectionBg}
        />,
      );
    } else {
      const parts = splitToken(token, tokenStart, selStart, selEnd);
      for (const part of parts) {
        result.push(
          <TokenSpan
            key={`c${String(part.col)}`}
            token={part.token}
            editorState={editorState}
            lineIdx={lineIdx}
            fg={fg}
            colOffset={part.col}
            selectedBg={part.selected ? selectionBg : undefined}
          />,
        );
      }
    }

    col = tokenEnd;
  }

  return result;
};

type SplitPart = {
  token: ThemedToken;
  col: number;
  selected: boolean;
};

/** トークンを選択境界で分割 */
const splitToken = (
  token: ThemedToken,
  tokenStart: number,
  selStart: number,
  selEnd: number,
): SplitPart[] => {
  const parts: SplitPart[] = [];
  const text = token.content;

  // before selection
  if (tokenStart < selStart) {
    const beforeLen = selStart - tokenStart;
    parts.push({
      token: { ...token, content: text.slice(0, beforeLen) },
      col: tokenStart,
      selected: false,
    });
  }

  // selected part
  const inStart = Math.max(0, selStart - tokenStart);
  const inEnd = Math.min(text.length, selEnd - tokenStart + 1);
  if (inStart < inEnd) {
    parts.push({
      token: { ...token, content: text.slice(inStart, inEnd) },
      col: tokenStart + inStart,
      selected: true,
    });
  }

  // after selection
  if (tokenStart + text.length > selEnd + 1) {
    const afterStart = selEnd - tokenStart + 1;
    parts.push({
      token: { ...token, content: text.slice(afterStart) },
      col: tokenStart + afterStart,
      selected: false,
    });
  }

  return parts;
};

const isLineInSelection = (
  lineIdx: number,
  selection: VisualSelection,
): boolean => {
  return lineIdx >= selection.startLine && lineIdx <= selection.endLine;
};
