import type { ShikiTokensResult } from "@/features/vim-preview/types/vim-preview.types";
import type { BundledLanguage, BundledTheme, HighlighterGeneric } from "shiki";

import { useEffect, useMemo, useState } from "react";

type UseShikiTokensParams = {
  code: string;
  lang: BundledLanguage;
  theme: BundledTheme;
};

/**
 * shiki でコードをトークナイズし、テーマカラー付きトークン列を返す。
 * highlighter の生成は非同期のため、初回は tokens: null を返す。
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

    const result = highlighter.codeToTokens(code, { lang, theme });
    return {
      tokens: result.tokens,
      bg: result.bg || "#1a1b26",
      fg: result.fg || "#a9b1d6",
    };
  }, [highlighter, code, lang, theme]);
};
