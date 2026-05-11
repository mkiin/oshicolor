import type { Palette } from "@/features/palette-design";
import type { VimPreviewProps } from "@/features/preview/types/vim-preview.types";

import { useShikiTokens } from "@/features/preview/hooks/use-shiki-tokens";
import {
  BUFFER_TABS,
  TSX_BUFFER_TABS,
  TSX_CODE,
  TSX_EDITOR_STATE,
  ZIG_CODE,
  ZIG_EDITOR_STATE,
} from "@/features/preview/sample-code";
import { SAMPLE_TREE } from "@/features/preview/sample-tree";
import { paletteToShikiTheme } from "@/features/preview/usecases/palette-to-shiki-theme";
import { paletteToVimColors } from "@/features/preview/usecases/palette-to-vim-colors";

import { VimBufferline } from "./vim-bufferline";
import { VimEditorArea } from "./vim-editor-area";
import { VimNeoTree } from "./vim-neo-tree";
import { VimStatusline } from "./vim-statusline";

/**
 * tokyo-night テーマ基準のフォールバックカラー。
 * palette が渡されない場合に使用。
 */
const FALLBACK_COLORS = {
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

type SampleLang = "zig" | "tsx";

type SampleConfig = {
  code: string;
  lang: SampleLang;
};

const SAMPLES: Record<string, SampleConfig> = {
  zig: { code: ZIG_CODE, lang: "zig" },
  tsx: { code: TSX_CODE, lang: "tsx" },
};

const useVimPreviewConfig = (palette?: Palette) => {
  if (!palette) {
    return {
      colors: FALLBACK_COLORS,
      theme: "tokyo-night" as const,
    };
  }
  return {
    colors: { ...FALLBACK_COLORS, ...paletteToVimColors(palette) },
    theme: paletteToShikiTheme(palette),
  };
};

export const VimPreview: React.FC<VimPreviewProps> = ({
  palette,
  theme = "tokyo-night",
  variant = "compact",
}) => {
  const isCompact = variant === "compact";
  const sample = isCompact ? SAMPLES.zig : SAMPLES.tsx;
  const editorState = isCompact ? ZIG_EDITOR_STATE : TSX_EDITOR_STATE;
  const tabs = isCompact ? BUFFER_TABS : TSX_BUFFER_TABS;
  const activeTab = tabs.find((t) => t.active);

  const config = useVimPreviewConfig(palette);

  const { tokens, bg, fg } = useShikiTokens({
    code: sample.code,
    lang: sample.lang,
    theme: palette ? config.theme : theme,
  });

  const colors = config.colors;
  const isVisual = editorState.mode === "VISUAL";

  if (!tokens) {
    return (
      <div
        className="flex h-80 items-center justify-center rounded-lg font-mono text-sm"
        style={{ backgroundColor: colors.bg, color: colors.fg }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg shadow-lg">
      <VimBufferline
        tabs={tabs}
        bg={colors.tabBg}
        fg={colors.tabFg}
        activeBg={bg}
        activeFg={colors.tabActiveFg}
      />

      <div className="flex">
        {!isCompact && (
          <VimNeoTree
            tree={SAMPLE_TREE}
            bg={colors.treeBg}
            fg={colors.treeFg}
            directoryFg={colors.treeDirectoryFg}
            activeBg={colors.treeActiveBg}
            gitModifiedFg={colors.treeGitModifiedFg}
            indentMarkerFg={colors.treeIndentMarkerFg}
          />
        )}

        <VimEditorArea
          tokens={tokens}
          editorState={editorState}
          bg={bg}
          fg={fg}
          gutterFg={colors.gutterFg}
          gutterBg={colors.gutterBg}
          cursorLineBg={colors.cursorLineBg}
          cursorLineNrFg={colors.cursorLineNrFg}
          selectionBg={colors.selectionBg}
        />
      </div>

      <VimStatusline
        fileName={activeTab?.name ?? ""}
        editorState={editorState}
        bg={colors.statusBg}
        fg={colors.statusFg}
        modeBg={isVisual ? colors.modeVisualBg : colors.modeBg}
        modeFg={colors.modeFg}
      />
    </div>
  );
};
