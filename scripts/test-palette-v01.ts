/**
 * V01 隙間充填パレット生成テストスクリプト
 *
 * AI 出力 → 隙間充填 → neutral 派生 → variant → UI ロール → コントラスト保証 → SVG 出力
 *
 * Usage: node scripts/test-palette-v01.ts
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import * as culori from "culori";

// ============================================================
// types
// ============================================================

type OklchValues = { l: number; c: number; h: number };
type HueGap = { start: number; end: number; size: number };

type NeutralPalette = {
  bg: string; fg: string;
  bg_surface: string; bg_cursor_line: string; bg_visual: string; bg_popup: string;
  comment: string; line_nr: string; border: string; delimiter: string;
};

type AccentPalette = {
  color1: string; color1_variant: string;
  color2: string;
  color3: string; color3_variant: string;
  color4: string; color5: string; color6: string; color7: string; color8: string;
};

type UiColors = {
  navigation: string; attention: string; frame: string;
  search_bg: string; pmenu_sel_bg: string;
};

type PaletteResult = {
  theme_tone: "dark" | "light";
  neutral: NeutralPalette;
  accent: AccentPalette;
  ui: UiColors;
};

type CharacterInput = {
  name: string; game: string;
  primary: string; secondary: string; tertiary: string;
  bg: string; fg: string;
  theme_tone: "dark" | "light";
};

// ============================================================
// oklch utils
// ============================================================

function hexToOklch(hex: string): OklchValues {
  const result = culori.oklch(hex);
  return { l: result?.l ?? 0, c: result?.c ?? 0, h: result?.h ?? 0 };
}

function oklchToHex(l: number, c: number, h: number): string {
  const rgb = culori.rgb({ mode: "oklch", l, c, h });
  if (!rgb) return "#000000";
  const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v * 255)));
  const r = clamp(rgb.r); const g = clamp(rgb.g); const b = clamp(rgb.b);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function oklchVToHex(v: OklchValues): string {
  return oklchToHex(v.l, v.c, v.h);
}

// ============================================================
// gamut clamp (chroma reduction 優先)
// ============================================================

function gamutClamp(l: number, c: number, h: number): string {
  for (let cc = c; cc >= 0; cc -= 0.01) {
    const rgb = culori.rgb({ mode: "oklch", l, c: cc, h });
    if (rgb && rgb.r >= 0 && rgb.r <= 1 && rgb.g >= 0 && rgb.g <= 1 && rgb.b >= 0 && rgb.b <= 1) {
      return oklchToHex(l, cc, h);
    }
  }
  return oklchToHex(l, 0, h);
}

// ============================================================
// contrast
// ============================================================

function relativeLuminance(hex: string): number {
  const rgb = culori.rgb(hex);
  if (!rgb) return 0;
  const toLinear = (c: number) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * toLinear(Math.max(0, rgb.r)) + 0.7152 * toLinear(Math.max(0, rgb.g)) + 0.0722 * toLinear(Math.max(0, rgb.b));
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1); const l2 = relativeLuminance(hex2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const CONTRAST_AA = 4.5;
const CONTRAST_SUBDUED = 3.0;

function ensureContrast(fgHex: string, bgHex: string, minRatio: number, themeTone: "dark" | "light"): string {
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
const L_TARGET_DARK = 0.72;
const L_TARGET_LIGHT = 0.45;
const ERROR_HUE = 25;
const ERROR_CHROMA_MIN = 0.15;

function computeTargetLC(seeds: OklchValues[], themeTone: "dark" | "light"): { l: number; c: number } {
  const chromas = seeds.map((s) => s.c).sort((a, b) => a - b);
  const cTarget = chromas[Math.floor(chromas.length / 2)] * CHROMA_SCALE;
  return { l: themeTone === "dark" ? L_TARGET_DARK : L_TARGET_LIGHT, c: cTarget };
}

// ============================================================
// 4. clampNeutral
// ============================================================

const NEUTRAL_LIMITS = {
  dark: { bg: { lMin: 0.10, lMax: 0.22, cMax: 0.02, cFallback: 0.015 }, fg: { lMin: 0.82, lMax: 0.92 } },
  light: { bg: { lMin: 0.92, lMax: 0.98, cMax: 0.02, cFallback: 0.015 }, fg: { lMin: 0.15, lMax: 0.25 } },
};

function clamp(v: number, min: number, max: number): number { return Math.min(Math.max(v, min), max); }

function clampNeutral(bgHex: string, fgHex: string, themeTone: "dark" | "light"): { bg: OklchValues; fg: OklchValues } {
  const limits = NEUTRAL_LIMITS[themeTone];
  const bgO = hexToOklch(bgHex);
  const fgO = hexToOklch(fgHex);
  return {
    bg: { l: clamp(bgO.l, limits.bg.lMin, limits.bg.lMax), c: bgO.c > limits.bg.cMax ? limits.bg.cFallback : bgO.c, h: bgO.h },
    fg: { l: clamp(fgO.l, limits.fg.lMin, limits.fg.lMax), c: fgO.c, h: fgO.h },
  };
}

// ============================================================
// 5. deriveNeutralPalette
// ============================================================

function deriveNeutralPalette(bg: OklchValues, fg: OklchValues, themeTone: "dark" | "light"): NeutralPalette {
  const sign = themeTone === "dark" ? 1 : -1;
  const fgL = themeTone === "dark"
    ? { comment: 0.45, line_nr: 0.40, border: 0.30, delimiter: 0.60 }
    : { comment: 0.55, line_nr: 0.60, border: 0.70, delimiter: 0.55 };

  return {
    bg: oklchVToHex(bg),
    fg: oklchVToHex(fg),
    bg_surface: oklchToHex(bg.l + 0.02 * sign, bg.c, bg.h),
    bg_cursor_line: oklchToHex(bg.l + 0.03 * sign, bg.c, bg.h),
    bg_popup: oklchToHex(bg.l + 0.04 * sign, bg.c, bg.h),
    bg_visual: oklchToHex(bg.l + 0.06 * sign, bg.c, bg.h),
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

function generateVariants(c1: OklchValues, c3: OklchValues, themeTone: "dark" | "light") {
  const sign = themeTone === "dark" ? 1 : -1;
  return {
    color1_variant: { l: c1.l, c: c1.c * VARIANT1_CHROMA_SCALE, h: c1.h },
    color3_variant: { l: c3.l + VARIANT3_L_OFFSET * sign, c: c3.c, h: c3.h },
  };
}

// ============================================================
// 7. UI roles
// ============================================================

const UI_BG_CR_MIN = 3.0;
const UI_FG_CR_MIN = 2.0;
const FRAME_CHROMA_SCALE = 0.5;
const FRAME_L_DARK = 0.35;
const FRAME_L_LIGHT = 0.65;
const SEARCH_BG_L_DARK = 0.30;
const SEARCH_BG_L_LIGHT = 0.85;

function assignUiRoles(colors: OklchValues[], bgHex: string, fgHex: string): { navigation: number; attention: number } {
  const eligible = colors
    .map((c, i) => ({ i, c: c.c, bgCR: contrastRatio(oklchVToHex(c), bgHex), fgCR: contrastRatio(oklchVToHex(c), fgHex) }))
    .filter((e) => e.bgCR >= UI_BG_CR_MIN && e.fgCR >= UI_FG_CR_MIN)
    .sort((a, b) => b.c - a.c);

  if (eligible.length >= 2) return { navigation: eligible[0].i, attention: eligible[1].i };
  if (eligible.length === 1) return { navigation: eligible[0].i, attention: eligible[0].i };
  // フォールバック: 全色不適格 → C 降順で割り当て
  const fallback = colors.map((c, i) => ({ i, c: c.c })).sort((a, b) => b.c - a.c);
  return { navigation: fallback[0].i, attention: fallback[1]?.i ?? fallback[0].i };
}

function deriveUiColors(colors: OklchValues[], roles: { navigation: number; attention: number }, bgVisualHex: string, themeTone: "dark" | "light"): UiColors {
  const nav = colors[roles.navigation];
  const att = colors[roles.attention];
  return {
    navigation: oklchVToHex(nav),
    attention: oklchVToHex(att),
    frame: gamutClamp(themeTone === "dark" ? FRAME_L_DARK : FRAME_L_LIGHT, nav.c * FRAME_CHROMA_SCALE, nav.h),
    search_bg: gamutClamp(themeTone === "dark" ? SEARCH_BG_L_DARK : SEARCH_BG_L_LIGHT, nav.c, nav.h),
    pmenu_sel_bg: bgVisualHex,
  };
}

// ============================================================
// パイプライン統合
// ============================================================

function generatePalette(input: CharacterInput): PaletteResult {
  const themeTone = input.theme_tone;

  // AI 3色 → OKLCH
  const seeds = [hexToOklch(input.primary), hexToOklch(input.secondary), hexToOklch(input.tertiary)];

  // 隙間充填
  const hues = seeds.map((s) => s.h);
  const gaps = computeGaps(hues);
  const filledHues = fillGaps(gaps, 4);
  const target = computeTargetLC(seeds, themeTone);

  // color4〜7
  const filledColors: OklchValues[] = filledHues.map((h) => ({ l: target.l, c: target.c, h }));
  // color8 (error)
  const color8: OklchValues = { l: target.l, c: Math.max(target.c, ERROR_CHROMA_MIN), h: ERROR_HUE };

  // variants
  const variants = generateVariants(seeds[0], seeds[2], themeTone);

  // neutral
  const clamped = clampNeutral(input.bg, input.fg, themeTone);
  const neutral = deriveNeutralPalette(clamped.bg, clamped.fg, themeTone);

  // コントラスト保証 (accent)
  const bgHex = neutral.bg;
  const accentHexes = {
    color1: ensureContrast(gamutClamp(seeds[0].l, seeds[0].c, seeds[0].h), bgHex, CONTRAST_AA, themeTone),
    color1_variant: ensureContrast(gamutClamp(variants.color1_variant.l, variants.color1_variant.c, variants.color1_variant.h), bgHex, CONTRAST_AA, themeTone),
    color2: ensureContrast(gamutClamp(seeds[1].l, seeds[1].c, seeds[1].h), bgHex, CONTRAST_AA, themeTone),
    color3: ensureContrast(gamutClamp(seeds[2].l, seeds[2].c, seeds[2].h), bgHex, CONTRAST_AA, themeTone),
    color3_variant: ensureContrast(gamutClamp(variants.color3_variant.l, variants.color3_variant.c, variants.color3_variant.h), bgHex, CONTRAST_AA, themeTone),
    color4: ensureContrast(gamutClamp(filledColors[0].l, filledColors[0].c, filledColors[0].h), bgHex, CONTRAST_AA, themeTone),
    color5: ensureContrast(gamutClamp(filledColors[1].l, filledColors[1].c, filledColors[1].h), bgHex, CONTRAST_AA, themeTone),
    color6: ensureContrast(gamutClamp(filledColors[2].l, filledColors[2].c, filledColors[2].h), bgHex, CONTRAST_AA, themeTone),
    color7: ensureContrast(gamutClamp(filledColors[3].l, filledColors[3].c, filledColors[3].h), bgHex, CONTRAST_AA, themeTone),
    color8: ensureContrast(gamutClamp(color8.l, color8.c, color8.h), bgHex, CONTRAST_AA, themeTone),
  };

  // コントラスト保証 (neutral fg 系)
  const adjustedNeutral: NeutralPalette = {
    ...neutral,
    fg: ensureContrast(neutral.fg, bgHex, CONTRAST_AA, themeTone),
    comment: ensureContrast(neutral.comment, bgHex, CONTRAST_SUBDUED, themeTone),
    line_nr: ensureContrast(neutral.line_nr, bgHex, CONTRAST_SUBDUED, themeTone),
    border: ensureContrast(neutral.border, bgHex, CONTRAST_SUBDUED, themeTone),
    delimiter: ensureContrast(neutral.delimiter, bgHex, CONTRAST_SUBDUED, themeTone),
  };

  // UI ロール
  const seedsForUi = seeds.map((s, i) => {
    const hex = [accentHexes.color1, accentHexes.color2, accentHexes.color3][i];
    return hexToOklch(hex);
  });
  const roles = assignUiRoles(seedsForUi, bgHex, adjustedNeutral.fg);
  const ui = deriveUiColors(seedsForUi, roles, adjustedNeutral.bg_visual, themeTone);

  return { theme_tone: themeTone, neutral: adjustedNeutral, accent: accentHexes, ui };
}

// ============================================================
// SVG 出力
// ============================================================

function textColor(hex: string): string {
  const rgb = culori.rgb(hex);
  if (!rgb) return "#ffffff";
  return (rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114) > 0.5 ? "#000000" : "#ffffff";
}

function generateSvg(name: string, input: CharacterInput, result: PaletteResult): string {
  const W = 640;
  const P = 16;
  const GAP = 3;
  const innerW = W - P * 2;
  let y = P;
  let body = "";

  const row = (label: string, colors: { label: string; hex: string }[], h: number) => {
    body += `  <text x="${P}" y="${y + 12}" fill="#888" font-size="10">${label}</text>\n`;
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
  body += `  <text x="${P}" y="${y + 16}" fill="#ccc" font-size="16" font-weight="bold">${name}</text>`;
  body += `  <text x="${P + 200}" y="${y + 16}" fill="#666" font-size="12">${input.game} / ${input.theme_tone}</text>\n`;
  y += 28;

  // AI 入力
  row("AI impression", [
    { label: "primary", hex: input.primary },
    { label: "secondary", hex: input.secondary },
    { label: "tertiary", hex: input.tertiary },
  ], 35);

  row("AI neutral", [
    { label: "bg", hex: input.bg },
    { label: "fg", hex: input.fg },
  ], 28);

  // accent 10色
  const a = result.accent;
  row("accent (generated)", [
    { label: "c1 keyword", hex: a.color1 },
    { label: "c1v tag", hex: a.color1_variant },
    { label: "c2 func", hex: a.color2 },
    { label: "c3 const", hex: a.color3 },
    { label: "c3v num", hex: a.color3_variant },
  ], 40);

  row("accent (gap-filled)", [
    { label: "c4 string", hex: a.color4 },
    { label: "c5 type", hex: a.color5 },
    { label: "c6 special", hex: a.color6 },
    { label: "c7 preproc", hex: a.color7 },
    { label: "c8 error", hex: a.color8 },
  ], 40);

  // neutral 10色
  const n = result.neutral;
  row("neutral bg", [
    { label: "bg", hex: n.bg },
    { label: "surface", hex: n.bg_surface },
    { label: "cursor", hex: n.bg_cursor_line },
    { label: "popup", hex: n.bg_popup },
    { label: "visual", hex: n.bg_visual },
  ], 35);

  row("neutral fg", [
    { label: "fg", hex: n.fg },
    { label: "comment", hex: n.comment },
    { label: "line_nr", hex: n.line_nr },
    { label: "border", hex: n.border },
    { label: "delimiter", hex: n.delimiter },
  ], 35);

  // UI 5色
  const u = result.ui;
  row("ui", [
    { label: "navigation", hex: u.navigation },
    { label: "attention", hex: u.attention },
    { label: "frame", hex: u.frame },
    { label: "search_bg", hex: u.search_bg },
    { label: "pmenu_sel", hex: u.pmenu_sel_bg },
  ], 35);

  // シンタックスプレビュー（簡易）
  y += 8;
  body += `  <text x="${P}" y="${y + 12}" fill="#888" font-size="10">syntax preview</text>\n`;
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
  line([{ text: "import", color: a.color1 }, { text: " { useState } ", color: n.fg }, { text: "from", color: a.color1 }, { text: " \"react\"", color: a.color4 }]);
  line([{ text: "const", color: a.color1 }, { text: " count", color: n.fg }, { text: " = ", color: n.fg }, { text: "42", color: a.color3_variant }]);
  line([{ text: "function", color: a.color1 }, { text: " greet", color: a.color2 }, { text: "(", color: n.delimiter }, { text: "name", color: a.color7 }, { text: ": ", color: n.delimiter }, { text: "string", color: a.color5 }, { text: ")", color: n.delimiter }]);
  line([{ text: "  // call the greeting", color: n.comment }]);
  line([{ text: "  console", color: a.color6 }, { text: ".log(", color: n.delimiter }, { text: "`Hello ${", color: a.color4 }, { text: "name", color: n.fg }, { text: "}`", color: a.color4 }, { text: ")", color: n.delimiter }]);
  line([{ text: "  return", color: a.color1 }, { text: " true", color: a.color3 }]);
  line([{ text: "class", color: a.color1 }, { text: " MyError", color: a.color5 }, { text: " extends ", color: a.color1 }, { text: "Error", color: a.color8 }]);
  y += 128;

  const totalH = y + P;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${totalH}" style="background:#0a0a0a; font-family:ui-monospace,monospace;">\n${body}</svg>`;
}

// ============================================================
// テストデータ
// ============================================================

const CHARACTERS: CharacterInput[] = [
  { name: "Albedo", game: "genshin", primary: "#d6ad60", secondary: "#4553a0", tertiary: "#ece8e1", bg: "#252320", fg: "#e5e2de", theme_tone: "dark" },
  { name: "Amber", game: "genshin", primary: "#C23126", secondary: "#4B332C", tertiary: "#DDA35D", bg: "#231E1D", fg: "#E8E0DE", theme_tone: "dark" },
  { name: "Acheron", game: "starrail", primary: "#5d54a4", secondary: "#a11b21", tertiary: "#2d2d31", bg: "#1a1920", fg: "#e0dfe6", theme_tone: "dark" },
  { name: "Hyacine", game: "starrail", primary: "#971d2b", secondary: "#f9b7bc", tertiary: "#7ce2e4", bg: "#fcf4f5", fg: "#382d2e", theme_tone: "light" },
];

// ============================================================
// main
// ============================================================

const OUTPUT_DIR = "debug/palette-v01";
mkdirSync(OUTPUT_DIR, { recursive: true });

for (const char of CHARACTERS) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`${char.name} (${char.game}) — ${char.theme_tone}`);

  const result = generatePalette(char);

  // JSON 出力
  const jsonPath = join(OUTPUT_DIR, `${char.name}.json`);
  writeFileSync(jsonPath, JSON.stringify(result, null, 2));
  console.log(`  JSON: ${jsonPath}`);

  // SVG 出力
  const svgPath = join(OUTPUT_DIR, `${char.name}.svg`);
  writeFileSync(svgPath, generateSvg(char.name, char, result));
  console.log(`  SVG:  ${svgPath}`);

  // サマリ出力
  const a = result.accent;
  const seeds = [hexToOklch(a.color1), hexToOklch(a.color2), hexToOklch(a.color3)];
  const filled = [hexToOklch(a.color4), hexToOklch(a.color5), hexToOklch(a.color6), hexToOklch(a.color7)];
  const allHues = [...seeds, ...filled].map((c) => c.h.toFixed(0)).join("° ");
  console.log(`  Hues: ${allHues}°`);
  console.log(`  accent: c1=${a.color1} c2=${a.color2} c3=${a.color3} c4=${a.color4} c5=${a.color5} c6=${a.color6} c7=${a.color7} c8=${a.color8}`);
  console.log(`  neutral: bg=${result.neutral.bg} fg=${result.neutral.fg}`);
  console.log(`  ui: nav=${result.ui.navigation} att=${result.ui.attention} frame=${result.ui.frame}`);
}

console.log(`\nDone. Output: ${OUTPUT_DIR}/`);
