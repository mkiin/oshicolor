import { atom } from "jotai";
import { buildPrismTheme } from "@/features/neovim-preview/lib/prism-theme";
import type { NeovimColorTokens } from "@/features/neovim-preview/types";

export const colorTokensAtom = atom<NeovimColorTokens>({
    bg: "#1e1e2e",
    fg: "#cdd6f4",
    comment: "#6c7086",
    fn: "#89b4fa",
    kw: "#cba6f7",
    field: "#89dceb",
    string: "#a6e3a1",
    type: "#f9e2af",
    op: "#89b4fa",
    const: "#fab387",
    special: "#f38ba8",
    accent: "#cba6f7",
});

export const codeAtom = atom<string>("");

export const languageAtom = atom<string>("typescript");

export const modeAtom = atom<"NORMAL" | "INSERT" | "VISUAL">("NORMAL");

export const fileNameAtom = atom<string>("preview.ts");

export const showLineNumberAtom = atom<boolean>(true);

// derived atoms
export const lineCountAtom = atom((get) => get(codeAtom).split("\n").length);

export const prismThemeAtom = atom((get) =>
    buildPrismTheme(get(colorTokensAtom)),
);
