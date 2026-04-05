/**
 * パレット生成パイプライン統合
 *
 * VisionResult → PaletteResult の全ステップをオーケストレーションする。
 */

import type { Oklch, ThemeTone } from "../types/accent-palette";
import type { PaletteResult } from "../types/palette-result";
import type { VisionResult } from "../types/vision-result";

import { CONFIG } from "./config";
import { ensureContrast } from "./contrast";
import { fixDiscrimination } from "./discrimination";
import {
  assignLByHueZigzag,
  computeGaps,
  computeTargetC,
  enforceMinHueGap,
  fillGaps,
  mergeCloseHues,
  resolveErrorHue,
} from "./hue-gap";
import {
  adjustNeutralFg,
  clampNeutral,
  deriveNeutralPalette,
} from "./neutral-palette";
import { hexToOklch, toHex } from "./oklch-utils";
import { stabilizeHue } from "./stabilize-hue";
import { assignUiRoles, deriveUiColors } from "./ui-colors";

/** bg の L から theme_tone を推定する */
const detectThemeTone = (bgHex: string): ThemeTone =>
  hexToOklch(bgHex).l < 0.5 ? "dark" : "light";

/** VisionResult からパレットを生成する */
export const generatePalette = (input: VisionResult): PaletteResult => {
  const { impression, neutral: inputNeutral } = input;
  const tone = input.theme_tone ?? detectThemeTone(inputNeutral.bg_base_hex);

  // AI 3色 → OKLCH + 低彩度補正
  const rawSeeds = [
    impression.primary.hex,
    impression.secondary.hex,
    impression.tertiary.hex,
  ].map(hexToOklch);
  const seeds = stabilizeHue(rawSeeds);

  // 隙間充填
  const seedHues = seeds.map((s) => s.h);
  const mergedHues = mergeCloseHues(seedHues);
  const gaps = computeGaps(mergedHues);
  const rawFilledHues = fillGaps(gaps, 4);
  const filledHues = enforceMinHueGap(seedHues, rawFilledHues);

  // gap-filled 色に L/C を割り当て
  const cTarget = computeTargetC(seeds);
  const lAssignment = assignLByHueZigzag(filledHues, tone);
  const filledColors: Oklch[] = filledHues.map((h, i) => ({
    l: lAssignment[i],
    c: cTarget,
    h,
  }));

  // error 色
  const errorHue = resolveErrorHue(seeds[0].h);
  const color8: Oklch = {
    l: CONFIG.errorL[tone],
    c: Math.max(cTarget, CONFIG.errorChromaMin),
    h: errorHue,
  };

  // variants
  const sign = tone === "dark" ? 1 : -1;
  const color1Variant: Oklch = {
    l: seeds[0].l,
    c: seeds[0].c * CONFIG.variant1ChromaScale,
    h: seeds[0].h,
  };
  const color3Variant: Oklch = {
    l: seeds[2].l + CONFIG.variant3LOffset * sign,
    c: seeds[2].c,
    h: seeds[2].h,
  };

  // neutral
  const clamped = clampNeutral(
    inputNeutral.bg_base_hex,
    inputNeutral.fg_base_hex,
    tone,
  );
  const neutral = deriveNeutralPalette(clamped.bg, clamped.fg, tone);
  const bgHex = neutral.bg;

  // コントラスト保証 (accent)
  const ec = (v: Oklch, ratio = CONFIG.contrastAA) =>
    ensureContrast(toHex(v.l, v.c, v.h), bgHex, ratio);
  const accentHexes = {
    color1: ec(seeds[0]),
    color1_variant: ec(color1Variant),
    color2: ec(seeds[1]),
    color3: ec(seeds[2]),
    color3_variant: ec(color3Variant),
    color4: ec(filledColors[0]),
    color5: ec(filledColors[1]),
    color6: ec(filledColors[2]),
    color7: ec(filledColors[3]),
    color8: ec(color8),
  };

  // 弁別性自動修正
  const accentKeys = [
    "color1",
    "color2",
    "color3",
    "color4",
    "color5",
    "color6",
    "color7",
    "color8",
  ] as const;
  const accentArray = accentKeys.map((k) => accentHexes[k]);
  const fixedAccent = fixDiscrimination(accentArray, bgHex);
  for (const [i, k] of accentKeys.entries()) {
    (accentHexes as Record<string, string>)[k] = fixedAccent[i];
  }

  // neutral fg コントラスト保証 + spacing
  const adjustedNeutral = adjustNeutralFg(neutral, bgHex, tone);

  // UI ロール
  const seedsForUi = seeds.map((_, i) => {
    const hex = [accentHexes.color1, accentHexes.color2, accentHexes.color3][i];
    return hexToOklch(hex);
  });
  const roles = assignUiRoles(seedsForUi, bgHex, adjustedNeutral.fg);

  // bg_visual を navigation hue で着色
  const navOklch = hexToOklch(roles.navigationHex);
  const bgOklch = hexToOklch(bgHex);
  adjustedNeutral.bg_visual = toHex(
    bgOklch.l + CONFIG.neutralOffsets.visual * sign,
    0.04,
    navOklch.h,
  );

  const ui = deriveUiColors(seedsForUi, roles, adjustedNeutral.bg_visual, tone);

  return {
    theme_tone: tone,
    neutral: adjustedNeutral,
    accent: accentHexes,
    ui,
  };
};
