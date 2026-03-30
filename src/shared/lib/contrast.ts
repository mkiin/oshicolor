/**
 * WCAG コントラスト比の計算と、目標コントラスト比を満たす Tone の逆算。
 * Google material-color-utilities の Contrast クラスを移植。
 *
 * Tone は L*a*b* の L* 相当（0〜100）。
 * HCT の T、OKLCH の L とは異なるので注意（L* は CIE 規格）。
 *
 * @see https://github.com/nicolo-ribaudo/tc39-proposal-color/blob/main/color-utils/contrast.ts
 * @license Apache-2.0 (original by Google LLC)
 */

// --- 内部ユーティリティ ---

const clamp = (min: number, max: number, value: number): number =>
  Math.min(Math.max(value, min), max);

/**
 * CIE L*a*b* の非線形変換関数。
 * L* → XYZ の Y 値変換に使用。
 */
const labF = (t: number): number => {
  const e = 216.0 / 24389.0;
  const kappa = 24389.0 / 27.0;
  return t > e ? Math.cbrt(t) : (kappa * t + 16) / 116;
};

const labInvF = (ft: number): number => {
  const e = 216.0 / 24389.0;
  const kappa = 24389.0 / 27.0;
  const ft3 = ft * ft * ft;
  return ft3 > e ? ft3 : (116 * ft - 16) / kappa;
};

/** L* (Tone, 0〜100) → XYZ の Y (相対輝度, 0〜100) */
export const yFromTone = (tone: number): number =>
  100.0 * labInvF((tone + 16.0) / 116.0);

/** XYZ の Y (相対輝度, 0〜100) → L* (Tone, 0〜100) */
export const toneFromY = (y: number): number => labF(y / 100.0) * 116.0 - 16.0;

// --- Contrast ---

/**
 * 2つの Tone からコントラスト比（1〜21）を計算する。
 */
export const contrastRatioOfTones = (toneA: number, toneB: number): number => {
  const a = clamp(0, 100, toneA);
  const b = clamp(0, 100, toneB);
  const y1 = yFromTone(a);
  const y2 = yFromTone(b);
  const lighter = Math.max(y1, y2);
  const darker = Math.min(y1, y2);
  return (lighter + 5.0) / (darker + 5.0);
};

/**
 * 指定した Tone に対して、目標コントラスト比を満たす **より明るい** Tone を返す。
 * 達成不可の場合は -1 を返す。
 */
export const lighterTone = (tone: number, ratio: number): number => {
  if (tone < 0 || tone > 100) return -1;

  const darkY = yFromTone(tone);
  const lightY = ratio * (darkY + 5.0) - 5.0;
  if (lightY < 0 || lightY > 100) return -1;

  const realContrast =
    (Math.max(lightY, darkY) + 5.0) / (Math.min(lightY, darkY) + 5.0);
  if (realContrast < ratio && Math.abs(realContrast - ratio) > 0.04) return -1;

  const result = toneFromY(lightY) + 0.4;
  return result < 0 || result > 100 ? -1 : result;
};

/**
 * 指定した Tone に対して、目標コントラスト比を満たす **より暗い** Tone を返す。
 * 達成不可の場合は -1 を返す。
 */
export const darkerTone = (tone: number, ratio: number): number => {
  if (tone < 0 || tone > 100) return -1;

  const lightY = yFromTone(tone);
  const darkY = (lightY + 5.0) / ratio - 5.0;
  if (darkY < 0 || darkY > 100) return -1;

  const realContrast =
    (Math.max(lightY, darkY) + 5.0) / (Math.min(lightY, darkY) + 5.0);
  if (realContrast < ratio && Math.abs(realContrast - ratio) > 0.04) return -1;

  const result = toneFromY(darkY) - 0.4;
  return result < 0 || result > 100 ? -1 : result;
};

/**
 * lighterTone の安全版。達成不可の場合は 100 を返す。
 */
export const lighterToneUnsafe = (tone: number, ratio: number): number => {
  const safe = lighterTone(tone, ratio);
  return safe < 0 ? 100 : safe;
};

/**
 * darkerTone の安全版。達成不可の場合は 0 を返す。
 */
export const darkerToneUnsafe = (tone: number, ratio: number): number => {
  const safe = darkerTone(tone, ratio);
  return safe < 0 ? 0 : safe;
};

// --- HEX ユーティリティ ---

/**
 * HEX (#rrggbb) → sRGB 相対輝度 (0〜1)
 */
export const relativeLuminanceFromHex = (hex: string): number => {
  const h = hex.replace("#", "");
  const r = Number.parseInt(h.slice(0, 2), 16) / 255;
  const g = Number.parseInt(h.slice(2, 4), 16) / 255;
  const b = Number.parseInt(h.slice(4, 6), 16) / 255;
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
};

/**
 * 2つの HEX 色のコントラスト比（1〜21）を計算する。
 */
export const contrastRatioOfHex = (hex1: string, hex2: string): number => {
  const l1 = relativeLuminanceFromHex(hex1);
  const l2 = relativeLuminanceFromHex(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
};

/**
 * HEX 色 → Tone (L*, 0〜100) を返す。
 */
export const toneFromHex = (hex: string): number => {
  const y = relativeLuminanceFromHex(hex) * 100;
  return toneFromY(y);
};
