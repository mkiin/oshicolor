import type { NeovimColorTokens } from "@/features/neovim-preview/neovim-preview.types";
import type { PrismTheme } from "prism-react-renderer";

export const buildPrismTheme = (tokens: NeovimColorTokens): PrismTheme => {
  return {
    plain: {
      color: tokens.fg,
      backgroundColor: tokens.bg,
    },
    styles: [
      {
        types: ["keyword", "control-flow", "module"],
        style: { color: tokens.keyword },
      },
      {
        types: ["function", "function-variable"],
        style: { color: tokens.fn },
      },
      {
        types: ["property", "attr-name"],
        style: { color: tokens.fn },
      },
      {
        types: ["string", "char", "template-string"],
        style: { color: tokens.string },
      },
      {
        types: ["class-name", "builtin", "namespace"],
        style: { color: tokens.type },
      },
      {
        types: ["operator"],
        style: { color: tokens.operator },
      },
      {
        types: ["punctuation"],
        style: { color: tokens.delimiter },
      },
      {
        types: ["constant", "number", "boolean"],
        style: { color: tokens.number },
      },
      {
        types: ["decorator", "annotation", "tag"],
        style: { color: tokens.constant },
      },
      {
        types: ["comment", "block-comment"],
        style: { color: tokens.comment, fontStyle: "italic" },
      },
    ],
  };
};
