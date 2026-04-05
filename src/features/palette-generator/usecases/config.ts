/**
 * パレット生成の定数設定
 *
 * 論文ベースの根拠:
 * - Ottosson (2020): Oklab/OKLCH
 * - Cohen-Or et al. (SIGGRAPH 2006): 最小色相距離 ≥ 30°
 * - O'Donovan et al. (SIGGRAPH 2011): Luminance Jittering
 * - Gramazio et al. (2017): accent 間 ΔE_ok ≥ 0.08
 */

export const CONFIG = {
  achromaticCBase: 0.015,
  tintedGrayC: 0.025,
  chromaScale: 0.9,
  errorHue: 25,
  errorHueMin: 0,
  errorHueMax: 55,
  errorChromaMin: 0.15,
  minHueGap: 30,
  minDeltaE: 0.08,
  contrastAA: 4.5,
  contrastSubdued: 3.0,
  variant1ChromaScale: 0.6,
  variant3LOffset: 0.08,
  lJitter: {
    dark: [0.68, 0.76, 0.72, 0.8] as readonly number[],
    light: [0.42, 0.5, 0.46, 0.38] as readonly number[],
  },
  neutral: {
    dark: {
      bg: { lMin: 0.1, lMax: 0.22, cMax: 0.02, cFallback: 0.015 },
      fg: { lMin: 0.82, lMax: 0.92 },
      fgLevels: { comment: 0.45, lineNr: 0.4, border: 0.3, delimiter: 0.6 },
    },
    light: {
      bg: { lMin: 0.92, lMax: 0.95, cMax: 0.02, cFallback: 0.015 },
      fg: { lMin: 0.15, lMax: 0.25 },
      fgLevels: { comment: 0.55, lineNr: 0.6, border: 0.7, delimiter: 0.45 },
    },
  },
  neutralOffsets: {
    surface: 0.02,
    cursorLine: 0.05,
    popup: 0.04,
    visual: 0.08,
  },
  ui: {
    bgCrMin: 3.0,
    fgCrMin: 2.0,
    frameChromaScale: 0.5,
    frameL: { dark: 0.35, light: 0.65 },
    searchBgL: { dark: 0.3, light: 0.85 },
  },
  discrimination: {
    adjustableIndices: [3, 4, 5, 6] as readonly number[],
    lShift: 0.03,
    maxIter: 5,
  },
  neutralMinDeltaL: 0.04,
  hueGap: { damping: 0.3, maxIter: 20, convergeThreshold: 0.5 },
  errorL: { dark: 0.72, light: 0.45 },
} as const;
