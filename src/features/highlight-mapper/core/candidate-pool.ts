import type { Color, SwatchMap, SwatchRole } from "colorthief";
import { hexToOklch, type OklchValues } from "./oklch-utils";

/** 候補色: hex + OkLch + 出所 */
export type Candidate = {
  hex: string;
  oklch: OklchValues;
  source: "dominant" | SwatchRole;
};

const VIBRANT_ROLES: SwatchRole[] = ["Vibrant", "DarkVibrant", "LightVibrant"];

/**
 * OkLch 空間でのユークリッド色差
 *
 * hue は角度なので最短距離を使う。
 */
const oklchDistance = (a: OklchValues, b: OklchValues): number => {
  const dL = a.l - b.l;
  const dC = a.c - b.c;
  const rawDH = Math.abs(a.h - b.h);
  const dH = rawDH > 180 ? 360 - rawDH : rawDH;
  return Math.sqrt(dL * dL + dC * dC + (dH / 360) * (dH / 360));
};

const DEDUP_THRESHOLD = 0.08;

/**
 * dominant 5色 + Vibrant 系 swatch から候補プールを構築する
 *
 * 1. dominant 5色を全て追加
 * 2. Vibrant 系 swatch のうち null でないものを追加（重複除外）
 * 3. 重複 = 既存候補との OkLch 色差が DEDUP_THRESHOLD 未満
 */
export const buildCandidatePool = (
  seeds: Color[],
  swatches: SwatchMap,
): Candidate[] => {
  const pool: Candidate[] = seeds.map((seed) => ({
    hex: seed.hex(),
    oklch: hexToOklch(seed.hex()),
    source: "dominant" as const,
  }));

  for (const role of VIBRANT_ROLES) {
    const swatch = swatches[role];
    if (!swatch) continue;

    const hex = swatch.color.hex();
    const oklch = hexToOklch(hex);

    const isDuplicate = pool.some(
      (existing) => oklchDistance(existing.oklch, oklch) < DEDUP_THRESHOLD,
    );
    if (!isDuplicate) {
      pool.push({ hex, oklch, source: role });
    }
  }

  return pool;
};
