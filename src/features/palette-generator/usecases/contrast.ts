/**
 * APCA コントラスト計算 + ensureContrast
 *
 * Color.js APCA 0.0.98G (Myndex/apca-w3) を移植。
 * 参照: V01 research/color-js-contrast.md
 */

import { clamp, hexToOklch, hexToSrgb, oklchToHex } from "./oklch-utils";

// --- APCA 定数 ---
const NORM_BG = 0.56;
const NORM_TXT = 0.57;
const REV_TXT = 0.62;
const REV_BG = 0.65;
const BLK_THRS = 0.022;
const BLK_CLMP = 1.414;
const LO_CLIP = 0.1;
const DELTA_Y_MIN = 0.0005;
const SCALE_BOW = 1.14;
const SCALE_WOB = 1.14;
const LO_BOW_OFFSET = 0.027;
const LO_WOB_OFFSET = 0.027;

const R_CO = 0.2126729;
const G_CO = 0.7151522;
const B_CO = 0.072175;

const linearize = (val: number): number =>
  Math.sign(val) * Math.abs(val) ** 2.4;

const luminance = (r: number, g: number, b: number): number =>
  linearize(r) * R_CO + linearize(g) * G_CO + linearize(b) * B_CO;

const fclamp = (y: number): number =>
  y >= BLK_THRS ? y : y + (BLK_THRS - y) ** BLK_CLMP;

/** APCA コントラスト値 (Lc) を計算する */
export const contrastAPCA = (bgHex: string, fgHex: string): number => {
  const bg = hexToSrgb(bgHex);
  const fg = hexToSrgb(fgHex);

  const yBg = fclamp(luminance(bg.r, bg.g, bg.b));
  const yFg = fclamp(luminance(fg.r, fg.g, fg.b));

  if (Math.abs(yBg - yFg) < DELTA_Y_MIN) return 0;

  let c: number;
  if (yBg > yFg) {
    c = (yBg ** NORM_BG - yFg ** NORM_TXT) * SCALE_BOW;
  } else {
    c = (yBg ** REV_BG - yFg ** REV_TXT) * SCALE_WOB;
  }

  if (Math.abs(c) < LO_CLIP) return 0;
  return (c > 0 ? c - LO_BOW_OFFSET : c + LO_WOB_OFFSET) * 100;
};

/**
 * fg の L を調整して APCA |Lc| >= targetLc を保証する
 *
 * chromaBoost: light テーマで L を下げるとき、chroma を補償する倍率。
 *   1.0 = 補償なし (light-pastel)
 *   1.5 = 積極的に補償 (light)
 * chromaDampen: dark テーマで L を上げるとき、chroma を抑制する係数。
 *   0   = 抑制なし (light 系)
 *   0.8 = ΔL に比例して chroma を下げる (dark)
 */
export const ensureContrast = (
  fgHex: string,
  bgHex: string,
  targetLc: number,
  chromaBoost: number = 1.0,
  chromaDampen: number = 0,
): string => {
  const lc = contrastAPCA(bgHex, fgHex);
  if (Math.abs(lc) >= targetLc) return fgHex;

  const fg = hexToOklch(fgHex);
  const bgL = hexToOklch(bgHex).l;
  const dir = bgL < 0.5 ? 1 : -1;
  const originalL = fg.l;

  for (let delta = 0.005; delta <= 0.8; delta += 0.005) {
    const newL = clamp(fg.l + delta * dir, 0.05, 0.98);

    const deltaL = Math.abs(newL - originalL);
    // light テーマで L を下げるとき: ΔL に比例して chroma を boost
    // dark テーマで L を上げるとき: ΔL に比例して chroma を dampen
    const cScale =
      dir === -1
        ? 1 + deltaL * (chromaBoost - 1 + 0.8)
        : 1 - deltaL * chromaDampen;
    const newC = clamp(fg.c * cScale, 0, 0.3);

    const candidate = oklchToHex(newL, newC, fg.h);
    if (Math.abs(contrastAPCA(bgHex, candidate)) >= targetLc) {
      return candidate;
    }
  }

  return fgHex;
};
