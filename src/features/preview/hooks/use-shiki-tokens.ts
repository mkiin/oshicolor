import type { ShikiTokensResult } from "@/features/preview/types/vim-preview.types";
import type { ThemeRegistrationRaw } from "shiki/core";

import { useEffect, useMemo, useState } from "react";

type SupportedLang = "zig" | "tsx";
type PresetTheme = "tokyo-night";

type UseShikiTokensParams = {
  code: string;
  lang: SupportedLang;
  theme: PresetTheme | ThemeRegistrationRaw;
};

type HighlighterInstance = Awaited<ReturnType<typeof loadHighlighter>>;

const loadHighlighter = async (
  lang: SupportedLang,
  theme: PresetTheme | ThemeRegistrationRaw,
) => {
  const [{ createHighlighterCore }, { createJavaScriptRegexEngine }, langMod] =
    await Promise.all([
      import("shiki/core"),
      import("shiki/engine/javascript"),
      lang === "zig"
        ? import("shiki/langs/zig.mjs")
        : import("shiki/langs/tsx.mjs"),
    ]);

  const themeArg =
    typeof theme === "string"
      ? (await import("shiki/themes/tokyo-night.mjs")).default
      : theme;

  return createHighlighterCore({
    langs: [langMod.default],
    themes: [themeArg],
    engine: createJavaScriptRegexEngine(),
  });
};

export const useShikiTokens = ({
  code,
  lang,
  theme,
}: UseShikiTokensParams): ShikiTokensResult => {
  const [highlighter, setHighlighter] = useState<HighlighterInstance | null>(
    null,
  );

  const themeName = typeof theme === "string" ? theme : theme.name;

  useEffect(() => {
    let cancelled = false;

    loadHighlighter(lang, theme).then((hl) => {
      if (!cancelled) setHighlighter(hl);
    });

    return () => {
      cancelled = true;
    };
  }, [theme, lang]);

  return useMemo(() => {
    if (!highlighter) {
      return { tokens: null, bg: "#1a1b26", fg: "#a9b1d6" };
    }

    const result = highlighter.codeToTokens(code, {
      lang,
      theme: themeName ?? "tokyo-night",
    });
    return {
      tokens: result.tokens,
      bg: result.bg || "#1a1b26",
      fg: result.fg || "#a9b1d6",
    };
  }, [highlighter, code, lang, themeName]);
};
