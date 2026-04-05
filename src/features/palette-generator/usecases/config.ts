/**
 * V02 パレット生成の定数設定
 *
 * 根拠:
 * - MD3 Tonal Palette / Tailwind CSS v4.2: Neutral chroma
 * - APCA (Somers 2022): コントラスト閾値
 * - Cohen-Or (SIGGRAPH 2006): 最小色相距離 >= 30
 * - Gramazio (2017): 弁別性閾値 deltaE >= 0.08
 * - Catppuccin: blend ratio
 */

import type { ThemeMood } from "../types/palette";

/**
 * Mood 別プリセット
 *
 * dark:         深く鮮やか。seed の L/C を活かす
 * light-pastel: パステル許容。コントラスト要求を緩めて明るさを維持
 * light:        くっきり。chroma boost + しっかり暗くしてコントラスト確保
 */
export const MOOD_PRESET = {
  dark: {
    tone: "dark" as const,
    neutralL: [0.18, 0.21, 0.23, 0.28, 0.4, 0.5, 0.85, 0.9],
    lcSyntax: 60,
    lcDim: 45,
    lcUi: 45,
    chromaBoost: 1.0,
    diagnosticL: 0.72,
  },
  "light-pastel": {
    tone: "light" as const,
    neutralL: [0.94, 0.91, 0.89, 0.84, 0.65, 0.55, 0.25, 0.18],
    lcSyntax: 45,
    lcDim: 30,
    lcUi: 35,
    chromaBoost: 1.0,
    diagnosticL: 0.55,
  },
  light: {
    tone: "light" as const,
    neutralL: [0.94, 0.91, 0.89, 0.84, 0.65, 0.55, 0.25, 0.18],
    lcSyntax: 60,
    lcDim: 45,
    lcUi: 45,
    chromaBoost: 1.5,
    diagnosticL: 0.45,
  },
} as const;

export type MoodPreset = (typeof MOOD_PRESET)[ThemeMood];

export const NEUTRAL_C = {
  bg: 0.018,
  mid: 0.012,
  text: 0.012,
  bright: 0.01,
} as const;

export const YELLOW_HUE_RANGE = { min: 60, max: 120 } as const;
export const YELLOW_C_OVERRIDE = 0.015;

export const SYNTAX_C_MIN = 0.08;

export const BLEND_RATIO = {
  statusBg: 0.08,
  statusBgDim: 0.04,
  tabSel: 0.1,
  winSep: 0.15,
  diffBg: 0.18,
  diffText: 0.3,
} as const;

export const DIAGNOSTIC_HUE = {
  error: 25,
  warn: 85,
  info: 250,
  hint: 165,
} as const;

export const DIAGNOSTIC_C_MIN = 0.12;

export const MIN_HUE_GAP = 30;
export const MIN_DELTA_E = 0.08;

export const LC_BORDER = 30;

/** 弁別性自動修正 */
export const DISCRIMINATION_L_SHIFT = 0.03;
export const DISCRIMINATION_MAX_ITER = 5;
