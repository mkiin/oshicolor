/**
 * Oklab 距離計算ユーティリティ
 *
 * Oklab (直交座標) はユークリッド距離で知覚的な色差を正確に測れる。
 * OKLCH (極座標) の色相 wrap-around 問題を回避する。
 */

import type { Oklab } from "../types/accent-palette";

import * as culori from "culori";

/** hex → Oklab 変換 */
export const hexToOklab = (hex: string): Oklab => {
  const r = culori.oklab(hex);
  return { l: r?.l ?? 0, a: r?.a ?? 0, b: r?.b ?? 0 };
};

/** Oklab ユークリッド距離 */
export const oklabDist = (a: Oklab, b: Oklab): number =>
  Math.sqrt((a.l - b.l) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2);
