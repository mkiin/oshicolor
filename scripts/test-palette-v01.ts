/**
 * V01 隙間充填パレット生成テストスクリプト
 *
 * AI 出力 → 低彩度補正 → 隙間充填 → L分散 → 最小色相距離保証
 * → neutral 派生 → variant → UI ロール → 弁別性検証 → コントラスト保証 → SVG 出力
 *
 * 改善の根拠:
 * - Ottosson (2020): Oklab/OKLCH — 知覚均等色空間、gamut mapping に clampChroma 使用
 * - Cohen-Or et al. (SIGGRAPH 2006): 色相テンプレート → 最小色相距離 ≥ 30° で簡易適用
 * - O'Donovan et al. (SIGGRAPH 2011): 調和パレットは lightness variance が高い → L 分散
 * - Gramazio et al. (2017): Colorgorical — accent 間 ΔE_ok ≥ 0.08 で弁別性保証
 * - Solarized (Schoonover): 数学的 L ステップ均等設計の実例
 *
 * Usage: node scripts/test-palette-v01.ts
 */

import * as culori from "culori";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ============================================================
// types
// ============================================================

type OklchValues = { l: number; c: number; h: number };
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
  theme_tone: "dark" | "light";
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
  theme_tone: "dark" | "light";
};

// ============================================================
// oklch utils
// ============================================================

function hexToOklch(hex: string): OklchValues {
  const result = culori.oklch(hex);
  return { l: result?.l ?? 0, c: result?.c ?? 0, h: result?.h ?? 0 };
}

// ============================================================
// gamut clamp (culori clampChroma — binary search, Ottosson 2020)
// ============================================================

function gamutClamp(l: number, c: number, h: number): string {
  const clamped = culori.clampChroma(
    { mode: "oklch", l, c, h },
    "oklch",
    "rgb",
  );
  return culori.formatHex(clamped);
}

function oklchToHex(l: number, c: number, h: number): string {
  return gamutClamp(l, c, h);
}

function oklchVToHex(v: OklchValues): string {
  return gamutClamp(v.l, v.c, v.h);
}

// ============================================================
// contrast
// ============================================================

function relativeLuminance(hex: string): number {
  const rgb = culori.rgb(hex);
  if (!rgb) return 0;
  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return (
    0.2126 * toLinear(Math.max(0, rgb.r)) +
    0.7152 * toLinear(Math.max(0, rgb.g)) +
    0.0722 * toLinear(Math.max(0, rgb.b))
  );
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const CONTRAST_AA = 4.5;
const CONTRAST_SUBDUED = 3.0;

function ensureContrast(
  fgHex: string,
  bgHex: string,
  minRatio: number,
  themeTone: "dark" | "light",
): string {
  if (contrastRatio(fgHex, bgHex) >= minRatio) return fgHex;
  const { l, c, h } = hexToOklch(fgHex);
  const step = 0.01;
  if (themeTone === "dark") {
    for (let ll = l + step; ll <= 0.95; ll += step) {
      const hex = gamutClamp(ll, c, h);
      if (contrastRatio(hex, bgHex) >= minRatio) return hex;
    }
    return gamutClamp(0.95, c, h);
  }
  for (let ll = l - step; ll >= 0.05; ll -= step) {
    const hex = gamutClamp(ll, c, h);
    if (contrastRatio(hex, bgHex) >= minRatio) return hex;
  }
  return gamutClamp(0.05, c, h);
}

// ============================================================
// 0. stabilizeHue — 低彩度入力の補正
// JND (ΔE_ok ≈ 0.02) に基づき C < 0.015 で hue 不定と判定
// Tinted Gray: primary の hue を借用し C=0.025 に引き上げ
// (同時対比による錯覚を防ぐ — Gemini research)
// ============================================================

const ACHROMATIC_C_BASE = 0.015;
const TINTED_GRAY_C = 0.025;

/**
 * L に応じた低彩度判定閾値 (BUG-2 修正)
 *
 * 暗い色 (L < 0.3): C=0.02〜0.03 でも事実上無彩色に見える → 閾値を上げる
 * 明るい色 (L > 0.85): 高 L では彩度の知覚感度が下がる → 閾値を上げる
 * 中間: JND ベースの 0.015 をそのまま使用
 */
function achromaticThreshold(l: number): number {
  if (l < 0.3) return 0.035;
  if (l > 0.85) return 0.025;
  return ACHROMATIC_C_BASE;
}

function stabilizeHue(seeds: OklchValues[]): OklchValues[] {
  const primaryHue = seeds[0].h;
  return seeds.map((s, i) => {
    if (i === 0) return s;
    if (s.c <= achromaticThreshold(s.l)) {
      return { l: s.l, c: TINTED_GRAY_C, h: primaryHue };
    }
    return s;
  });
}

// ============================================================
// 1. computeGaps
// ============================================================

function computeGaps(hues: number[]): HueGap[] {
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
}

// ============================================================
// 2. fillGaps
// ============================================================

function fillGaps(gaps: HueGap[], count: number): number[] {
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
}

// ============================================================
// 3. computeTargetLC
// ============================================================

const CHROMA_SCALE = 0.9;
const ERROR_HUE = 25;
const ERROR_HUE_MIN = 0;
const ERROR_HUE_MAX = 55;
const ERROR_CHROMA_MIN = 0.15;

/**
 * error hue が primary hue と近い場合にずらす (BUG-1 修正)
 *
 * 赤系 (0°〜55°) の範囲を保ちつつ、primary から MIN_HUE_GAP 以上離す。
 * 両端の候補 + デフォルト (25°) から primary と最も離れた hue を選ぶ。
 * OKLCH hue 55° はまだ赤-橙系として知覚される範囲。
 */
function resolveErrorHue(primaryHue: number): number {
  if (hueDist(primaryHue, ERROR_HUE) >= MIN_HUE_GAP) return ERROR_HUE;
  const candidates = [ERROR_HUE_MIN, ERROR_HUE_MAX, ERROR_HUE];
  return candidates.reduce((best, c) =>
    hueDist(primaryHue, c) > hueDist(primaryHue, best) ? c : best,
  );
}

/**
 * Luminance Jittering (O'Donovan 2011 + Solarized の知見)
 *
 * gap-filled 色に固定 L ではなく分散した L を割り当てる。
 * dark: [0.68, 0.76, 0.72, 0.80] — 中心 0.74、ΔL=0.04 ステップ
 * light: [0.42, 0.50, 0.46, 0.38] — 中心 0.44、ΔL=0.04 ステップ
 *
 * Gemini research: accent 間 ΔL > 0.05 で視覚的に区別可能
 * ここでは隣接 ΔL=0.04 だが、非隣接は ΔL≥0.08 を確保
 */
const L_JITTER_DARK = [0.68, 0.76, 0.72, 0.8];
const L_JITTER_LIGHT = [0.42, 0.5, 0.46, 0.38];

function computeTargetLC(
  seeds: OklchValues[],
  themeTone: "dark" | "light",
): { lValues: number[]; c: number } {
  const chromas = seeds.map((s) => s.c).sort((a, b) => a - b);
  const cTarget = chromas[Math.floor(chromas.length / 2)] * CHROMA_SCALE;
  return {
    lValues: themeTone === "dark" ? L_JITTER_DARK : L_JITTER_LIGHT,
    c: cTarget,
  };
}

// ============================================================
// 3.5 enforceMinHueGap — 最小色相距離保証 (Cohen-Or 2006 簡易版)
// ============================================================

const MIN_HUE_GAP = 30;

/** 色相環上の最短距離 */
function hueDist(h1: number, h2: number): number {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * 全色相ペアが MIN_HUE_GAP 以上離れるよう押し広げる (バネモデル)
 *
 * seeds (AI入力) は固定、filledHues のみ調整対象。
 * 力を蓄積してから一括更新することで振動を防止する。
 * damping factor 0.3 で過剰補正を抑制。
 */
function enforceMinHueGap(seedHues: number[], filledHues: number[]): number[] {
  const result = [...filledHues];
  const fixed = [...seedHues];
  const DAMPING = 0.3;
  const MAX_ITER = 20;
  const CONVERGE_THRESHOLD = 0.5;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    const forces = result.map(() => 0);
    let maxForce = 0;

    for (let i = 0; i < result.length; i++) {
      const others = [
        ...fixed,
        ...result.filter((_, j) => j !== i),
      ];
      for (const other of others) {
        const dist = hueDist(result[i], other);
        if (dist < MIN_HUE_GAP && dist > 0) {
          const diff = ((result[i] - other + 540) % 360) - 180;
          const direction = diff >= 0 ? 1 : -1;
          const force = (MIN_HUE_GAP - dist) * DAMPING;
          forces[i] += direction * force;
          maxForce = Math.max(maxForce, Math.abs(force));
        }
      }
    }

    if (maxForce < CONVERGE_THRESHOLD) break;

    for (let i = 0; i < result.length; i++) {
      result[i] = ((result[i] + forces[i]) % 360 + 360) % 360;
    }
  }
  return result;
}

// ============================================================
// 4. clampNeutral
// ============================================================

const NEUTRAL_LIMITS = {
  dark: {
    bg: { lMin: 0.1, lMax: 0.22, cMax: 0.02, cFallback: 0.015 },
    fg: { lMin: 0.82, lMax: 0.92 },
  },
  light: {
    bg: { lMin: 0.92, lMax: 0.98, cMax: 0.02, cFallback: 0.015 },
    fg: { lMin: 0.15, lMax: 0.25 },
  },
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

function clampNeutral(
  bgHex: string,
  fgHex: string,
  themeTone: "dark" | "light",
): { bg: OklchValues; fg: OklchValues } {
  const limits = NEUTRAL_LIMITS[themeTone];
  const bgO = hexToOklch(bgHex);
  const fgO = hexToOklch(fgHex);
  return {
    bg: {
      l: clamp(bgO.l, limits.bg.lMin, limits.bg.lMax),
      c: bgO.c > limits.bg.cMax ? limits.bg.cFallback : bgO.c,
      h: bgO.h,
    },
    fg: { l: clamp(fgO.l, limits.fg.lMin, limits.fg.lMax), c: fgO.c, h: fgO.h },
  };
}

// ============================================================
// 5. deriveNeutralPalette
// ============================================================

function deriveNeutralPalette(
  bg: OklchValues,
  fg: OklchValues,
  themeTone: "dark" | "light",
): NeutralPalette {
  const sign = themeTone === "dark" ? 1 : -1;
  const fgL =
    themeTone === "dark"
      ? { comment: 0.45, line_nr: 0.4, border: 0.3, delimiter: 0.6 }
      : { comment: 0.55, line_nr: 0.6, border: 0.7, delimiter: 0.55 };

  return {
    bg: oklchVToHex(bg),
    fg: oklchVToHex(fg),
    bg_surface: oklchToHex(bg.l + 0.02 * sign, bg.c, bg.h),
    bg_cursor_line: oklchToHex(bg.l + 0.05 * sign, bg.c + 0.01, bg.h),
    bg_popup: oklchToHex(bg.l + 0.04 * sign, bg.c, bg.h),
    bg_visual: oklchToHex(bg.l + 0.08 * sign, bg.c, bg.h), // 仮値、後で navigation hue で上書き
    comment: oklchToHex(fgL.comment, bg.c, fg.h),
    line_nr: oklchToHex(fgL.line_nr, bg.c, fg.h),
    border: oklchToHex(fgL.border, bg.c, fg.h),
    delimiter: oklchToHex(fgL.delimiter, bg.c, fg.h),
  };
}

// ============================================================
// 6. variants
// ============================================================

const VARIANT1_CHROMA_SCALE = 0.6;
const VARIANT3_L_OFFSET = 0.08;

function generateVariants(
  c1: OklchValues,
  c3: OklchValues,
  themeTone: "dark" | "light",
) {
  const sign = themeTone === "dark" ? 1 : -1;
  return {
    color1_variant: { l: c1.l, c: c1.c * VARIANT1_CHROMA_SCALE, h: c1.h },
    color3_variant: { l: c3.l + VARIANT3_L_OFFSET * sign, c: c3.c, h: c3.h },
  };
}

// ============================================================
// 7. UI roles
// ============================================================

// ============================================================
// 6.5 ensureDiscrimination — accent 間弁別性検証 (Gramazio 2017)
// ============================================================

const MIN_DELTA_E = 0.08;

type OklabValues = { l: number; a: number; b: number };

function hexToOklab(hex: string): OklabValues {
  const result = culori.oklab(hex);
  return { l: result?.l ?? 0, a: result?.a ?? 0, b: result?.b ?? 0 };
}

function oklabDist(a: OklabValues, b: OklabValues): number {
  return Math.sqrt((a.l - b.l) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2);
}

/** accent 色間の ΔE_ok を検証し、警告を出す */
function checkDiscrimination(
  accentHexes: string[],
  labels: string[],
): string[] {
  const warnings: string[] = [];
  const oklabs = accentHexes.map(hexToOklab);
  for (let i = 0; i < oklabs.length; i++) {
    for (let j = i + 1; j < oklabs.length; j++) {
      const dist = oklabDist(oklabs[i], oklabs[j]);
      if (dist < MIN_DELTA_E) {
        warnings.push(
          `  ⚠ ${labels[i]}↔${labels[j]} ΔE=${dist.toFixed(3)} < ${MIN_DELTA_E}`,
        );
      }
    }
  }
  return warnings;
}

/**
 * 弁別性不足ペアの自動修正 (TODO-1)
 *
 * gap-filled 色 (index 5〜8 = c4〜c7 in accentHexes 配列) の L を ±0.03 調整し、
 * ΔE_ok ≥ MIN_DELTA_E を目指す。seed 色 (c1〜c3) と error (c8) は固定。
 * bgHex とのコントラストが改善する方向にシフトする。
 */
const ADJUSTABLE_INDICES = [3, 4, 5, 6]; // c4〜c7 の AccentPalette 配列内 index
const L_SHIFT = 0.03;
const DISCRIMINATION_MAX_ITER = 5;

function fixDiscrimination(
  accentHexes: string[],
  bgHex: string,
  themeTone: "dark" | "light",
): string[] {
  const result = [...accentHexes];
  const bgOklab = hexToOklab(bgHex);

  for (let iter = 0; iter < DISCRIMINATION_MAX_ITER; iter++) {
    let worstDist = Infinity;
    let worstI = -1;
    let worstJ = -1;
    const oklabs = result.map(hexToOklab);

    for (let i = 0; i < oklabs.length; i++) {
      for (let j = i + 1; j < oklabs.length; j++) {
        const dist = oklabDist(oklabs[i], oklabs[j]);
        if (dist < MIN_DELTA_E && dist < worstDist) {
          worstDist = dist;
          worstI = i;
          worstJ = j;
        }
      }
    }

    if (worstI === -1) break; // 全ペア OK

    // 調整対象を決定: adjustable な方を動かす。両方 adjustable なら bg から近い方を動かす
    let target: number;
    const iAdj = ADJUSTABLE_INDICES.includes(worstI);
    const jAdj = ADJUSTABLE_INDICES.includes(worstJ);
    if (iAdj && jAdj) {
      target =
        oklabDist(oklabs[worstI], bgOklab) <=
        oklabDist(oklabs[worstJ], bgOklab)
          ? worstI
          : worstJ;
    } else if (iAdj) {
      target = worstI;
    } else if (jAdj) {
      target = worstJ;
    } else {
      break; // どちらも固定色 → 調整不可
    }

    // L をシフト: 両方向を試し、ΔE が最も改善する方を採用
    const oklchTarget = hexToOklch(result[target]);
    const other = target === worstI ? worstJ : worstI;
    let bestHex = result[target];
    let bestDist = worstDist;
    for (const dir of [1, -1]) {
      const newL = clamp(oklchTarget.l + L_SHIFT * dir, 0.15, 0.90);
      const candidate = ensureContrast(
        gamutClamp(newL, oklchTarget.c, oklchTarget.h),
        bgHex,
        CONTRAST_AA,
        themeTone,
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
}

// ============================================================
// 7. UI roles
// ============================================================

const UI_BG_CR_MIN = 3.0;
const UI_FG_CR_MIN = 2.0;
const FRAME_CHROMA_SCALE = 0.5;
const FRAME_L_DARK = 0.35;
const FRAME_L_LIGHT = 0.65;
const SEARCH_BG_L_DARK = 0.3;
const SEARCH_BG_L_LIGHT = 0.85;

/**
 * UI ロール割り当て
 *
 * attention (CursorLineNr, Git dirty): 面積小 → 最も鮮やかな色 (chroma 最大)
 * navigation (Tab, Folder, Frame): 面積大 → 支える色 (attention 以外で bg 視認性が高い)
 *
 * tokyonight の blue(nav) / orange(att) 関係を参考:
 * navigation は画面を支える落ち着いた色、attention はピンポイントで目を引く鮮やかな色。
 *
 * 適格色が 1 色の場合: 不適格色を ensureContrast で救済して不足ロールに充てる。
 */
function assignUiRoles(
  colors: OklchValues[],
  bgHex: string,
  fgHex: string,
  themeTone: "dark" | "light",
): { navigation: number; attention: number; navigationOverride?: string; attentionOverride?: string } {
  const bgOklab = hexToOklab(bgHex);
  const all = colors.map((c, i) => ({
    i,
    c: c.c, // chroma
    bgCR: contrastRatio(oklchVToHex(c), bgHex),
    fgCR: contrastRatio(oklchVToHex(c), fgHex),
    bgDist: oklabDist(hexToOklab(oklchVToHex(c)), bgOklab),
  }));

  const eligible = all.filter((e) => e.bgCR >= UI_BG_CR_MIN && e.fgCR >= UI_FG_CR_MIN);

  if (eligible.length >= 2) {
    // attention = chroma 最大、navigation = 残りから bg 距離最大
    const byChroma = [...eligible].sort((a, b) => b.c - a.c);
    const attIdx = byChroma[0].i;
    const navCandidates = eligible.filter((e) => e.i !== attIdx).sort((a, b) => b.bgDist - a.bgDist);
    return { navigation: navCandidates[0].i, attention: attIdx };
  }

  if (eligible.length === 1) {
    const eligibleOne = eligible[0];
    // 不適格色から救済
    const rest = all
      .filter((e) => e.i !== eligibleOne.i)
      .sort((a, b) => b.c - a.c); // chroma 順で候補選択

    if (rest.length > 0) {
      const candidate = rest[0];
      let rescued = rescueColor(colors[candidate.i], bgHex, fgHex, themeTone);

      // eligible の chroma と rescued の chroma を比較して役割を決定
      if (eligibleOne.c >= colors[candidate.i].c) {
        // eligible の方が鮮やか → eligible=attention, rescued=navigation
        return { navigation: candidate.i, attention: eligibleOne.i, navigationOverride: rescued };
      }
      // rescued の方が鮮やか → eligible=navigation, rescued=attention
      return { navigation: eligibleOne.i, attention: candidate.i, attentionOverride: rescued };
    }
    return { navigation: eligibleOne.i, attention: eligibleOne.i };
  }

  // フォールバック: 全色不適格 → chroma 最大を attention、残りを navigation
  const byChroma = [...all].sort((a, b) => b.c - a.c);
  return {
    navigation: byChroma[1]?.i ?? byChroma[0].i,
    attention: byChroma[0].i,
  };
}

/** 不適格色を ensureContrast で bg/fg 両方とのコントラストを確保する */
function rescueColor(
  color: OklchValues,
  bgHex: string,
  fgHex: string,
  themeTone: "dark" | "light",
): string {
  let hex = oklchVToHex(color);
  hex = ensureContrast(hex, bgHex, UI_BG_CR_MIN, themeTone);
  if (contrastRatio(hex, fgHex) < UI_FG_CR_MIN) {
    const oklch = hexToOklch(hex);
    const fgOklch = hexToOklch(fgHex);
    const direction = themeTone === "dark"
      ? (oklch.l > fgOklch.l ? -1 : 1)
      : (oklch.l < fgOklch.l ? 1 : -1);
    for (let ll = oklch.l + 0.01 * direction; ll > 0.05 && ll < 0.95; ll += 0.01 * direction) {
      const candidate = gamutClamp(ll, oklch.c, oklch.h);
      if (contrastRatio(candidate, bgHex) >= UI_BG_CR_MIN && contrastRatio(candidate, fgHex) >= UI_FG_CR_MIN) {
        return candidate;
      }
    }
  }
  return hex;
}

function deriveUiColors(
  colors: OklchValues[],
  roles: { navigation: number; attention: number; navigationOverride?: string; attentionOverride?: string },
  bgVisualHex: string,
  themeTone: "dark" | "light",
): UiColors {
  const navHex = roles.navigationOverride ?? oklchVToHex(colors[roles.navigation]);
  const nav = hexToOklch(navHex);
  return {
    navigation: navHex,
    attention: roles.attentionOverride ?? oklchVToHex(colors[roles.attention]),
    frame: gamutClamp(
      themeTone === "dark" ? FRAME_L_DARK : FRAME_L_LIGHT,
      nav.c * FRAME_CHROMA_SCALE,
      nav.h,
    ),
    search_bg: gamutClamp(
      themeTone === "dark" ? SEARCH_BG_L_DARK : SEARCH_BG_L_LIGHT,
      nav.c,
      nav.h,
    ),
    pmenu_sel_bg: bgVisualHex,
  };
}

// ============================================================
// パイプライン統合
// ============================================================

function generatePalette(input: CharacterInput): PaletteResult {
  const themeTone = input.theme_tone;

  // AI 3色 → OKLCH
  const rawSeeds = [
    hexToOklch(input.primary),
    hexToOklch(input.secondary),
    hexToOklch(input.tertiary),
  ];

  // Step 0: 低彩度補正 (C < 0.015 → primary hue 借用, Tinted Gray)
  const seeds = stabilizeHue(rawSeeds);

  // 隙間充填
  const seedHues = seeds.map((s) => s.h);
  const gaps = computeGaps(seedHues);
  const rawFilledHues = fillGaps(gaps, 4);

  // Step 3.5: 最小色相距離保証 (ΔH ≥ 30°, Cohen-Or 2006)
  const filledHues = enforceMinHueGap(seedHues, rawFilledHues);

  // Step 3: L 分散 (O'Donovan 2011 — Luminance Jittering)
  const target = computeTargetLC(seeds, themeTone);

  // color4〜7 — L を色相順 zigzag で割り当て（隣接 hue の ΔL を最大化）
  const lPool = [...target.lValues].sort((a, b) => a - b);
  // zigzag: 色相が隣り合う色に最も離れた L を交互配置
  const zigzagOrder = [0, 3, 1, 2]; // [最小, 最大, 2番目, 3番目]
  const hueIndexed = filledHues
    .map((h, i) => ({ h, originalIdx: i }))
    .sort((a, b) => a.h - b.h);
  const lAssignment = new Array<number>(filledHues.length);
  hueIndexed.forEach((entry, sortedIdx) => {
    lAssignment[entry.originalIdx] = lPool[zigzagOrder[sortedIdx]];
  });
  const filledColors: OklchValues[] = filledHues.map((h, i) => ({
    l: lAssignment[i],
    c: target.c,
    h,
  }));
  // color8 (error) — BUG-1: primary と近い場合にずらす
  const errorL = themeTone === "dark" ? 0.72 : 0.45;
  const errorHue = resolveErrorHue(seeds[0].h);
  const color8: OklchValues = {
    l: errorL,
    c: Math.max(target.c, ERROR_CHROMA_MIN),
    h: errorHue,
  };

  // variants
  const variants = generateVariants(seeds[0], seeds[2], themeTone);

  // neutral
  const clamped = clampNeutral(input.bg, input.fg, themeTone);
  const neutral = deriveNeutralPalette(clamped.bg, clamped.fg, themeTone);

  // コントラスト保証 (accent)
  const bgHex = neutral.bg;
  const accentHexes = {
    color1: ensureContrast(
      gamutClamp(seeds[0].l, seeds[0].c, seeds[0].h),
      bgHex,
      CONTRAST_AA,
      themeTone,
    ),
    color1_variant: ensureContrast(
      gamutClamp(
        variants.color1_variant.l,
        variants.color1_variant.c,
        variants.color1_variant.h,
      ),
      bgHex,
      CONTRAST_AA,
      themeTone,
    ),
    color2: ensureContrast(
      gamutClamp(seeds[1].l, seeds[1].c, seeds[1].h),
      bgHex,
      CONTRAST_AA,
      themeTone,
    ),
    color3: ensureContrast(
      gamutClamp(seeds[2].l, seeds[2].c, seeds[2].h),
      bgHex,
      CONTRAST_AA,
      themeTone,
    ),
    color3_variant: ensureContrast(
      gamutClamp(
        variants.color3_variant.l,
        variants.color3_variant.c,
        variants.color3_variant.h,
      ),
      bgHex,
      CONTRAST_AA,
      themeTone,
    ),
    color4: ensureContrast(
      gamutClamp(filledColors[0].l, filledColors[0].c, filledColors[0].h),
      bgHex,
      CONTRAST_AA,
      themeTone,
    ),
    color5: ensureContrast(
      gamutClamp(filledColors[1].l, filledColors[1].c, filledColors[1].h),
      bgHex,
      CONTRAST_AA,
      themeTone,
    ),
    color6: ensureContrast(
      gamutClamp(filledColors[2].l, filledColors[2].c, filledColors[2].h),
      bgHex,
      CONTRAST_AA,
      themeTone,
    ),
    color7: ensureContrast(
      gamutClamp(filledColors[3].l, filledColors[3].c, filledColors[3].h),
      bgHex,
      CONTRAST_AA,
      themeTone,
    ),
    color8: ensureContrast(
      gamutClamp(color8.l, color8.c, color8.h),
      bgHex,
      CONTRAST_AA,
      themeTone,
    ),
  };

  // 弁別性自動修正 (TODO-1: ΔE_ok < 0.08 のペアを L 調整で解消)
  const accentArray = [
    accentHexes.color1,
    accentHexes.color2,
    accentHexes.color3,
    accentHexes.color4,
    accentHexes.color5,
    accentHexes.color6,
    accentHexes.color7,
    accentHexes.color8,
  ];
  const fixedAccent = fixDiscrimination(accentArray, bgHex, themeTone);
  accentHexes.color1 = fixedAccent[0];
  accentHexes.color2 = fixedAccent[1];
  accentHexes.color3 = fixedAccent[2];
  accentHexes.color4 = fixedAccent[3];
  accentHexes.color5 = fixedAccent[4];
  accentHexes.color6 = fixedAccent[5];
  accentHexes.color7 = fixedAccent[6];
  accentHexes.color8 = fixedAccent[7];

  // コントラスト保証 (neutral fg 系)
  const adjustedFg = ensureContrast(neutral.fg, bgHex, CONTRAST_AA, themeTone);
  const adjustedComment = ensureContrast(
    neutral.comment,
    bgHex,
    CONTRAST_SUBDUED,
    themeTone,
  );
  const adjustedLineNr = ensureContrast(
    neutral.line_nr,
    bgHex,
    CONTRAST_SUBDUED,
    themeTone,
  );
  const adjustedBorder = ensureContrast(
    neutral.border,
    bgHex,
    CONTRAST_SUBDUED,
    themeTone,
  );
  const adjustedDelimiter = ensureContrast(
    neutral.delimiter,
    bgHex,
    CONTRAST_SUBDUED,
    themeTone,
  );

  // neutral fg 系の最小 ΔL 保証 (同色収束防止)
  // 期待順序 dark: delimiter > comment > line_nr > border (明→暗)
  // 期待順序 light: border > line_nr > comment > delimiter (明→暗、bg から遠い順)
  const NEUTRAL_MIN_DELTA_L = 0.04;
  const ensureSpacing = (hexes: string[], sign: number): string[] => {
    const oklchs = hexes.map(hexToOklch);
    for (let i = 1; i < oklchs.length; i++) {
      const prev = oklchs[i - 1];
      const curr = oklchs[i];
      const gap = (prev.l - curr.l) * sign;
      if (gap < NEUTRAL_MIN_DELTA_L) {
        const shift = (NEUTRAL_MIN_DELTA_L - gap) * sign;
        oklchs[i] = { ...curr, l: clamp(curr.l - shift, 0.05, 0.95) };
      }
    }
    return oklchs.map(oklchVToHex);
  };

  const spacedNeutralFg =
    themeTone === "dark"
      ? ensureSpacing(
          [adjustedDelimiter, adjustedComment, adjustedLineNr, adjustedBorder],
          1,
        )
      : ensureSpacing(
          [adjustedBorder, adjustedLineNr, adjustedComment, adjustedDelimiter],
          -1,
        );

  const adjustedNeutral: NeutralPalette =
    themeTone === "dark"
      ? {
          ...neutral,
          fg: adjustedFg,
          delimiter: spacedNeutralFg[0],
          comment: spacedNeutralFg[1],
          line_nr: spacedNeutralFg[2],
          border: spacedNeutralFg[3],
        }
      : {
          ...neutral,
          fg: adjustedFg,
          border: spacedNeutralFg[0],
          line_nr: spacedNeutralFg[1],
          comment: spacedNeutralFg[2],
          delimiter: spacedNeutralFg[3],
        };

  // UI ロール
  const seedsForUi = seeds.map((s, i) => {
    const hex = [accentHexes.color1, accentHexes.color2, accentHexes.color3][i];
    return hexToOklch(hex);
  });
  const roles = assignUiRoles(seedsForUi, bgHex, adjustedNeutral.fg, themeTone);

  // bg_visual を navigation の hue で着色 (tokyonight 方式)
  const navColor = seedsForUi[roles.navigation];
  const bgOklch = hexToOklch(bgHex);
  const visualC = 0.04;
  const visualL = bgOklch.l + 0.08 * (themeTone === "dark" ? 1 : -1);
  adjustedNeutral.bg_visual = gamutClamp(visualL, visualC, navColor.h);

  const ui = deriveUiColors(
    seedsForUi,
    roles,
    adjustedNeutral.bg_visual,
    themeTone,
  );

  return {
    theme_tone: themeTone,
    neutral: adjustedNeutral,
    accent: accentHexes,
    ui,
  };
}

// ============================================================
// SVG 出力
// ============================================================

function textColor(hex: string): string {
  const rgb = culori.rgb(hex);
  if (!rgb) return "#ffffff";
  return rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114 > 0.5
    ? "#000000"
    : "#ffffff";
}

function generateSvg(
  name: string,
  input: CharacterInput,
  result: PaletteResult,
): string {
  const W = 640;
  const P = 16;
  const GAP = 3;
  const innerW = W - P * 2;
  let y = P;
  let body = "";

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

  // タイトル
  const titleColor = input.theme_tone === "dark" ? "#ccc" : "#333";
  const metaColor = input.theme_tone === "dark" ? "#666" : "#888";
  const labelColor = input.theme_tone === "dark" ? "#888" : "#666";
  body += `  <text x="${P}" y="${y + 16}" fill="${titleColor}" font-size="16" font-weight="bold">${name}</text>`;
  body += `  <text x="${P + 200}" y="${y + 16}" fill="${metaColor}" font-size="12">${input.game} / ${input.theme_tone}</text>\n`;
  y += 28;

  // AI 入力
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

  // accent 10色
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

  // neutral 10色
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

  // UI 5色
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

  // シンタックスプレビュー（簡易）
  y += 8;
  body += `  <text x="${P}" y="${y + 12}" fill="${labelColor}" font-size="10">syntax preview</text>\n`;
  y += 18;
  const previewBg = n.bg;
  body += `  <rect x="${P}" y="${y}" width="${innerW}" height="120" fill="${previewBg}" rx="4"/>\n`;
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
  const svgBg = input.theme_tone === "dark" ? "#0a0a0a" : "#f5f5f5";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${totalH}" style="background:${svgBg}; font-family:ui-monospace,monospace;">\n${body}</svg>`;
}

// ============================================================
// テストデータ
// ============================================================

const CHARACTERS: CharacterInput[] = [
  {
    name: "Albedo",
    game: "genshin",
    primary: "#d6ad60",
    secondary: "#4553a0",
    tertiary: "#ece8e1",
    bg: "#252320",
    fg: "#e5e2de",
    theme_tone: "dark",
  },
  {
    name: "Amber",
    game: "genshin",
    primary: "#C23126",
    secondary: "#4B332C",
    tertiary: "#DDA35D",
    bg: "#231E1D",
    fg: "#E8E0DE",
    theme_tone: "dark",
  },
  {
    name: "Acheron",
    game: "starrail",
    primary: "#5d54a4",
    secondary: "#a11b21",
    tertiary: "#2d2d31",
    bg: "#1a1920",
    fg: "#e0dfe6",
    theme_tone: "dark",
  },
  {
    name: "Hyacine",
    game: "starrail",
    primary: "#971d2b",
    secondary: "#f9b7bc",
    tertiary: "#7ce2e4",
    bg: "#fcf4f5",
    fg: "#382d2e",
    theme_tone: "light",
  },
  // === 原神 24キャラ検証セット ===
  {
    name: "Klee", game: "genshin",
    primary: "#B32D1E", secondary: "#F2E6CE", tertiary: "#C1924B",
    bg: "#FDF6F2", fg: "#3B3330", theme_tone: "light",
  },
  {
    name: "Yanfei", game: "genshin",
    primary: "#b43e48", secondary: "#f6a89e", tertiary: "#36b39e",
    bg: "#1c1616", fg: "#e8e0e0", theme_tone: "dark",
  },
  {
    name: "Yoimiya", game: "genshin",
    primary: "#d24335", secondary: "#ebb175", tertiary: "#333246",
    bg: "#fcf7f4", fg: "#3a3331", theme_tone: "light",
  },
  {
    name: "Navia", game: "genshin",
    primary: "#e8b159", secondary: "#2c3340", tertiary: "#4ba6f5",
    bg: "#1f1d1a", fg: "#e2ded3", theme_tone: "dark",
  },
  {
    name: "Baizhu", game: "genshin",
    primary: "#4caf80", secondary: "#1a5166", tertiary: "#8c78a5",
    bg: "#191f1c", fg: "#dfe5e1", theme_tone: "dark",
  },
  {
    name: "Nahida", game: "genshin",
    primary: "#8fc84c", secondary: "#f9fcf7", tertiary: "#c5a963",
    bg: "#f5f9f4", fg: "#2e352d", theme_tone: "light",
  },
  {
    name: "Faruzan", game: "genshin",
    primary: "#a5d7e1", secondary: "#415e79", tertiary: "#c0a172",
    bg: "#f3fafa", fg: "#2e3435", theme_tone: "light",
  },
  {
    name: "Furina", game: "genshin",
    primary: "#213c91", secondary: "#4cc9f0", tertiary: "#cca86a",
    bg: "#171921", fg: "#d9e0ee", theme_tone: "dark",
  },
  {
    name: "Clorinde", game: "genshin",
    primary: "#4b4da3", secondary: "#1c1c2a", tertiary: "#c5a165",
    bg: "#1a1a24", fg: "#e0e0f0", theme_tone: "dark",
  },
  {
    name: "RaidenShogun", game: "genshin",
    primary: "#51388d", secondary: "#b19bd9", tertiary: "#74293a",
    bg: "#1b1623", fg: "#e2deeb", theme_tone: "dark",
  },
  {
    name: "Chevreuse", game: "genshin",
    primary: "#7543a3", secondary: "#a02b37", tertiary: "#2e2321",
    bg: "#1b181c", fg: "#dbd7df", theme_tone: "dark",
  },
  // === スターレイル 24キャラ検証セット ===
  {
    name: "Argenti", game: "starrail",
    primary: "#C11B17", secondary: "#D6D6D6", tertiary: "#B89753",
    bg: "#201A1A", fg: "#EDE6E6", theme_tone: "dark",
  },
  {
    name: "Lingsha", game: "starrail",
    primary: "#c03127", secondary: "#352a26", tertiary: "#569c87",
    bg: "#27201f", fg: "#e5dbd9", theme_tone: "dark",
  },
  {
    name: "Guinaifen", game: "starrail",
    primary: "#b03030", secondary: "#f2907d", tertiary: "#d4a04d",
    bg: "#1d1918", fg: "#efe8e6", theme_tone: "dark",
  },
  {
    name: "Aglaea", game: "starrail",
    primary: "#e8c45e", secondary: "#f5f0e6", tertiary: "#382f2d",
    bg: "#fcf9f0", fg: "#33312c", theme_tone: "light",
  },
  {
    name: "Luocha", game: "starrail",
    primary: "#e2c275", secondary: "#24524c", tertiary: "#f1d575",
    bg: "#1c1c1a", fg: "#e5e3df", theme_tone: "dark",
  },
  {
    name: "Huohuo", game: "starrail",
    primary: "#97d2a8", secondary: "#5ef1f1", tertiary: "#ffa34d",
    bg: "#1a2120", fg: "#dce4e2", theme_tone: "dark",
  },
  {
    name: "Anaxa", game: "starrail",
    primary: "#30acc7", secondary: "#879b94", tertiary: "#bd1f24",
    bg: "#161c1e", fg: "#d9e1e3", theme_tone: "dark",
  },
  {
    name: "Gepard", game: "starrail",
    primary: "#0059ff", secondary: "#e1e5f0", tertiary: "#d4af37",
    bg: "#151a24", fg: "#d8dee9", theme_tone: "dark",
  },
  {
    name: "DrRatio", game: "starrail",
    primary: "#3c3e9a", secondary: "#cca852", tertiary: "#fdfaf5",
    bg: "#171720", fg: "#d2d2e1", theme_tone: "dark",
  },
  {
    name: "BlackSwan", game: "starrail",
    primary: "#8b5cf6", secondary: "#352150", tertiary: "#eec152",
    bg: "#1c1825", fg: "#e3dee7", theme_tone: "dark",
  },
  {
    name: "Kafka", game: "starrail",
    primary: "#8b2c4c", secondary: "#312a36", tertiary: "#e9e5e9",
    bg: "#1c191d", fg: "#dbd7dc", theme_tone: "dark",
  },
];

// ============================================================
// main
// ============================================================

const OUTPUT_DIR = "debug/palette-v01";

for (const char of CHARACTERS) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`${char.name} (${char.game}) — ${char.theme_tone}`);

  const result = generatePalette(char);

  // SVG 出力 (game ごとにサブディレクトリ)
  const gameDir = join(OUTPUT_DIR, char.game);
  mkdirSync(gameDir, { recursive: true });
  const svgPath = join(gameDir, `${char.name}.svg`);
  writeFileSync(svgPath, generateSvg(char.name, char, result));
  console.log(`  SVG:  ${svgPath}`);

  // サマリ出力
  const a = result.accent;
  const accentColors = [
    hexToOklch(a.color1),
    hexToOklch(a.color2),
    hexToOklch(a.color3),
  ];
  const filled = [
    hexToOklch(a.color4),
    hexToOklch(a.color5),
    hexToOklch(a.color6),
    hexToOklch(a.color7),
  ];
  const allHues = [...accentColors, ...filled]
    .map((c) => c.h.toFixed(0))
    .join("° ");
  console.log(`  Hues: ${allHues}°`);
  console.log(
    `  accent: c1=${a.color1} c2=${a.color2} c3=${a.color3} c4=${a.color4} c5=${a.color5} c6=${a.color6} c7=${a.color7} c8=${a.color8}`,
  );
  console.log(`  neutral: bg=${result.neutral.bg} fg=${result.neutral.fg}`);
  console.log(
    `  ui: nav=${result.ui.navigation} att=${result.ui.attention} frame=${result.ui.frame}`,
  );

  // 弁別性チェック (Gramazio 2017 — ΔE_ok ≥ 0.08)
  const accentHexes = [
    a.color1,
    a.color2,
    a.color3,
    a.color4,
    a.color5,
    a.color6,
    a.color7,
    a.color8,
  ];
  const accentLabels = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"];
  const warnings = checkDiscrimination(accentHexes, accentLabels);
  if (warnings.length > 0) {
    console.log(`  Discrimination warnings:`);
    for (const w of warnings) console.log(w);
  } else {
    console.log(`  Discrimination: ✓ all pairs ΔE ≥ ${MIN_DELTA_E}`);
  }
}

console.log(`\nDone. Output: ${OUTPUT_DIR}/`);
