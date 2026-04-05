/**
 * 色相環の隙間充填 + 最小色相距離保証
 *
 * - computeGaps / fillGaps: 色相環上の最大ギャップを動的に分割
 * - enforceMinHueGap: Cohen-Or (2006) の色相テンプレート簡易適用 (バネモデル)
 */

import type { HueGap, Oklch, ThemeTone } from "../types/accent-palette";

import { CONFIG } from "./config";
import { hueDist } from "./oklch-utils";

const MERGE_THRESHOLD = 5;

/** 近接 hue をマージ (重複 hue で 360° ギャップが複製される問題を防ぐ) */
export const mergeCloseHues = (hues: number[]): number[] => {
  const sorted = hues.toSorted((a, b) => a - b);
  const merged: number[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (hueDist(sorted[i], merged[merged.length - 1]) > MERGE_THRESHOLD) {
      merged.push(sorted[i]);
    }
  }
  return merged;
};

/** 色相リストから色相環上のギャップを計算する */
export const computeGaps = (hues: number[]): HueGap[] => {
  const sorted = hues.toSorted((a, b) => a - b);
  return sorted.map((start, i) => {
    const end = sorted[(i + 1) % sorted.length];
    let size = end - start;
    if (size <= 0) size += 360;
    return { start, end, size };
  });
};

/** 最大ギャップの中間に色を配置し、ギャップを二分割する。count 回繰り返す */
export const fillGaps = (gaps: HueGap[], count: number): number[] => {
  const workGaps = gaps.map((g) => ({ ...g }));
  const filled: number[] = [];
  for (let i = 0; i < count; i++) {
    workGaps.sort((a, b) => b.size - a.size); // in-place sort on mutable copy
    const gap = workGaps.shift();
    if (!gap) break;
    let mid = gap.start + gap.size / 2;
    if (mid >= 360) mid -= 360;
    filled.push(mid);
    workGaps.push({ start: gap.start, end: mid, size: gap.size / 2 });
    workGaps.push({ start: mid, end: gap.end, size: gap.size / 2 });
  }
  return filled;
};

/** 全色相ペアが minHueGap 以上離れるようバネモデルで押し広げる */
export const enforceMinHueGap = (
  seedHues: number[],
  filledHues: number[],
): number[] => {
  const result = [...filledHues];
  const fixed = [...seedHues];
  const { damping, maxIter, convergeThreshold } = CONFIG.hueGap;

  for (let iter = 0; iter < maxIter; iter++) {
    const forces = result.map(() => 0);
    let maxForce = 0;
    for (let i = 0; i < result.length; i++) {
      const others = [...fixed, ...result.filter((_, j) => j !== i)];
      for (const other of others) {
        const dist = hueDist(result[i], other);
        if (dist < CONFIG.minHueGap && dist > 0) {
          const diff = ((result[i] - other + 540) % 360) - 180;
          const force = (CONFIG.minHueGap - dist) * damping;
          forces[i] += (diff >= 0 ? 1 : -1) * force;
          maxForce = Math.max(maxForce, Math.abs(force));
        }
      }
    }
    if (maxForce < convergeThreshold) break;
    for (let i = 0; i < result.length; i++) {
      result[i] = (((result[i] + forces[i]) % 360) + 360) % 360;
    }
  }
  return result;
};

/** gap-filled 色の target chroma を AI 3 色の中央値から算出 */
export const computeTargetC = (seeds: Oklch[]): number => {
  const chromas = seeds.map((s) => s.c).toSorted((a, b) => a - b);
  return chromas[Math.floor(chromas.length / 2)] * CONFIG.chromaScale;
};

/** 色相順ソート → zigzag で L を割り当て (O'Donovan 2011) */
export const assignLByHueZigzag = (
  filledHues: number[],
  tone: ThemeTone,
): number[] => {
  const lPool = CONFIG.lJitter[tone].toSorted((a, b) => a - b);
  const zigzag = [0, 3, 1, 2];
  const indexed = filledHues
    .map((h, i) => ({ h, i }))
    .toSorted((a, b) => a.h - b.h);
  const assignment = Array.from<number>({ length: filledHues.length });
  indexed.forEach((entry, sortedIdx) => {
    assignment[entry.i] = lPool[zigzag[sortedIdx]];
  });
  return assignment;
};

/** error hue が primary hue と近い場合にずらす */
export const resolveErrorHue = (primaryHue: number): number => {
  if (hueDist(primaryHue, CONFIG.errorHue) >= CONFIG.minHueGap)
    return CONFIG.errorHue;
  const candidates = [CONFIG.errorHueMin, CONFIG.errorHueMax, CONFIG.errorHue];
  return candidates.reduce((best, c) =>
    hueDist(primaryHue, c) > hueDist(primaryHue, best) ? c : best,
  );
};
