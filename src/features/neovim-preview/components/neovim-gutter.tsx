import type React from "react";

import {
  colorTokensAtom,
  cursorLineAtom,
  lineCountAtom,
  showLineNumberAtom,
} from "@/features/neovim-preview/neovim-preview.atoms";
import { useAtomValue } from "jotai";

export const NeovimGutter: React.FC = () => {
  const { bg, lineNr, cursorLineNr, bgCursorLine } =
    useAtomValue(colorTokensAtom);
  const lineCount = useAtomValue(lineCountAtom);
  const showLineNumber = useAtomValue(showLineNumberAtom);
  const cursorLine = useAtomValue(cursorLineAtom);

  if (!showLineNumber) return null;

  return (
    <div
      style={{
        backgroundColor: bg,
        padding: "0.5rem 0",
        textAlign: "right",
        fontFamily: "monospace",
        fontSize: "13px",
        lineHeight: "1.5",
        userSelect: "none",
        minWidth: `${String(lineCount).length + 2}ch`,
      }}
    >
      {Array.from({ length: lineCount }, (_, i) => {
        const lineNum = i + 1;
        const isCursor = lineNum === cursorLine;
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: 行番号には安定した ID がないためインデックスを使用
            key={lineNum}
            style={{
              color: isCursor ? cursorLineNr : lineNr,
              backgroundColor: isCursor ? bgCursorLine : "transparent",
              fontWeight: isCursor ? "bold" : "normal",
              paddingRight: "0.75rem",
              paddingLeft: "0.5rem",
            }}
          >
            {lineNum}
          </div>
        );
      })}
    </div>
  );
};
