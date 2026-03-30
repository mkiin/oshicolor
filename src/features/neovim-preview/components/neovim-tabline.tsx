import type React from "react";

import {
  colorTokensAtom,
  fileNameAtom,
} from "@/features/neovim-preview/neovim-preview.atoms";
import { useAtomValue } from "jotai";

export const NeovimTabline: React.FC = () => {
  const fileName = useAtomValue(fileNameAtom);
  const { bgSurface, fg, accent, border } = useAtomValue(colorTokensAtom);

  return (
    <div
      style={{
        backgroundColor: bgSurface,
        display: "flex",
        fontFamily: "monospace",
        fontSize: "13px",
        borderBottom: `1px solid ${border}`,
      }}
    >
      <span
        style={{
          color: fg,
          backgroundColor: bgSurface,
          padding: "0.2rem 1rem",
          borderRight: `1px solid ${border}`,
          borderBottom: `2px solid ${accent}`,
        }}
      >
        {fileName}
      </span>
    </div>
  );
};
