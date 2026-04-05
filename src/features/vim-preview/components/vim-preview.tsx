import type { VimPreviewProps } from "@/features/vim-preview/types/vim-preview.types";
import type { BundledLanguage } from "shiki";

import { useShikiTokens } from "@/features/vim-preview/hooks/use-shiki-tokens";
import {
  BUFFER_TABS,
  TSX_BUFFER_TABS,
  TSX_CODE,
  TSX_EDITOR_STATE,
  ZIG_CODE,
  ZIG_EDITOR_STATE,
} from "@/features/vim-preview/sample-code";
import { SAMPLE_TREE } from "@/features/vim-preview/sample-tree";

import { VimBufferline } from "./vim-bufferline";
import { VimEditorArea } from "./vim-editor-area";
import { VimNeoTree } from "./vim-neo-tree";
import { VimStatusline } from "./vim-statusline";

/**
 * tokyo-night テーマ基準のカラーパレット。
 * 将来カスタムカラースキームに差し替える想定。
 */
const PALETTE = {
  bg: "#1a1b26",
  fg: "#a9b1d6",
  gutterBg: "#1a1b26",
  gutterFg: "#3b4261",
  cursorLineBg: "#292e42",
  cursorLineNrFg: "#c0caf5",
  selectionBg: "#33467c",
  tabBg: "#16161e",
  tabFg: "#565f89",
  tabActiveBg: "#1a1b26",
  tabActiveFg: "#c0caf5",
  statusBg: "#16161e",
  statusFg: "#565f89",
  modeBg: "#7aa2f7",
  modeFg: "#1a1b26",
  modeVisualBg: "#bb9af7",
  treeBg: "#16161e",
  treeFg: "#a9b1d6",
  treeDirectoryFg: "#7aa2f7",
  treeActiveBg: "#292e42",
  treeGitModifiedFg: "#e0af68",
  treeIndentMarkerFg: "#3b4261",
} as const;

type SampleConfig = {
  code: string;
  lang: BundledLanguage;
};

const SAMPLES: Record<string, SampleConfig> = {
  zig: { code: ZIG_CODE, lang: "zig" },
  tsx: { code: TSX_CODE, lang: "tsx" },
};

export const VimPreview: React.FC<VimPreviewProps> = ({
  theme = "tokyo-night",
  variant = "compact",
}) => {
  const isCompact = variant === "compact";
  const sample = isCompact ? SAMPLES.zig : SAMPLES.tsx;
  const editorState = isCompact ? ZIG_EDITOR_STATE : TSX_EDITOR_STATE;
  const tabs = isCompact ? BUFFER_TABS : TSX_BUFFER_TABS;
  const activeTab = tabs.find((t) => t.active);

  const { tokens, bg, fg } = useShikiTokens({
    code: sample.code,
    lang: sample.lang,
    theme,
  });

  const isVisual = editorState.mode === "VISUAL";

  if (!tokens) {
    return (
      <div
        className="flex h-80 items-center justify-center rounded-lg font-mono text-sm"
        style={{ backgroundColor: PALETTE.bg, color: PALETTE.fg }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg shadow-lg">
      {/* Bufferline */}
      <VimBufferline
        tabs={tabs}
        bg={PALETTE.tabBg}
        fg={PALETTE.tabFg}
        activeBg={bg}
        activeFg={PALETTE.tabActiveFg}
      />

      {/* Editor body */}
      <div className="flex">
        {/* Neo-tree（full のみ） */}
        {!isCompact && (
          <VimNeoTree
            tree={SAMPLE_TREE}
            bg={PALETTE.treeBg}
            fg={PALETTE.treeFg}
            directoryFg={PALETTE.treeDirectoryFg}
            activeBg={PALETTE.treeActiveBg}
            gitModifiedFg={PALETTE.treeGitModifiedFg}
            indentMarkerFg={PALETTE.treeIndentMarkerFg}
          />
        )}

        {/* Editor area */}
        <VimEditorArea
          tokens={tokens}
          editorState={editorState}
          bg={bg}
          fg={fg}
          gutterFg={PALETTE.gutterFg}
          gutterBg={PALETTE.gutterBg}
          cursorLineBg={PALETTE.cursorLineBg}
          cursorLineNrFg={PALETTE.cursorLineNrFg}
          selectionBg={PALETTE.selectionBg}
        />
      </div>

      {/* Statusline */}
      <VimStatusline
        fileName={activeTab?.name ?? ""}
        editorState={editorState}
        bg={PALETTE.statusBg}
        fg={PALETTE.statusFg}
        modeBg={isVisual ? PALETTE.modeVisualBg : PALETTE.modeBg}
        modeFg={PALETTE.modeFg}
      />
    </div>
  );
};
