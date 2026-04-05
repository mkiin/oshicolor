/**
 * Diagnostic パレット生成
 *
 * 固定 hue + seed の L/C から D0-D3 を導出する。
 */

import type { DiagnosticSlot } from "../types/palette";

import type { MoodPreset } from "./config";
import { DIAGNOSTIC_C_MIN, DIAGNOSTIC_HUE } from "./config";
import { ensureContrast } from "./contrast";
import { oklchToHex } from "./oklch-utils";

const SLOTS: readonly DiagnosticSlot[] = ["error", "warn", "info", "hint"];

export const generateDiagnostic = (
  seedC: number,
  preset: MoodPreset,
  bgHex: string,
): Record<DiagnosticSlot, string> => {
  const l = preset.diagnosticL;
  const c = Math.max(seedC * 0.8, DIAGNOSTIC_C_MIN);

  const entries = SLOTS.map((slot) => {
    const hex = oklchToHex(l, c, DIAGNOSTIC_HUE[slot]);
    return [
      slot,
      ensureContrast(hex, bgHex, preset.lcSyntax, preset.chromaBoost),
    ] as const;
  });

  return Object.fromEntries(entries) as Record<DiagnosticSlot, string>;
};
