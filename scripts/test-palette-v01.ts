/**
 * V01 隙間充填パレット生成テストスクリプト
 *
 * パイプライン:
 *   AI 3色 → theme_tone 推定 → 低彩度補正 → 隙間充填 → 最小色相距離保証
 *   → L 分散 → error hue 解決 → neutral 派生 → variant → コントラスト保証
 *   → 弁別性自動修正 → neutral spacing → UI ロール → SVG 出力
 *
 * 理論的根拠:
 * - Ottosson (2020): Oklab/OKLCH — 知覚均等色空間、gamut mapping に clampChroma 使用
 * - Cohen-Or et al. (SIGGRAPH 2006): 色相テンプレート → 最小色相距離 ≥ 30° で簡易適用
 * - O'Donovan et al. (SIGGRAPH 2011): 調和パレットは lightness variance が高い → L 分散
 * - Gramazio et al. (2017): Colorgorical — accent 間 ΔE_ok ≥ 0.08 で弁別性保証
 *
 * Usage: node scripts/test-palette-v01.ts
 */

import * as culori from "culori";
import {
  writeFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { join, basename } from "node:path";

// ────────────────────────────────────────────────────────────
// §1 Config
// ────────────────────────────────────────────────────────────

const CONFIG = {
  /** 低彩度判定の基準値 (JND ベース) */
  achromaticCBase: 0.015,
  /** Tinted Gray 化時の chroma */
  tintedGrayC: 0.025,
  /** gap-filled 色の chroma スケール (AI 中央値 × この値) */
  chromaScale: 0.9,
  /** error hue のデフォルト・範囲 */
  errorHue: 25,
  errorHueMin: 0,
  errorHueMax: 55,
  errorChromaMin: 0.15,
  /** 最小色相距離 (°) — Cohen-Or 2006 */
  minHueGap: 30,
  /** 弁別性閾値 — Gramazio 2017 */
  minDeltaE: 0.08,
  /** WCAG コントラスト比 */
  contrastAA: 4.5,
  contrastSubdued: 3.0,
  /** variant 生成 */
  variant1ChromaScale: 0.6,
  variant3LOffset: 0.08,
  /** Luminance Jittering — O'Donovan 2011 */
  lJitter: {
    dark: [0.68, 0.76, 0.72, 0.8],
    light: [0.42, 0.5, 0.46, 0.38],
  },
  /** neutral L 範囲 */
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
  /** neutral 派生の L オフセット (dark 基準、light は符号反転) */
  neutralOffsets: {
    surface: 0.02,
    cursorLine: 0.05,
    popup: 0.04,
    visual: 0.08,
  },
  /** UI 色 */
  ui: {
    bgCrMin: 3.0,
    fgCrMin: 2.0,
    frameChromaScale: 0.5,
    frameL: { dark: 0.35, light: 0.65 },
    searchBgL: { dark: 0.3, light: 0.85 },
  },
  /** 弁別性修正 */
  discrimination: {
    adjustableIndices: [3, 4, 5, 6],
    lShift: 0.03,
    maxIter: 5,
  },
  /** neutral fg spacing */
  neutralMinDeltaL: 0.04,
  /** enforceMinHueGap */
  hueGap: { damping: 0.3, maxIter: 20, convergeThreshold: 0.5 },
  /** error L */
  errorL: { dark: 0.72, light: 0.45 },
} as const;

// ────────────────────────────────────────────────────────────
// §2 Types
// ────────────────────────────────────────────────────────────

type ThemeTone = "dark" | "light";
type Oklch = { l: number; c: number; h: number };
type Oklab = { l: number; a: number; b: number };
type HueGap = { start: number; end: number; size: number };

type NeutralPalette = {
  bg: string;
  fg: string;
  bg_surface: string;
  bg_cursor_line: string;
  bg_visual: string;
  bg_popup: string;
  comment: string;
  line_nr: string;
  border: string;
  delimiter: string;
};

type AccentPalette = {
  color1: string;
  color1_variant: string;
  color2: string;
  color3: string;
  color3_variant: string;
  color4: string;
  color5: string;
  color6: string;
  color7: string;
  color8: string;
};

type UiColors = {
  navigation: string;
  attention: string;
  frame: string;
  search_bg: string;
  pmenu_sel_bg: string;
};

type PaletteResult = {
  theme_tone: ThemeTone;
  neutral: NeutralPalette;
  accent: AccentPalette;
  ui: UiColors;
};

type CharacterInput = {
  name: string;
  game: string;
  primary: string;
  secondary: string;
  tertiary: string;
  bg: string;
  fg: string;
};

// ────────────────────────────────────────────────────────────
// §3 Color utilities
// ────────────────────────────────────────────────────────────

const hexToOklch = (hex: string): Oklch => {
  const r = culori.oklch(hex);
  return { l: r?.l ?? 0, c: r?.c ?? 0, h: r?.h ?? 0 };
};

const hexToOklab = (hex: string): Oklab => {
  const r = culori.oklab(hex);
  return { l: r?.l ?? 0, a: r?.a ?? 0, b: r?.b ?? 0 };
};

/** Gamut mapping — culori clampChroma (Ottosson 2020) */
const toHex = (l: number, c: number, h: number): string =>
  culori.formatHex(
    culori.clampChroma({ mode: "oklch", l, c, h }, "oklch", "rgb"),
  );

const vToHex = (v: Oklch): string => toHex(v.l, v.c, v.h);

const oklabDist = (a: Oklab, b: Oklab): number =>
  Math.sqrt((a.l - b.l) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2);

const clamp = (v: number, min: number, max: number): number =>
  Math.min(Math.max(v, min), max);

/** 色相環上の最短距離 */
const hueDist = (h1: number, h2: number): number => {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
};

// ────────────────────────────────────────────────────────────
// §3.1 Contrast (WCAG 2.x)
// ────────────────────────────────────────────────────────────

const relativeLuminance = (hex: string): number => {
  const rgb = culori.rgb(hex);
  if (!rgb) return 0;
  const lin = (c: number) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return (
    0.2126 * lin(Math.max(0, rgb.r)) +
    0.7152 * lin(Math.max(0, rgb.g)) +
    0.0722 * lin(Math.max(0, rgb.b))
  );
};

const contrastRatio = (hex1: string, hex2: string): number => {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

/**
 * fg の L を調整して bg とのコントラスト比 >= minRatio を保証する。
 * bg の L から探索方向を自動判定:
 *   dark bg (L < 0.5) → L を上げる
 *   light bg (L >= 0.5) → L を下げる
 */
const ensureContrast = (
  fgHex: string,
  bgHex: string,
  minRatio: number,
): string => {
  if (contrastRatio(fgHex, bgHex) >= minRatio) return fgHex;
  const fg = hexToOklch(fgHex);
  const bgL = hexToOklch(bgHex).l;
  const step = 0.01;

  if (bgL < 0.5) {
    // dark bg → L を上げて明るくする
    for (let ll = fg.l + step; ll <= 0.95; ll += step) {
      const hex = toHex(ll, fg.c, fg.h);
      if (contrastRatio(hex, bgHex) >= minRatio) return hex;
    }
    return toHex(0.95, fg.c, fg.h);
  }
  // light bg → L を下げて暗くする
  for (let ll = fg.l - step; ll >= 0.05; ll -= step) {
    const hex = toHex(ll, fg.c, fg.h);
    if (contrastRatio(hex, bgHex) >= minRatio) return hex;
  }
  return toHex(0.05, fg.c, fg.h);
};

// ────────────────────────────────────────────────────────────
// §4 Pipeline steps
// ────────────────────────────────────────────────────────────

// §4.0 theme_tone 推定
const detectThemeTone = (bgHex: string): ThemeTone =>
  hexToOklch(bgHex).l < 0.5 ? "dark" : "light";

// §4.1 stabilizeHue — 低彩度入力の補正

/**
 * L に応じた低彩度判定閾値
 * 暗い色 (L < 0.3): C=0.02〜0.03 でも事実上無彩色 → 閾値を上げる
 * 明るい色 (L > 0.85): 高 L で彩度知覚が低下 → 閾値を上げる
 */
const achromaticThreshold = (l: number): number => {
  if (l < 0.3) return 0.035;
  if (l > 0.85) return 0.025;
  return CONFIG.achromaticCBase;
};

const stabilizeHue = (seeds: Oklch[]): Oklch[] => {
  const primaryHue = seeds[0].h;
  return seeds.map((s, i) => {
    if (i === 0) return s;
    if (s.c <= achromaticThreshold(s.l)) {
      return { l: s.l, c: CONFIG.tintedGrayC, h: primaryHue };
    }
    return s;
  });
};

// §4.2 computeGaps + fillGaps — 色相環の隙間充填

/**
 * 近接 hue をマージしてからギャップを計算する。
 * mergeThreshold° 以内の hue は 1 つにまとめる。
 * これにより Aglaea (90°x3) や Kafka (1°-3°) のような
 * 重複 hue で 360° ギャップが複製される問題を防ぐ。
 */
const MERGE_THRESHOLD = 5;

const mergeCloseHues = (hues: number[]): number[] => {
  const sorted = [...hues].sort((a, b) => a - b);
  const merged: number[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (hueDist(sorted[i], merged[merged.length - 1]) > MERGE_THRESHOLD) {
      merged.push(sorted[i]);
    }
  }
  return merged;
};

const computeGaps = (hues: number[]): HueGap[] => {
  const sorted = [...hues].sort((a, b) => a - b);
  const gaps: HueGap[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    const end = sorted[(i + 1) % sorted.length];
    let size = end - start;
    if (size <= 0) size += 360;
    gaps.push({ start, end, size });
  }
  return gaps;
};

const fillGaps = (gaps: HueGap[], count: number): number[] => {
  const workGaps = gaps.map((g) => ({ ...g }));
  const filled: number[] = [];
  for (let i = 0; i < count; i++) {
    workGaps.sort((a, b) => b.size - a.size);
    const gap = workGaps.shift()!;
    let mid = gap.start + gap.size / 2;
    if (mid >= 360) mid -= 360;
    filled.push(mid);
    workGaps.push({ start: gap.start, end: mid, size: gap.size / 2 });
    workGaps.push({ start: mid, end: gap.end, size: gap.size / 2 });
  }
  return filled;
};

// §4.3 enforceMinHueGap — 最小色相距離保証 (バネモデル)

const enforceMinHueGap = (
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

// §4.4 computeTargetLC + zigzag L 割り当て

const computeTargetC = (seeds: Oklch[]): number => {
  const chromas = seeds.map((s) => s.c).sort((a, b) => a - b);
  return chromas[Math.floor(chromas.length / 2)] * CONFIG.chromaScale;
};

/**
 * 色相順ソート → zigzag で L を割り当て。
 * 色相が隣接する gap-filled 色に最も離れた L を配置し ΔL を最大化する。
 */
const assignLByHueZigzag = (
  filledHues: number[],
  tone: ThemeTone,
): number[] => {
  const lPool = [...CONFIG.lJitter[tone]].sort((a, b) => a - b);
  const zigzag = [0, 3, 1, 2]; // [最小, 最大, 2番目, 3番目]
  const indexed = filledHues
    .map((h, i) => ({ h, i }))
    .sort((a, b) => a.h - b.h);
  const assignment = new Array<number>(filledHues.length);
  indexed.forEach((entry, sortedIdx) => {
    assignment[entry.i] = lPool[zigzag[sortedIdx]];
  });
  return assignment;
};

// §4.5 resolveErrorHue

const resolveErrorHue = (primaryHue: number): number => {
  if (hueDist(primaryHue, CONFIG.errorHue) >= CONFIG.minHueGap)
    return CONFIG.errorHue;
  const candidates = [CONFIG.errorHueMin, CONFIG.errorHueMax, CONFIG.errorHue];
  return candidates.reduce((best, c) =>
    hueDist(primaryHue, c) > hueDist(primaryHue, best) ? c : best,
  );
};

// §4.6 clampNeutral

const clampNeutral = (
  bgHex: string,
  fgHex: string,
  tone: ThemeTone,
): { bg: Oklch; fg: Oklch } => {
  const limits = CONFIG.neutral[tone];
  const bg = hexToOklch(bgHex);
  const fg = hexToOklch(fgHex);
  return {
    bg: {
      l: clamp(bg.l, limits.bg.lMin, limits.bg.lMax),
      c: bg.c > limits.bg.cMax ? limits.bg.cFallback : bg.c,
      h: bg.h,
    },
    fg: {
      l: clamp(fg.l, limits.fg.lMin, limits.fg.lMax),
      c: fg.c,
      h: fg.h,
    },
  };
};

// §4.7 deriveNeutralPalette

const deriveNeutralPalette = (
  bg: Oklch,
  fg: Oklch,
  tone: ThemeTone,
): NeutralPalette => {
  const sign = tone === "dark" ? 1 : -1;
  const off = CONFIG.neutralOffsets;
  const levels = CONFIG.neutral[tone].fgLevels;
  return {
    bg: vToHex(bg),
    fg: vToHex(fg),
    bg_surface: toHex(bg.l + off.surface * sign, bg.c, bg.h),
    bg_cursor_line: toHex(bg.l + off.cursorLine * sign, bg.c + 0.01, bg.h),
    bg_popup: toHex(bg.l + off.popup * sign, bg.c, bg.h),
    bg_visual: toHex(bg.l + off.visual * sign, bg.c, bg.h),
    comment: toHex(levels.comment, bg.c, fg.h),
    line_nr: toHex(levels.lineNr, bg.c, fg.h),
    border: toHex(levels.border, bg.c, fg.h),
    delimiter: toHex(levels.delimiter, bg.c, fg.h),
  };
};

// §4.8 generateVariants

const generateVariants = (c1: Oklch, c3: Oklch, tone: ThemeTone) => {
  const sign = tone === "dark" ? 1 : -1;
  return {
    color1_variant: { l: c1.l, c: c1.c * CONFIG.variant1ChromaScale, h: c1.h },
    color3_variant: {
      l: c3.l + CONFIG.variant3LOffset * sign,
      c: c3.c,
      h: c3.h,
    },
  };
};

// §4.9 checkDiscrimination + fixDiscrimination

const checkDiscrimination = (
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
          `  ⚠ ${labels[i]}↔${labels[j]} ΔE=${dist.toFixed(3)} < ${CONFIG.minDeltaE}`,
        );
      }
    }
  }
  return warnings;
};

/**
 * ΔE_ok < minDeltaE のペアを検出し、gap-filled 色 (c4〜c7) の L を ±0.03 調整。
 * 両方向を試し ΔE が最も改善する方を採用する。
 */
const fixDiscrimination = (accentHexes: string[], bgHex: string): string[] => {
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

    const iAdj = (adjustableIndices as readonly number[]).includes(worstI);
    const jAdj = (adjustableIndices as readonly number[]).includes(worstJ);
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

// §4.10 ensureNeutralSpacing — neutral fg 系の同色収束防止

const ensureNeutralSpacing = (hexes: string[], sign: number): string[] => {
  const oklchs = hexes.map(hexToOklch);
  for (let i = 1; i < oklchs.length; i++) {
    const gap = (oklchs[i - 1].l - oklchs[i].l) * sign;
    if (gap < CONFIG.neutralMinDeltaL) {
      const shift = (CONFIG.neutralMinDeltaL - gap) * sign;
      oklchs[i] = { ...oklchs[i], l: clamp(oklchs[i].l - shift, 0.05, 0.95) };
    }
  }
  return oklchs.map(vToHex);
};

// §4.11 assignUiRoles + deriveUiColors

const assignUiRoles = (
  colors: Oklch[],
  bgHex: string,
  fgHex: string,
): {
  navigationHex: string;
  attentionIdx: number;
  attentionOverride?: string;
} => {
  const primary = colors[0];
  const primaryOklab = hexToOklab(vToHex(primary));

  let navigationHex = toHex(primary.l, primary.c, primary.h);
  navigationHex = ensureContrast(navigationHex, bgHex, CONFIG.ui.bgCrMin);

  const candidates = [1, 2]
    .map((i) => {
      const c = colors[i];
      const dist = oklabDist(hexToOklab(vToHex(c)), primaryOklab);
      return { i, score: dist * c.c };
    })
    .sort((a, b) => b.score - a.score);
  const attIdx = candidates[0].i;

  const attHex = vToHex(colors[attIdx]);
  const attBgCR = contrastRatio(attHex, bgHex);
  const attFgCR = contrastRatio(attHex, fgHex);
  if (attBgCR >= CONFIG.ui.bgCrMin && attFgCR >= CONFIG.ui.fgCrMin) {
    return { navigationHex, attentionIdx: attIdx };
  }

  // 救済: L 調整でコントラスト確保
  let rescued = ensureContrast(attHex, bgHex, CONFIG.ui.bgCrMin);
  if (contrastRatio(rescued, fgHex) < CONFIG.ui.fgCrMin) {
    const rOklch = hexToOklch(rescued);
    const fgL = hexToOklch(fgHex).l;
    const dir = rOklch.l > fgL ? -1 : 1;
    for (
      let ll = rOklch.l + 0.01 * dir;
      ll > 0.05 && ll < 0.95;
      ll += 0.01 * dir
    ) {
      const hex = toHex(ll, rOklch.c, rOklch.h);
      if (
        contrastRatio(hex, bgHex) >= CONFIG.ui.bgCrMin &&
        contrastRatio(hex, fgHex) >= CONFIG.ui.fgCrMin
      ) {
        rescued = hex;
        break;
      }
    }
  }
  return { navigationHex, attentionIdx: attIdx, attentionOverride: rescued };
};

const deriveUiColors = (
  colors: Oklch[],
  roles: ReturnType<typeof assignUiRoles>,
  bgVisualHex: string,
  tone: ThemeTone,
): UiColors => {
  const nav = hexToOklch(roles.navigationHex);
  return {
    navigation: roles.navigationHex,
    attention: roles.attentionOverride ?? vToHex(colors[roles.attentionIdx]),
    frame: toHex(
      CONFIG.ui.frameL[tone],
      nav.c * CONFIG.ui.frameChromaScale,
      nav.h,
    ),
    search_bg: toHex(CONFIG.ui.searchBgL[tone], nav.c, nav.h),
    pmenu_sel_bg: bgVisualHex,
  };
};

// ────────────────────────────────────────────────────────────
// §5 Pipeline orchestrator
// ────────────────────────────────────────────────────────────

const generatePalette = (input: CharacterInput): PaletteResult => {
  // 1. theme_tone 推定
  const tone = detectThemeTone(input.bg);

  // 2. AI 3色 → OKLCH + 低彩度補正
  const rawSeeds = [input.primary, input.secondary, input.tertiary].map(
    hexToOklch,
  );
  const seeds = stabilizeHue(rawSeeds);

  // 3. 隙間充填 (重複 hue マージ → gap → fill → 最小距離保証)
  const seedHues = seeds.map((s) => s.h);
  const mergedHues = mergeCloseHues(seedHues);
  const gaps = computeGaps(mergedHues);
  const rawFilledHues = fillGaps(gaps, 4);
  const filledHues = enforceMinHueGap(seedHues, rawFilledHues);

  // 4. gap-filled 色に L/C を割り当て
  const cTarget = computeTargetC(seeds);
  const lAssignment = assignLByHueZigzag(filledHues, tone);
  const filledColors: Oklch[] = filledHues.map((h, i) => ({
    l: lAssignment[i],
    c: cTarget,
    h,
  }));

  // 5. error 色
  const errorHue = resolveErrorHue(seeds[0].h);
  const color8: Oklch = {
    l: CONFIG.errorL[tone],
    c: Math.max(cTarget, CONFIG.errorChromaMin),
    h: errorHue,
  };

  // 6. variants
  const variants = generateVariants(seeds[0], seeds[2], tone);

  // 7. neutral
  const clamped = clampNeutral(input.bg, input.fg, tone);
  const neutral = deriveNeutralPalette(clamped.bg, clamped.fg, tone);
  const bgHex = neutral.bg;

  // 8. コントラスト保証 (accent)
  const ec = (v: Oklch, ratio = CONFIG.contrastAA) =>
    ensureContrast(toHex(v.l, v.c, v.h), bgHex, ratio);
  const accentHexes = {
    color1: ec(seeds[0]),
    color1_variant: ec(variants.color1_variant),
    color2: ec(seeds[1]),
    color3: ec(seeds[2]),
    color3_variant: ec(variants.color3_variant),
    color4: ec(filledColors[0]),
    color5: ec(filledColors[1]),
    color6: ec(filledColors[2]),
    color7: ec(filledColors[3]),
    color8: ec(color8),
  };

  // 9. 弁別性自動修正
  const accentKeys = [
    "color1",
    "color2",
    "color3",
    "color4",
    "color5",
    "color6",
    "color7",
    "color8",
  ] as const;
  const accentArray = accentKeys.map((k) => accentHexes[k]);
  const fixedAccent = fixDiscrimination(accentArray, bgHex);
  accentKeys.forEach((k, i) => {
    (accentHexes as Record<string, string>)[k] = fixedAccent[i];
  });

  // 10. neutral fg コントラスト保証 + spacing
  const adjustedFg = ensureContrast(neutral.fg, bgHex, CONFIG.contrastAA);
  const fgKeys = ["delimiter", "comment", "line_nr", "border"] as const;
  const rawFgHexes = fgKeys.map((k) =>
    ensureContrast(
      neutral[k === "line_nr" ? "line_nr" : k],
      bgHex,
      CONFIG.contrastSubdued,
    ),
  );
  // dark: delimiter > comment > line_nr > border (明→暗)
  // light: border > line_nr > comment > delimiter (明→暗、bg から遠い順)
  const spacedOrder = tone === "dark" ? rawFgHexes : [...rawFgHexes].reverse();
  const spaced = ensureNeutralSpacing(spacedOrder, tone === "dark" ? 1 : -1);
  const spacedFg = tone === "dark" ? spaced : [...spaced].reverse();

  const adjustedNeutral: NeutralPalette = {
    ...neutral,
    fg: adjustedFg,
    delimiter: spacedFg[0],
    comment: spacedFg[1],
    line_nr: spacedFg[2],
    border: spacedFg[3],
  };

  // 11. UI ロール
  const seedsForUi = seeds.map((_, i) => {
    const hex = [accentHexes.color1, accentHexes.color2, accentHexes.color3][i];
    return hexToOklch(hex);
  });
  const roles = assignUiRoles(seedsForUi, bgHex, adjustedNeutral.fg);

  // bg_visual を navigation hue で着色
  const navOklch = hexToOklch(roles.navigationHex);
  const bgOklch = hexToOklch(bgHex);
  const sign = tone === "dark" ? 1 : -1;
  adjustedNeutral.bg_visual = toHex(
    bgOklch.l + CONFIG.neutralOffsets.visual * sign,
    0.04,
    navOklch.h,
  );

  const ui = deriveUiColors(seedsForUi, roles, adjustedNeutral.bg_visual, tone);

  return {
    theme_tone: tone,
    neutral: adjustedNeutral,
    accent: accentHexes,
    ui,
  };
};

// ────────────────────────────────────────────────────────────
// §6 SVG output
// ────────────────────────────────────────────────────────────

const textColor = (hex: string): string => {
  const rgb = culori.rgb(hex);
  if (!rgb) return "#ffffff";
  return rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114 > 0.5
    ? "#000000"
    : "#ffffff";
};

const generateSvg = (
  name: string,
  input: CharacterInput,
  result: PaletteResult,
): string => {
  const isDark = result.theme_tone === "dark";
  const W = 640;
  const P = 16;
  const GAP = 3;
  const innerW = W - P * 2;
  let y = P;
  let body = "";

  const titleColor = isDark ? "#ccc" : "#333";
  const metaColor = isDark ? "#666" : "#888";
  const labelColor = isDark ? "#888" : "#666";

  const row = (
    label: string,
    colors: { label: string; hex: string }[],
    h: number,
  ) => {
    body += `  <text x="${P}" y="${y + 12}" fill="${labelColor}" font-size="10">${label}</text>\n`;
    y += 18;
    const sw = (innerW - GAP * (colors.length - 1)) / colors.length;
    for (let i = 0; i < colors.length; i++) {
      const c = colors[i];
      const x = P + i * (sw + GAP);
      const tc = textColor(c.hex);
      body += `  <rect x="${x}" y="${y}" width="${sw}" height="${h}" fill="${c.hex}" rx="2"/>\n`;
      body += `  <text x="${x + 3}" y="${y + 11}" fill="${tc}" font-size="7" opacity="0.8">${c.label}</text>\n`;
      body += `  <text x="${x + sw / 2}" y="${y + h - 4}" fill="${tc}" font-size="8" text-anchor="middle">${c.hex}</text>\n`;
    }
    y += h + GAP;
  };

  body += `  <text x="${P}" y="${y + 16}" fill="${titleColor}" font-size="16" font-weight="bold">${name}</text>`;
  body += `  <text x="${P + 200}" y="${y + 16}" fill="${metaColor}" font-size="12">${input.game} / ${result.theme_tone}</text>\n`;
  y += 28;

  row(
    "AI impression",
    [
      { label: "primary", hex: input.primary },
      { label: "secondary", hex: input.secondary },
      { label: "tertiary", hex: input.tertiary },
    ],
    35,
  );

  row(
    "AI neutral",
    [
      { label: "bg", hex: input.bg },
      { label: "fg", hex: input.fg },
    ],
    28,
  );

  const a = result.accent;
  row(
    "accent (generated)",
    [
      { label: "c1 keyword", hex: a.color1 },
      { label: "c1v tag", hex: a.color1_variant },
      { label: "c2 func", hex: a.color2 },
      { label: "c3 const", hex: a.color3 },
      { label: "c3v num", hex: a.color3_variant },
    ],
    40,
  );

  row(
    "accent (gap-filled)",
    [
      { label: "c4 string", hex: a.color4 },
      { label: "c5 type", hex: a.color5 },
      { label: "c6 special", hex: a.color6 },
      { label: "c7 preproc", hex: a.color7 },
      { label: "c8 error", hex: a.color8 },
    ],
    40,
  );

  const n = result.neutral;
  row(
    "neutral bg",
    [
      { label: "bg", hex: n.bg },
      { label: "surface", hex: n.bg_surface },
      { label: "cursor", hex: n.bg_cursor_line },
      { label: "popup", hex: n.bg_popup },
      { label: "visual", hex: n.bg_visual },
    ],
    35,
  );

  row(
    "neutral fg",
    [
      { label: "fg", hex: n.fg },
      { label: "comment", hex: n.comment },
      { label: "line_nr", hex: n.line_nr },
      { label: "border", hex: n.border },
      { label: "delimiter", hex: n.delimiter },
    ],
    35,
  );

  const u = result.ui;
  row(
    "ui",
    [
      { label: "navigation", hex: u.navigation },
      { label: "attention", hex: u.attention },
      { label: "frame", hex: u.frame },
      { label: "search_bg", hex: u.search_bg },
      { label: "pmenu_sel", hex: u.pmenu_sel_bg },
    ],
    35,
  );

  // syntax preview
  y += 8;
  body += `  <text x="${P}" y="${y + 12}" fill="${labelColor}" font-size="10">syntax preview</text>\n`;
  y += 18;
  body += `  <rect x="${P}" y="${y}" width="${innerW}" height="120" fill="${n.bg}" rx="4"/>\n`;
  const px = P + 12;
  let py = y + 16;
  const line = (parts: { text: string; color: string }[]) => {
    let cx = px;
    for (const p of parts) {
      body += `  <text x="${cx}" y="${py}" fill="${p.color}" font-size="11" font-family="monospace">${p.text}</text>\n`;
      cx += p.text.length * 6.6;
    }
    py += 16;
  };
  line([
    { text: "import", color: a.color1 },
    { text: " { useState } ", color: n.fg },
    { text: "from", color: a.color1 },
    { text: ' "react"', color: a.color4 },
  ]);
  line([
    { text: "const", color: a.color1 },
    { text: " count", color: n.fg },
    { text: " = ", color: n.fg },
    { text: "42", color: a.color3_variant },
  ]);
  line([
    { text: "function", color: a.color1 },
    { text: " greet", color: a.color2 },
    { text: "(", color: n.delimiter },
    { text: "name", color: a.color7 },
    { text: ": ", color: n.delimiter },
    { text: "string", color: a.color5 },
    { text: ")", color: n.delimiter },
  ]);
  line([{ text: "  // call the greeting", color: n.comment }]);
  line([
    { text: "  console", color: a.color6 },
    { text: ".log(", color: n.delimiter },
    { text: "`Hello ${", color: a.color4 },
    { text: "name", color: n.fg },
    { text: "}`", color: a.color4 },
    { text: ")", color: n.delimiter },
  ]);
  line([
    { text: "  return", color: a.color1 },
    { text: " true", color: a.color3 },
  ]);
  line([
    { text: "class", color: a.color1 },
    { text: " MyError", color: a.color5 },
    { text: " extends ", color: a.color1 },
    { text: "Error", color: a.color8 },
  ]);
  y += 128;

  const totalH = y + P;
  const svgBg = isDark ? "#0a0a0a" : "#f5f5f5";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${totalH}" style="background:${svgBg}; font-family:ui-monospace,monospace;">\n${body}</svg>`;
};

// ────────────────────────────────────────────────────────────
// §7 JSON loader
// ────────────────────────────────────────────────────────────

const OUTPUT_DIR = "debug/palette-v01";
const GAME_NAMES = ["genshin", "starrail", "nikke"];

/**
 * AI 出力 JSON スキーマ (plan.md §AI出力スキーマ)
 *
 * {
 *   impression: { primary: { hex, reason }, secondary: { hex, reason }, tertiary: { hex, reason } },
 *   theme_tone?: "dark" | "light",
 *   neutral: { bg_base_hex, fg_base_hex }
 * }
 */
type VisionResult = {
  impression: {
    primary: { hex: string; reason: string };
    secondary: { hex: string; reason: string };
    tertiary: { hex: string; reason: string };
  };
  theme_tone?: "dark" | "light";
  neutral: {
    bg_base_hex: string;
    fg_base_hex: string;
  };
};

const loadCharactersFromJson = (): CharacterInput[] => {
  const characters: CharacterInput[] = [];

  for (const game of GAME_NAMES) {
    const jsonDir = join(OUTPUT_DIR, game, "json");
    if (!existsSync(jsonDir)) continue;

    const files = readdirSync(jsonDir)
      .filter((f) => f.endsWith(".json"))
      .sort();

    for (const file of files) {
      const filePath = join(jsonDir, file);
      const raw = readFileSync(filePath, "utf-8");
      const data: VisionResult = JSON.parse(raw);
      const name = basename(file, ".json");

      characters.push({
        name,
        game,
        primary: data.impression.primary.hex,
        secondary: data.impression.secondary.hex,
        tertiary: data.impression.tertiary.hex,
        bg: data.neutral.bg_base_hex,
        fg: data.neutral.fg_base_hex,
      });
    }
  }

  return characters;
};

// ────────────────────────────────────────────────────────────
// §8 Main
// ────────────────────────────────────────────────────────────

const characters = loadCharactersFromJson();
console.log(
  `Loaded ${characters.length} characters from ${GAME_NAMES.join(", ")}`,
);

for (const char of characters) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`${char.name} (${char.game})`);

  const result = generatePalette(char);

  const svgDir = join(OUTPUT_DIR, char.game, "svg");
  mkdirSync(svgDir, { recursive: true });
  const svgPath = join(svgDir, `${char.name}.svg`);
  writeFileSync(svgPath, generateSvg(char.name, char, result));
  console.log(`  ${result.theme_tone} | SVG: ${svgPath}`);

  const a = result.accent;
  const allAccent = [
    a.color1,
    a.color2,
    a.color3,
    a.color4,
    a.color5,
    a.color6,
    a.color7,
  ];
  const hues = allAccent.map((h) => hexToOklch(h).h.toFixed(0)).join("° ");
  console.log(`  Hues: ${hues}°`);
  console.log(
    `  accent: c1=${a.color1} c2=${a.color2} c3=${a.color3} c4=${a.color4} c5=${a.color5} c6=${a.color6} c7=${a.color7} c8=${a.color8}`,
  );
  console.log(`  neutral: bg=${result.neutral.bg} fg=${result.neutral.fg}`);
  console.log(
    `  ui: nav=${result.ui.navigation} att=${result.ui.attention} frame=${result.ui.frame}`,
  );

  const labels = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"];
  const accentArr = [
    a.color1,
    a.color2,
    a.color3,
    a.color4,
    a.color5,
    a.color6,
    a.color7,
    a.color8,
  ];
  const warnings = checkDiscrimination(accentArr, labels);
  if (warnings.length > 0) {
    console.log(`  Discrimination warnings:`);
    for (const w of warnings) console.log(w);
  } else {
    console.log(`  Discrimination: ✓ all pairs ΔE ≥ ${CONFIG.minDeltaE}`);
  }
}

console.log(
  `\nDone. ${characters.length} characters processed. Output: ${OUTPUT_DIR}/`,
);
