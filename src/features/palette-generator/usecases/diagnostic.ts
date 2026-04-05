/**
 * Diagnostic パレット生成
 *
 * 固定 hue + seed の L/C から D0-D3 を導出する。
 */

import type { DiagnosticSlot, ThemeTone } from "../types/palette";

import {
  DIAGNOSTIC_C_MIN,
  DIAGNOSTIC_HUE,
  DIAGNOSTIC_L,
  LC_SYNTAX,
} from "./config";
import { ensureContrast } from "./contrast";
import { oklchToHex } from "./oklch-utils";

const SLOTS: readonly DiagnosticSlot[] = ["error", "warn", "info", "hint"];

export const generateDiagnostic = (
  seedC: number,
  tone: ThemeTone,
  bgHex: string,
): Record<DiagnosticSlot, string> => {
  const l = DIAGNOSTIC_L[tone];
  const c = Math.max(seedC * 0.8, DIAGNOSTIC_C_MIN);

  const entries = SLOTS.map((slot) => {
    const hex = oklchToHex(l, c, DIAGNOSTIC_HUE[slot]);
    return [slot, ensureContrast(hex, bgHex, LC_SYNTAX)] as const;
  });

  return Object.fromEntries(entries) as Record<DiagnosticSlot, string>;
};
