/**
 * neutral 色の検証・補正・派生
 */

import type { Oklch, ThemeTone } from "../types/accent-palette";
import type { NeutralPalette } from "../types/neutral-palette";

import { CONFIG } from "./config";
import { ensureContrast } from "./contrast";
import { clamp, hexToOklch, toHex, vToHex } from "./oklch-utils";

/** AI が提案した bg/fg を OKLCH で検証し、範囲外なら補正する */
export const clampNeutral = (
  bgHex: string,
  fgHex: string,
  tone: ThemeTone,
): { bg: Oklch; fg: Oklch } => {
  const limits = CONFIG.neutral[tone];
  const bg = hexToOklch(bgHex);
  const fg = hexToOklch(fgHex);
  return {
    bg: {
      l: clamp(bg.l, limits.bg.lMin, limits.bg.lMax),
      c: bg.c > limits.bg.cMax ? limits.bg.cFallback : bg.c,
      h: bg.h,
    },
    fg: { l: clamp(fg.l, limits.fg.lMin, limits.fg.lMax), c: fg.c, h: fg.h },
  };
};

/** 補正済み bg/fg から neutral 10 色を派生する */
export const deriveNeutralPalette = (
  bg: Oklch,
  fg: Oklch,
  tone: ThemeTone,
): NeutralPalette => {
  const sign = tone === "dark" ? 1 : -1;
  const off = CONFIG.neutralOffsets;
  const levels = CONFIG.neutral[tone].fgLevels;
  return {
    bg: vToHex(bg),
    fg: vToHex(fg),
    bg_surface: toHex(bg.l + off.surface * sign, bg.c, bg.h),
    bg_cursor_line: toHex(bg.l + off.cursorLine * sign, bg.c + 0.01, bg.h),
    bg_popup: toHex(bg.l + off.popup * sign, bg.c, bg.h),
    bg_visual: toHex(bg.l + off.visual * sign, bg.c, bg.h),
    comment: toHex(levels.comment, bg.c, fg.h),
    line_nr: toHex(levels.lineNr, bg.c, fg.h),
    border: toHex(levels.border, bg.c, fg.h),
    delimiter: toHex(levels.delimiter, bg.c, fg.h),
  };
};

/** neutral fg 系の同色収束を防止する (明→暗の順序を保証) */
export const ensureNeutralSpacing = (
  hexes: string[],
  sign: number,
): string[] => {
  const oklchs = hexes.map(hexToOklch);
  for (let i = 1; i < oklchs.length; i++) {
    const gap = (oklchs[i - 1].l - oklchs[i].l) * sign;
    if (gap < CONFIG.neutralMinDeltaL) {
      const shift = (CONFIG.neutralMinDeltaL - gap) * sign;
      oklchs[i] = {
        ...oklchs[i],
        l: clamp(oklchs[i].l - shift, 0.05, 0.95),
      };
    }
  }
  return oklchs.map(vToHex);
};

/** neutral fg 系にコントラスト保証 + spacing を適用する */
export const adjustNeutralFg = (
  neutral: NeutralPalette,
  bgHex: string,
  tone: ThemeTone,
): NeutralPalette => {
  const adjustedFg = ensureContrast(neutral.fg, bgHex, CONFIG.contrastAA);

  const fgKeys = ["delimiter", "comment", "line_nr", "border"] as const;
  const rawFgHexes = fgKeys.map((k) =>
    ensureContrast(neutral[k], bgHex, CONFIG.contrastSubdued),
  );

  const spacedOrder = tone === "dark" ? rawFgHexes : rawFgHexes.toReversed();
  const spaced = ensureNeutralSpacing(spacedOrder, tone === "dark" ? 1 : -1);
  const spacedFg = tone === "dark" ? spaced : spaced.toReversed();

  return {
    ...neutral,
    fg: adjustedFg,
    delimiter: spacedFg[0],
    comment: spacedFg[1],
    line_nr: spacedFg[2],
    border: spacedFg[3],
  };
};
