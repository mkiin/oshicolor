/**
 * UI ロール割り当て + UI 色導出
 *
 * navigation: primary の色相を保持 (ensureContrast のみ)
 * attention: primary との Oklab 距離 × 彩度 が最大の色
 */

import type { Oklch, ThemeTone } from "../types/accent-palette";
import type { UiColors, UiRoleAssignment } from "../types/ui-colors";

import { CONFIG } from "./config";
import { contrastRatio, ensureContrast } from "./contrast";
import { hexToOklab, oklabDist } from "./oklab-utils";
import { hexToOklch, toHex, vToHex } from "./oklch-utils";

export const assignUiRoles = (
  colors: Oklch[],
  bgHex: string,
  fgHex: string,
): UiRoleAssignment => {
  const primary = colors[0];
  const primaryOklab = hexToOklab(vToHex(primary));

  let navigationHex = toHex(primary.l, primary.c, primary.h);
  navigationHex = ensureContrast(navigationHex, bgHex, CONFIG.ui.bgCrMin);

  const candidates = [1, 2]
    .map((i) => {
      const c = colors[i];
      const dist = oklabDist(hexToOklab(vToHex(c)), primaryOklab);
      return { i, score: dist * c.c };
    })
    .toSorted((a, b) => b.score - a.score);
  const attIdx = candidates[0].i;

  const attHex = vToHex(colors[attIdx]);
  if (
    contrastRatio(attHex, bgHex) >= CONFIG.ui.bgCrMin &&
    contrastRatio(attHex, fgHex) >= CONFIG.ui.fgCrMin
  ) {
    return { navigationHex, attentionIdx: attIdx };
  }

  // 救済
  let rescued = ensureContrast(attHex, bgHex, CONFIG.ui.bgCrMin);
  if (contrastRatio(rescued, fgHex) < CONFIG.ui.fgCrMin) {
    const rOklch = hexToOklch(rescued);
    const fgL = hexToOklch(fgHex).l;
    const dir = rOklch.l > fgL ? -1 : 1;
    for (
      let ll = rOklch.l + 0.01 * dir;
      ll > 0.05 && ll < 0.95;
      ll += 0.01 * dir
    ) {
      const hex = toHex(ll, rOklch.c, rOklch.h);
      if (
        contrastRatio(hex, bgHex) >= CONFIG.ui.bgCrMin &&
        contrastRatio(hex, fgHex) >= CONFIG.ui.fgCrMin
      ) {
        rescued = hex;
        break;
      }
    }
  }
  return { navigationHex, attentionIdx: attIdx, attentionOverride: rescued };
};

export const deriveUiColors = (
  colors: Oklch[],
  roles: UiRoleAssignment,
  bgVisualHex: string,
  tone: ThemeTone,
): UiColors => {
  const nav = hexToOklch(roles.navigationHex);
  return {
    navigation: roles.navigationHex,
    attention: roles.attentionOverride ?? vToHex(colors[roles.attentionIdx]),
    frame: toHex(
      CONFIG.ui.frameL[tone],
      nav.c * CONFIG.ui.frameChromaScale,
      nav.h,
    ),
    search_bg: toHex(CONFIG.ui.searchBgL[tone], nav.c, nav.h),
    pmenu_sel_bg: bgVisualHex,
  };
};
