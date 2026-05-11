/**
 * Palette → shiki カスタムテーマ変換
 *
 * 生成パレットの syntax / neutral 色を TextMate スコープにマッピングし、
 * shiki の ThemeRegistrationRaw として返す。
 */

import type { Palette } from "@/features/palette-design";
import type { ThemeRegistrationRaw } from "shiki/core";

export const paletteToShikiTheme = (
  palette: Palette,
): ThemeRegistrationRaw => ({
  name: "oshicolor-custom",
  type: palette.tone,
  colors: {
    "editor.background": palette.neutral.bg,
    "editor.foreground": palette.neutral.text,
  },
  tokenColors: [
    {
      scope: ["variable", "entity.name.tag", "variable.other"],
      settings: { foreground: palette.syntax.accent },
    },
    {
      scope: ["keyword", "storage", "keyword.control"],
      settings: { foreground: palette.syntax.keyword },
    },
    {
      scope: ["entity.name.function", "support.function", "meta.function-call"],
      settings: { foreground: palette.syntax.func },
    },
    {
      scope: ["string", "string.quoted"],
      settings: { foreground: palette.syntax.string },
    },
    {
      scope: [
        "entity.name.type",
        "support.type",
        "storage.type",
        "support.class",
      ],
      settings: { foreground: palette.syntax.type },
    },
    {
      scope: ["constant.numeric", "constant.language"],
      settings: { foreground: palette.syntax.number },
    },
    {
      scope: ["keyword.operator", "punctuation"],
      settings: { foreground: palette.syntax.operator },
    },
    {
      scope: [
        "keyword.import",
        "keyword.control.import",
        "meta.preprocessor",
        "keyword.other.import",
      ],
      settings: { foreground: palette.syntax.preproc },
    },
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: palette.neutral.subtle },
    },
  ],
});
