/**
 * accent 色間の弁別性検証・自動修正
 *
 * Gramazio et al. (2017) Colorgorical: ΔE_ok ≥ 0.08 で弁別性保証
 */

import { CONFIG } from "./config";
import { ensureContrast } from "./contrast";
import { hexToOklab, oklabDist } from "./oklab-utils";
import { hexToOklch, toHex, clamp } from "./oklch-utils";

/** accent 色間の ΔE_ok を検証し、不足ペアの警告を返す */
export const checkDiscrimination = (
  accentHexes: string[],
  labels: string[],
): string[] => {
  const warnings: string[] = [];
  const oklabs = accentHexes.map(hexToOklab);
  for (let i = 0; i < oklabs.length; i++) {
    for (let j = i + 1; j < oklabs.length; j++) {
      const dist = oklabDist(oklabs[i], oklabs[j]);
      if (dist < CONFIG.minDeltaE) {
        warnings.push(
          `${labels[i]}↔${labels[j]} ΔE=${dist.toFixed(3)} < ${CONFIG.minDeltaE}`,
        );
      }
    }
  }
  return warnings;
};

/** ΔE_ok < minDeltaE のペアを検出し、gap-filled 色の L を調整して解消する */
export const fixDiscrimination = (
  accentHexes: string[],
  bgHex: string,
): string[] => {
  const { adjustableIndices, lShift, maxIter } = CONFIG.discrimination;
  const result = [...accentHexes];
  const bgOklab = hexToOklab(bgHex);

  for (let iter = 0; iter < maxIter; iter++) {
    let worstDist = Infinity;
    let worstI = -1;
    let worstJ = -1;
    const oklabs = result.map(hexToOklab);
    for (let i = 0; i < oklabs.length; i++) {
      for (let j = i + 1; j < oklabs.length; j++) {
        const dist = oklabDist(oklabs[i], oklabs[j]);
        if (dist < CONFIG.minDeltaE && dist < worstDist) {
          worstDist = dist;
          worstI = i;
          worstJ = j;
        }
      }
    }
    if (worstI === -1) break;

    const iAdj = adjustableIndices.includes(worstI);
    const jAdj = adjustableIndices.includes(worstJ);
    let target: number;
    if (iAdj && jAdj) {
      target =
        oklabDist(oklabs[worstI], bgOklab) <= oklabDist(oklabs[worstJ], bgOklab)
          ? worstI
          : worstJ;
    } else if (iAdj) {
      target = worstI;
    } else if (jAdj) {
      target = worstJ;
    } else {
      break;
    }

    const tc = hexToOklch(result[target]);
    const other = target === worstI ? worstJ : worstI;
    let bestHex = result[target];
    let bestDist = worstDist;
    for (const dir of [1, -1]) {
      const newL = clamp(tc.l + lShift * dir, 0.15, 0.9);
      const candidate = ensureContrast(
        toHex(newL, tc.c, tc.h),
        bgHex,
        CONFIG.contrastAA,
      );
      const dist = oklabDist(hexToOklab(candidate), hexToOklab(result[other]));
      if (dist > bestDist) {
        bestDist = dist;
        bestHex = candidate;
      }
    }
    result[target] = bestHex;
  }
  return result;
};
