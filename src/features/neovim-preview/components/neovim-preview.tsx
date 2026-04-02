import type { NeovimColorTokens } from "@/features/neovim-preview/neovim-preview.types";
import type React from "react";
import type { ReactNode } from "react";

import {
  codeAtom,
  colorTokensAtom,
  fileNameAtom,
  languageAtom,
  modeAtom,
  showLineNumberAtom,
} from "@/features/neovim-preview/neovim-preview.atoms";
import { cn } from "@/shared/lib/utils";
import { Provider, useAtomValue } from "jotai";
import { useHydrateAtoms } from "jotai/utils";

import { NeovimEditorArea } from "./neovim-editor-area";
import { NeovimStatusLine } from "./neovim-statusline";
import { NeovimTabline } from "./neovim-tabline";

export type NeovimPreviewProps = {
  // 表示に使う色トークン
  colors: NeovimColorTokens;
  // コンテンツ
  // ハイライトを表示するコード文字列
  code: string;
  language: string;
  fileName?: string;

  // UI トグル
  // 行番号を表示するか
  showLineNumber?: boolean;
  // ステータスラインを表示するか
  showStatusLine?: boolean;
  // タブラインを表示するか
  showTabLine?: boolean;

  // 見た目調整
  // ステータスラインに表示するモード
  mode?: "NORMAL" | "INSERT" | "VISUAL";
  // 外側のコンテナへの追加クラス
  className?: string;
};

// atomの初期化に使用するコンポーネント
type NeovimPreviewHydratorProps = Pick<
  NeovimPreviewProps,
  | "colors"
  | "code"
  | "language"
  | "mode"
  | "fileName"
  | "showLineNumber"
  | "className"
> & { children: ReactNode };

const NeovimPreviewHydrator: React.FC<NeovimPreviewHydratorProps> = ({
  colors,
  code,
  language,
  mode,
  fileName,
  showLineNumber,
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
  ]);

  const { bg, accent } = useAtomValue(colorTokensAtom);

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg font-mono text-[13px]",
        className,
      )}
      style={{
        backgroundColor: bg,
        border: `1px solid ${accent}33`,
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
        className={className}
      >
        {(showTabLine ?? true) && <NeovimTabline />}
        <NeovimEditorArea />
        {(showStatusLine ?? true) && <NeovimStatusLine />}
      </NeovimPreviewHydrator>
    </Provider>
  );
};
