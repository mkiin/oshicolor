/**
 * Syntax パレット生成
 *
 * seed 2色の hue を固定点とし、色相環を gap-fill して S0-S7 を生成する。
 */

import type { Oklch, SyntaxSlot, ThemeTone } from "../types/palette";

import {
  DISCRIMINATION_L_SHIFT,
  DISCRIMINATION_MAX_ITER,
  LC_SYNTAX,
  MIN_DELTA_E,
  MIN_HUE_GAP,
  SYNTAX_C_MIN,
  SYNTAX_C_SCALE,
  SYNTAX_L,
} from "./config";
import { ensureContrast } from "./contrast";
import {
  clamp,
  deltaEOk,
  hexToOklch,
  hueDist,
  oklchToHex,
} from "./oklch-utils";

const SLOTS: readonly SyntaxSlot[] = [
  "accent",
  "keyword",
  "func",
  "string",
  "type",
  "number",
  "operator",
  "preproc",
];

/** 2つの seed hue から 8色分の hue を配置する */
const distributeHues = (h1: number, h2: number): number[] => {
  const hues: number[] = [h1, h2];

  const cwArc = (h2 - h1 + 360) % 360 || 360;
  const ccwArc = 360 - cwArc;

  const total = 6;
  const nCw = Math.round(total * (cwArc / 360));
  const nCcw = total - nCw;

  for (let k = 1; k <= nCw; k++) {
    hues.push((h1 + (cwArc * k) / (nCw + 1)) % 360);
  }
  for (let k = 1; k <= nCcw; k++) {
    hues.push((h2 + (ccwArc * k) / (nCcw + 1)) % 360);
  }

  return hues;
};

/** バネモデルで MIN_HUE_GAP を保証する */
const enforceMinHueGap = (hues: number[]): number[] => {
  const result = [...hues];
  const damping = 0.3;
  const maxIter = 20;
  const threshold = 0.5;

  for (let iter = 0; iter < maxIter; iter++) {
    let maxForce = 0;
    const forces = result.map(() => 0);

    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        if (i < 2 && j < 2) continue;
        const dist = hueDist(result[i], result[j]);
        if (dist >= MIN_HUE_GAP) continue;

        const push = (MIN_HUE_GAP - dist) * damping;
        maxForce = Math.max(maxForce, push);

        if (i >= 2) forces[i] -= push;
        if (j >= 2) forces[j] += push;
      }
    }

    if (maxForce < threshold) break;
    for (let i = 2; i < result.length; i++) {
      result[i] = (result[i] + forces[i] + 360) % 360;
    }
  }

  return result;
};

export const generateSyntax = (
  seed1: Oklch,
  seed2: Oklch,
  tone: ThemeTone,
  bgHex: string,
): Record<SyntaxSlot, string> => {
  const rawHues = distributeHues(seed1.h, seed2.h);
  const hues = enforceMinHueGap(rawHues);

  const cTarget = Math.max(
    ((seed1.c + seed2.c) / 2) * SYNTAX_C_SCALE,
    SYNTAX_C_MIN,
  );

  const hexes = hues.map((h, i) => {
    const l = SYNTAX_L[tone][i];
    const hex = oklchToHex(l, cTarget, h);
    return ensureContrast(hex, bgHex, LC_SYNTAX);
  });

  // 弁別性修正 (gap-fill 色 = index 2-7 のみ L を調整)
  for (let iter = 0; iter < DISCRIMINATION_MAX_ITER; iter++) {
    let allPass = true;
    for (let i = 2; i < hexes.length; i++) {
      for (let j = 0; j < hexes.length; j++) {
        if (i === j) continue;
        if (deltaEOk(hexes[i], hexes[j]) >= MIN_DELTA_E) continue;
        allPass = false;

        const parsed = hexToOklch(hexes[i]);
        const sign = i % 2 === 0 ? 1 : -1;
        const newL = clamp(parsed.l + DISCRIMINATION_L_SHIFT * sign, 0.2, 0.95);
        hexes[i] = ensureContrast(
          oklchToHex(newL, parsed.c, parsed.h),
          bgHex,
          LC_SYNTAX,
        );
      }
    }
    if (allPass) break;
  }

  const entries = SLOTS.map((slot, i) => [slot, hexes[i]] as const);
  return Object.fromEntries(entries) as Record<SyntaxSlot, string>;
};
