import { useAtomValue } from "jotai";
import type React from "react";
import {
  colorTokensAtom,
  fileNameAtom,
  languageAtom,
  lineCountAtom,
  modeAtom,
} from "@/features/neovim-preview/stores/atoms";

const MODE_LABEL: Record<"NORMAL" | "INSERT" | "VISUAL", string> = {
  NORMAL: "NORMAL",
  INSERT: "INSERT",
  VISUAL: "VISUAL",
};

export const NeovimStatusLine: React.FC = () => {
  const {
    bg,
    fg,
    accent,
    string: stringColor,
    kw,
  } = useAtomValue(colorTokensAtom);
  const language = useAtomValue(languageAtom);
  const lineCount = useAtomValue(lineCountAtom);
  const mode = useAtomValue(modeAtom);
  const fileName = useAtomValue(fileNameAtom);

  // モードごとにアクセントカラーを切り替える
  const modeColor: Record<"NORMAL" | "INSERT" | "VISUAL", string> = {
    NORMAL: accent,
    INSERT: stringColor,
    VISUAL: kw,
  };

  return (
    <div
      style={{
        backgroundColor: bg,
        color: fg,
        display: "flex",
        alignItems: "center",
        fontFamily: "monospace",
        fontSize: "13px",
        height: "1.6rem",
        flexShrink: 0,
      }}
    >
      {/* モードブロック */}
      <span
        style={{
          backgroundColor: modeColor[mode],
          color: bg,
          padding: "0 0.75rem",
          fontWeight: "bold",
          height: "100%",
          display: "flex",
          alignItems: "center",
        }}
      >
        {MODE_LABEL[mode]}
      </span>

      {/* ファイル名 */}
      <span style={{ padding: "0 0.75rem" }}>{fileName}</span>

      {/* 右寄せスペーサー */}
      <span style={{ flex: 1 }} />

      {/* 言語 */}
      <span style={{ padding: "0 0.75rem", color: accent }}>{language}</span>

      {/* 行数 */}
      <span style={{ padding: "0 0.75rem" }}>{lineCount} lines</span>
    </div>
  );
};
