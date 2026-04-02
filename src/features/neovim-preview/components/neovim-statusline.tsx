import type React from "react";

import {
  colorTokensAtom,
  fileNameAtom,
  languageAtom,
  lineCountAtom,
  modeAtom,
} from "@/features/neovim-preview/neovim-preview.atoms";
import { useAtomValue } from "jotai";

export const NeovimStatusLine: React.FC = () => {
  const {
    bgSurface,
    fg,
    accent,
    string: stringColor,
    keyword,
  } = useAtomValue(colorTokensAtom);
  const language = useAtomValue(languageAtom);
  const lineCount = useAtomValue(lineCountAtom);
  const mode = useAtomValue(modeAtom);
  const fileName = useAtomValue(fileNameAtom);

  const modeColor: Record<"NORMAL" | "INSERT" | "VISUAL", string> = {
    NORMAL: accent,
    INSERT: stringColor,
    VISUAL: keyword,
  };

  return (
    <div
      style={{
        backgroundColor: bgSurface,
        color: fg,
        display: "flex",
        alignItems: "center",
        fontFamily: "monospace",
        fontSize: "13px",
        height: "1.6rem",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          backgroundColor: modeColor[mode],
          color: bgSurface,
          padding: "0 0.75rem",
          fontWeight: "bold",
          height: "100%",
          display: "flex",
          alignItems: "center",
        }}
      >
        {mode}
      </span>

      <span style={{ padding: "0 0.75rem" }}>{fileName}</span>

      <span style={{ flex: 1 }} />

      <span style={{ padding: "0 0.75rem", color: accent }}>{language}</span>

      <span style={{ padding: "0 0.75rem" }}>{lineCount} lines</span>
    </div>
  );
};
