import type { OKLCH } from "colorthief";
import type { DiagnosticColors } from "../highlight-mapper.types";
import { oklchToHex } from "./oklch-utils";

const DIAG_HUES = {
  error: 25,
  warn: 85,
  info: 250,
  hint: 165,
} as const;

const CHROMA_SCALE = 0.8;

/**
 * primary seed の tone に合わせて diagnostic 4色を生成する
 *
 * hue は固定、L と C は primary seed から導出。
 */
export const generateDiagnosticColors = (
  primaryOklch: OKLCH,
): DiagnosticColors => {
  const l = primaryOklch.l;
  const c = primaryOklch.c * CHROMA_SCALE;

  return {
    error: oklchToHex(l, c, DIAG_HUES.error),
    warn: oklchToHex(l, c, DIAG_HUES.warn),
    info: oklchToHex(l, c, DIAG_HUES.info),
    hint: oklchToHex(l, c, DIAG_HUES.hint),
  };
};
