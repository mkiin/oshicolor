import { useAtomValue } from "jotai";
import type React from "react";
import { colorTokensAtom } from "@/features/neovim-preview/stores/atoms";
import { NeovimCodeBlock } from "./neovim-code-block";
import { NeovimGutter } from "./neovim-gutter";

export const NeovimEditorArea: React.FC = () => {
  const { bg } = useAtomValue(colorTokensAtom);

  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        backgroundColor: bg,
        overflow: "auto",
      }}
    >
      <NeovimGutter />
      <NeovimCodeBlock />
    </div>
  );
};
