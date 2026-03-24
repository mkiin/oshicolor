import { hexToOklch, oklchToHex, contrastRatio } from "./oklch";

/** WCAG AA: 通常テキスト */
export const CONTRAST_AA = 4.5;
/** WCAG 緩め: comment, dim 等の補助テキスト */
export const CONTRAST_SUBDUED = 3;

const L_MAX = 0.95;
const L_STEP = 0.01;

/**
 * fg の hue/chroma を保ったまま、bg とのコントラスト比が minRatio 以上になるよう L を調整する
 *
 * dark theme 前提: 元の L から上方向に探索し、最小限の変更でコントラストを満たす。
 * 既に満たしていればそのまま返す。
 */
export const ensureContrast = (
  fgHex: string,
  bgHex: string,
  minRatio: number,
): string => {
  if (contrastRatio(fgHex, bgHex) >= minRatio) return fgHex;

  const { l, c, h } = hexToOklch(fgHex);

  for (let candidate = l + L_STEP; candidate <= L_MAX; candidate += L_STEP) {
    const hex = oklchToHex(candidate, c, h);
    if (contrastRatio(hex, bgHex) >= minRatio) {
      return hex;
    }
  }

  return oklchToHex(L_MAX, c, h);
};
