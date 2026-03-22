import { Provider, useAtomValue } from "jotai";
import { useHydrateAtoms } from "jotai/utils";
import type React from "react";
import type { ReactNode } from "react";
import {
  codeAtom,
  colorTokensAtom,
  cursorLineAtom,
  fileNameAtom,
  languageAtom,
  modeAtom,
  showLineNumberAtom,
} from "@/features/neovim-preview/neovim-preview.atoms";
import type { NeovimColorTokens } from "@/features/neovim-preview/neovim-preview.types";
import { cn } from "@/lib/utils";
import { NeovimEditorArea } from "./neovim-editor-area";
import { NeovimStatusLine } from "./neovim-statusline";
import { NeovimTabline } from "./neovim-tabline";

export type NeovimPreviewProps = {
  colors: NeovimColorTokens;
  code: string;
  language: string;
  fileName?: string;
  showLineNumber?: boolean;
  showStatusLine?: boolean;
  showTabLine?: boolean;
  mode?: "NORMAL" | "INSERT" | "VISUAL";
  cursorLine?: number;
  className?: string;
};

type HydratorProps = Pick<
  NeovimPreviewProps,
  | "colors"
  | "code"
  | "language"
  | "mode"
  | "fileName"
  | "showLineNumber"
  | "cursorLine"
  | "className"
> & { children: ReactNode };

const NeovimPreviewHydrator: React.FC<HydratorProps> = ({
  colors,
  code,
  language,
  mode,
  fileName,
  showLineNumber,
  cursorLine,
  className,
  children,
}) => {
  useHydrateAtoms([
    [colorTokensAtom, colors],
    [codeAtom, code],
    [languageAtom, language],
    [modeAtom, mode ?? "NORMAL"],
    [fileNameAtom, fileName ?? "preview.ts"],
    [showLineNumberAtom, showLineNumber ?? true],
    [cursorLineAtom, cursorLine ?? 3],
  ]);

  const { bg, border } = useAtomValue(colorTokensAtom);

  return (
    <div
      className={cn(
        "flex flex-col font-mono text-[13px] rounded-lg overflow-hidden",
        className,
      )}
      style={{
        backgroundColor: bg,
        border: `1px solid ${border}`,
      }}
    >
      {children}
    </div>
  );
};

export const NeovimPreview: React.FC<NeovimPreviewProps> = ({
  colors,
  code,
  language,
  mode,
  fileName,
  showLineNumber,
  showStatusLine,
  showTabLine,
  cursorLine,
  className,
}) => {
  return (
    <Provider key={JSON.stringify(colors)}>
      <NeovimPreviewHydrator
        colors={colors}
        code={code}
        language={language}
        mode={mode}
        fileName={fileName}
        showLineNumber={showLineNumber}
        cursorLine={cursorLine}
        className={className}
      >
        {(showTabLine ?? true) && <NeovimTabline />}
        <NeovimEditorArea />
        {(showStatusLine ?? true) && <NeovimStatusLine />}
      </NeovimPreviewHydrator>
    </Provider>
  );
};
