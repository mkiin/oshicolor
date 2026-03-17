import { useAtomValue } from "jotai";
import type React from "react";
import {
  colorTokensAtom,
  fileNameAtom,
} from "@/features/neovim-preview/stores/atoms";

export const NeovimTabline: React.FC = () => {
  const fileName = useAtomValue(fileNameAtom);
  const { bg, fg, accent } = useAtomValue(colorTokensAtom);

  return (
    <div
      style={{
        backgroundColor: bg,
        display: "flex",
        fontFamily: "monospace",
        fontSize: "13px",
        borderBottom: `1px solid ${accent}33`,
      }}
    >
      {/* アクティブタブ */}
      <span
        style={{
          color: fg,
          backgroundColor: bg,
          padding: "0.2rem 1rem",
          borderRight: `1px solid ${accent}33`,
          borderBottom: `2px solid ${accent}`,
        }}
      >
        {fileName}
      </span>
    </div>
  );
};
