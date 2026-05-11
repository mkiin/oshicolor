import type { ShikiTokensResult } from "@/features/preview/types/vim-preview.types";
import type {
  BundledLanguage,
  BundledTheme,
  HighlighterGeneric,
  ThemeRegistrationRaw,
} from "shiki";

import { useEffect, useMemo, useState } from "react";

type UseShikiTokensParams = {
  code: string;
  lang: BundledLanguage;
  theme: BundledTheme | ThemeRegistrationRaw;
};

/**
 * shiki でコードをトークナイズし、テーマカラー付きトークン列を返す。
 * BundledTheme（文字列）とカスタムテーマ（オブジェクト）の両方に対応。
 */
export const useShikiTokens = ({
  code,
  lang,
  theme,
}: UseShikiTokensParams): ShikiTokensResult => {
  const [highlighter, setHighlighter] = useState<HighlighterGeneric<
    BundledLanguage,
    BundledTheme
  > | null>(null);

  const themeName = typeof theme === "string" ? theme : theme.name;

  useEffect(() => {
    let cancelled = false;

    import("shiki").then(({ createHighlighter }) =>
      createHighlighter({ themes: [theme], langs: [lang] }).then((hl) => {
        if (!cancelled) setHighlighter(hl);
      }),
    );

    return () => {
      cancelled = true;
    };
  }, [theme, lang]);

  return useMemo(() => {
    if (!highlighter) {
      return { tokens: null, bg: "#1a1b26", fg: "#a9b1d6" };
    }

    const result = highlighter.codeToTokens(code, { lang, theme: themeName });
    return {
      tokens: result.tokens,
      bg: result.bg || "#1a1b26",
      fg: result.fg || "#a9b1d6",
    };
  }, [highlighter, code, lang, themeName]);
};
