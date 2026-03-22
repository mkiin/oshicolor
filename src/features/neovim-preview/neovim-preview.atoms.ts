import { atom } from "jotai";
import { buildPrismTheme } from "@/features/neovim-preview/prism-theme";
import type { NeovimColorTokens } from "@/features/neovim-preview/neovim-preview.types";

/** catppuccin mocha ベースのデフォルト値 */
export const colorTokensAtom = atom<NeovimColorTokens>({
  // bg 階層
  bg: "#1e1e2e",
  bgPopup: "#181825",
  bgSurface: "#1e1e2e",
  bgCursorLine: "#313244",
  bgVisual: "#45475a",

  // fg 階層
  fg: "#cdd6f4",
  comment: "#6c7086",
  lineNr: "#45475a",
  cursorLineNr: "#cba6f7",
  border: "#585b70",
  delimiter: "#6c7086",

  // syntax
  keyword: "#cba6f7",
  fn: "#89b4fa",
  operator: "#89dceb",
  string: "#a6e3a1",
  type: "#f9e2af",
  constant: "#fab387",
  number: "#fab387",

  // UI
  accent: "#cba6f7",
  searchBg: "#45475a",
  pmenuSelBg: "#45475a",
});

export const codeAtom = atom<string>("");

export const languageAtom = atom<string>("typescript");

export const modeAtom = atom<"NORMAL" | "INSERT" | "VISUAL">("NORMAL");

export const fileNameAtom = atom<string>("preview.ts");

export const showLineNumberAtom = atom<boolean>(true);

export const cursorLineAtom = atom<number>(3);

// derived atoms
export const lineCountAtom = atom((get) => get(codeAtom).split("\n").length);

export const prismThemeAtom = atom((get) =>
  buildPrismTheme(get(colorTokensAtom)),
);
