/**
 * ghostty の 463 テーマを OKLCH 分析し、palette-design spec の定数を検証する
 *
 * 出力:
 * - アクセント色 (palette 1〜6) の L/C 分布
 * - 色相の散らばりパターン
 * - bg/fg コントラスト比
 * - neutral (palette 0, 7, 8) の彩度
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { useMode, modeOklch, modeRgb, parse } from "culori/fn";

// @ts-ignore
const toOklch = useMode(modeOklch);
// @ts-ignore
const toRgb = useMode(modeRgb);

const THEME_DIR = "sample-repo/ghostty-theme";

// --- parse ---

type Theme = {
  name: string;
  palette: Record<number, string>; // 0〜15
  background: string;
  foreground: string;
};

function parseTheme(name: string, content: string): Theme | null {
  const palette: Record<number, string> = {};
  let background = "";
  let foreground = "";

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    const paletteMatch = trimmed.match(/^palette\s*=\s*(\d+)=(.+)$/);
    if (paletteMatch) {
      palette[Number(paletteMatch[1])] = paletteMatch[2].trim();
      continue;
    }
    const bgMatch = trimmed.match(/^background\s*=\s*(.+)$/);
    if (bgMatch) background = bgMatch[1].trim();
    const fgMatch = trimmed.match(/^foreground\s*=\s*(.+)$/);
    if (fgMatch) foreground = fgMatch[1].trim();
  }

  if (!background || !foreground || Object.keys(palette).length < 8) return null;
  return { name, palette, background, foreground };
}

// --- OKLCH ---

type Oklch = { l: number; c: number; h: number };

function hexToOklch(hex: string): Oklch | null {
  const parsed = parse(hex);
  if (!parsed) return null;
  const oklch = toOklch(parsed);
  return { l: oklch.l ?? 0, c: oklch.c ?? 0, h: oklch.h ?? 0 };
}

function relativeLuminance(hex: string): number {
  const parsed = parse(hex);
  if (!parsed) return 0;
  const rgb = toRgb(parsed);
  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const r = toLinear(Math.max(0, Math.min(1, rgb.r)));
  const g = toLinear(Math.max(0, Math.min(1, rgb.g)));
  const b = toLinear(Math.max(0, Math.min(1, rgb.b)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// --- stats ---

function percentile(sorted: number[], p: number): number {
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function stats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    min: sorted[0],
    p25: percentile(sorted, 0.25),
    median: percentile(sorted, 0.5),
    p75: percentile(sorted, 0.75),
    max: sorted[sorted.length - 1],
    mean: values.reduce((a, b) => a + b, 0) / values.length,
  };
}

function fmtStats(s: ReturnType<typeof stats>, decimals = 3): string {
  const f = (n: number) => n.toFixed(decimals);
  return `count=${s.count}  min=${f(s.min)}  p25=${f(s.p25)}  median=${f(s.median)}  p75=${f(s.p75)}  max=${f(s.max)}  mean=${f(s.mean)}`;
}

// --- hue gap analysis ---

function computeHueGaps(hues: number[]): number[] {
  const sorted = [...hues].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const next = sorted[(i + 1) % sorted.length];
    let gap = next - sorted[i];
    if (gap <= 0) gap += 360;
    gaps.push(gap);
  }
  return gaps;
}

// --- main ---

const files = readdirSync(THEME_DIR);
const themes: Theme[] = [];

for (const file of files) {
  const content = readFileSync(join(THEME_DIR, file), "utf-8");
  const theme = parseTheme(file, content);
  if (theme) themes.push(theme);
}

console.log(`\n=== Ghostty Theme Analysis (${themes.length} themes) ===\n`);

// classify dark / light
const darkThemes: Theme[] = [];
const lightThemes: Theme[] = [];
for (const t of themes) {
  const bgOklch = hexToOklch(t.background);
  if (!bgOklch) continue;
  if (bgOklch.l < 0.5) darkThemes.push(t);
  else lightThemes.push(t);
}
console.log(`Dark themes: ${darkThemes.length}, Light themes: ${lightThemes.length}\n`);

// --- A. accent L/C (palette 1〜6) ---
console.log("--- A. Accent Color L/C (palette 1-6) ---\n");

for (const [label, subset] of [["DARK", darkThemes], ["LIGHT", lightThemes]] as const) {
  const ls: number[] = [];
  const cs: number[] = [];
  for (const t of subset) {
    for (let i = 1; i <= 6; i++) {
      const hex = t.palette[i];
      if (!hex) continue;
      const oklch = hexToOklch(hex);
      if (!oklch) continue;
      ls.push(oklch.l);
      cs.push(oklch.c);
    }
  }
  console.log(`[${label}] Accent L: ${fmtStats(stats(ls))}`);
  console.log(`[${label}] Accent C: ${fmtStats(stats(cs))}`);
  console.log();
}

// --- B. per-palette-slot L/C ---
console.log("--- B. Per-Slot L/C (dark themes only) ---\n");

const slotNames = ["", "red", "green", "yellow", "blue", "magenta", "cyan"];
for (let i = 1; i <= 6; i++) {
  const ls: number[] = [];
  const cs: number[] = [];
  for (const t of darkThemes) {
    const hex = t.palette[i];
    if (!hex) continue;
    const oklch = hexToOklch(hex);
    if (!oklch) continue;
    ls.push(oklch.l);
    cs.push(oklch.c);
  }
  console.log(`palette ${i} (${slotNames[i]}):  L median=${stats(ls).median.toFixed(3)}  C median=${stats(cs).median.toFixed(3)}`);
}
console.log();

// --- C. hue distribution ---
console.log("--- C. Hue Distribution (palette 1-6, dark themes) ---\n");

const minGaps: number[] = [];
const maxGaps: number[] = [];
for (const t of darkThemes) {
  const hues: number[] = [];
  for (let i = 1; i <= 6; i++) {
    const hex = t.palette[i];
    if (!hex) continue;
    const oklch = hexToOklch(hex);
    if (!oklch) continue;
    hues.push(oklch.h);
  }
  if (hues.length < 3) continue;
  const gaps = computeHueGaps(hues);
  minGaps.push(Math.min(...gaps));
  maxGaps.push(Math.max(...gaps));
}
console.log(`Min hue gap (closest 2 colors): ${fmtStats(stats(minGaps), 1)}`);
console.log(`Max hue gap (largest empty arc): ${fmtStats(stats(maxGaps), 1)}`);
console.log();

// --- D. bg/fg contrast ---
console.log("--- D. Contrast Ratios ---\n");

const bgFgCRs: number[] = [];
const bgAccentCRs: number[] = [];
for (const t of darkThemes) {
  bgFgCRs.push(contrastRatio(t.background, t.foreground));
  for (let i = 1; i <= 6; i++) {
    const hex = t.palette[i];
    if (!hex) continue;
    bgAccentCRs.push(contrastRatio(t.background, hex));
  }
}
console.log(`bg vs fg:     ${fmtStats(stats(bgFgCRs), 1)}`);
console.log(`bg vs accent: ${fmtStats(stats(bgAccentCRs), 1)}`);
console.log();

// --- E. neutral chroma (palette 0, 7, 8) ---
console.log("--- E. Neutral Chroma (palette 0, 7, 8, dark themes) ---\n");

for (const slot of [0, 7, 8] as const) {
  const cs: number[] = [];
  for (const t of darkThemes) {
    const hex = t.palette[slot];
    if (!hex) continue;
    const oklch = hexToOklch(hex);
    if (!oklch) continue;
    cs.push(oklch.c);
  }
  const slotLabel = slot === 0 ? "black" : slot === 7 ? "white" : "bright black";
  console.log(`palette ${slot} (${slotLabel}): ${fmtStats(stats(cs))}`);
}
console.log();

// --- F. bg の OKLCH ---
console.log("--- F. Background OKLCH (dark themes) ---\n");

const bgLs: number[] = [];
const bgCs: number[] = [];
for (const t of darkThemes) {
  const oklch = hexToOklch(t.background);
  if (!oklch) continue;
  bgLs.push(oklch.l);
  bgCs.push(oklch.c);
}
console.log(`bg L: ${fmtStats(stats(bgLs))}`);
console.log(`bg C: ${fmtStats(stats(bgCs))}`);
console.log();

// --- H. bg/fg の色相分布 ---
console.log("--- H. Background/Foreground Hue Distribution ---\n");

// 色相を 30° 区間のバケットに分類
const HUE_NAMES: Record<number, string> = {
  0: "赤 (0-30)",
  30: "朱/橙 (30-60)",
  60: "黄 (60-90)",
  90: "黄緑 (90-120)",
  120: "緑 (120-150)",
  150: "青緑 (150-180)",
  180: "シアン (180-210)",
  210: "青 (210-240)",
  240: "青紫 (240-270)",
  270: "紫 (270-300)",
  300: "赤紫 (300-330)",
  330: "深紅 (330-360)",
};

function hueBucket(h: number): number {
  return Math.floor(h / 30) * 30;
}

// 無彩色の閾値
const ACHROMATIC_C = 0.005;

for (const [label, subset] of [["DARK", darkThemes], ["LIGHT", lightThemes]] as const) {
  console.log(`[${label}] Background hue distribution (C > ${ACHROMATIC_C} のみ):`);
  const buckets: Record<number, number> = {};
  let achromatic = 0;
  let total = 0;
  const chromatics: { name: string; h: number; c: number; l: number }[] = [];
  for (const t of subset) {
    const oklch = hexToOklch(t.background);
    if (!oklch) continue;
    total++;
    if (oklch.c <= ACHROMATIC_C) {
      achromatic++;
      continue;
    }
    const bucket = hueBucket(oklch.h);
    buckets[bucket] = (buckets[bucket] ?? 0) + 1;
    chromatics.push({ name: t.name, h: oklch.h, c: oklch.c, l: oklch.l });
  }
  console.log(`  無彩色 (C <= ${ACHROMATIC_C}): ${achromatic}/${total} (${((achromatic / total) * 100).toFixed(0)}%)`);
  console.log(`  有彩色: ${total - achromatic}/${total} (${(((total - achromatic) / total) * 100).toFixed(0)}%)`);
  for (let h = 0; h < 360; h += 30) {
    const count = buckets[h] ?? 0;
    if (count > 0) {
      const bar = "█".repeat(Math.ceil(count / 2));
      console.log(`  ${HUE_NAMES[h].padEnd(18)} ${String(count).padStart(3)} ${bar}`);
    }
  }
  // 上位テーマを具体名で表示
  chromatics.sort((a, b) => b.c - a.c);
  console.log(`  最も彩度が高い bg (top 10):`);
  for (const t of chromatics.slice(0, 10)) {
    console.log(`    ${t.name.padEnd(30)} H=${t.h.toFixed(0).padStart(3)}° C=${t.c.toFixed(3)} L=${t.l.toFixed(3)}`);
  }
  console.log();
}

// fg の色相分布
for (const [label, subset] of [["DARK", darkThemes], ["LIGHT", lightThemes]] as const) {
  console.log(`[${label}] Foreground hue distribution (C > ${ACHROMATIC_C} のみ):`);
  const buckets: Record<number, number> = {};
  let achromatic = 0;
  let total = 0;
  for (const t of subset) {
    const oklch = hexToOklch(t.foreground);
    if (!oklch) continue;
    total++;
    if (oklch.c <= ACHROMATIC_C) {
      achromatic++;
      continue;
    }
    const bucket = hueBucket(oklch.h);
    buckets[bucket] = (buckets[bucket] ?? 0) + 1;
  }
  console.log(`  無彩色 (C <= ${ACHROMATIC_C}): ${achromatic}/${total} (${((achromatic / total) * 100).toFixed(0)}%)`);
  console.log(`  有彩色: ${total - achromatic}/${total} (${(((total - achromatic) / total) * 100).toFixed(0)}%)`);
  for (let h = 0; h < 360; h += 30) {
    const count = buckets[h] ?? 0;
    if (count > 0) {
      const bar = "█".repeat(Math.ceil(count / 2));
      console.log(`  ${HUE_NAMES[h].padEnd(18)} ${String(count).padStart(3)} ${bar}`);
    }
  }
  console.log();
}

// --- I. 色相別テーマ詳細比較 ---
console.log("--- I. Hue-Bucket Theme Comparison (Dark themes, C > 0.005) ---\n");

type BucketData = {
  hue: number;
  label: string;
  bgCount: number;
  fgCount: number;
  bgThemes: { name: string; h: number; c: number; l: number }[];
  fgThemes: { name: string; h: number; c: number; l: number }[];
  // そのバケットに bg を持つテーマの accent 統計
  accentStats: { lMedian: number; cMedian: number; hues: number[] } | null;
};

const bucketData: BucketData[] = [];

for (let h = 0; h < 360; h += 30) {
  const label = HUE_NAMES[h];
  const bgThemes: BucketData["bgThemes"] = [];
  const fgThemes: BucketData["fgThemes"] = [];

  for (const t of darkThemes) {
    const bgOklch = hexToOklch(t.background);
    if (bgOklch && bgOklch.c > ACHROMATIC_C && hueBucket(bgOklch.h) === h) {
      bgThemes.push({ name: t.name, h: bgOklch.h, c: bgOklch.c, l: bgOklch.l });
    }
    const fgOklch = hexToOklch(t.foreground);
    if (fgOklch && fgOklch.c > ACHROMATIC_C && hueBucket(fgOklch.h) === h) {
      fgThemes.push({ name: t.name, h: fgOklch.h, c: fgOklch.c, l: fgOklch.l });
    }
  }

  // bg がこのバケットにあるテーマの accent L/C 統計
  let accentStatsResult: BucketData["accentStats"] = null;
  if (bgThemes.length >= 3) {
    const accentLs: number[] = [];
    const accentCs: number[] = [];
    const accentHs: number[] = [];
    for (const t of darkThemes) {
      const bgOklch = hexToOklch(t.background);
      if (!bgOklch || bgOklch.c <= ACHROMATIC_C || hueBucket(bgOklch.h) !== h) continue;
      for (let i = 1; i <= 6; i++) {
        const hex = t.palette[i];
        if (!hex) continue;
        const oklch = hexToOklch(hex);
        if (!oklch) continue;
        accentLs.push(oklch.l);
        accentCs.push(oklch.c);
        accentHs.push(oklch.h);
      }
    }
    if (accentLs.length > 0) {
      accentStatsResult = {
        lMedian: stats(accentLs).median,
        cMedian: stats(accentCs).median,
        hues: accentHs,
      };
    }
  }

  bucketData.push({ hue: h, label, bgCount: bgThemes.length, fgCount: fgThemes.length, bgThemes, fgThemes, accentStats: accentStatsResult });
}

// テーブル表示
console.log("色相帯              bg数  fg数  bg:fg比   bg例");
console.log("─".repeat(90));
for (const b of bucketData) {
  const ratio = b.fgCount > 0 ? (b.bgCount / b.fgCount).toFixed(1) : b.bgCount > 0 ? "∞" : "-";
  const examples = b.bgThemes
    .sort((a, c) => c.c - a.c)
    .slice(0, 3)
    .map((t) => t.name)
    .join(", ");
  console.log(
    `${b.label.padEnd(20)} ${String(b.bgCount).padStart(3)}   ${String(b.fgCount).padStart(3)}   ${String(ratio).padStart(5)}   ${examples}`,
  );
}

// 無彩色行
console.log(`${"無彩色 (C≤0.005)".padEnd(20)} ${String(166).padStart(3)}   ${String(168).padStart(3)}   ${String((166 / 168).toFixed(1)).padStart(5)}   (大多数)`);
console.log();

// bg の色相別 neutral C 統計
console.log("色相帯              bg C median  bg C p75   bg L median  テーマ数");
console.log("─".repeat(70));
for (const b of bucketData) {
  if (b.bgThemes.length < 3) continue;
  const cs = b.bgThemes.map((t) => t.c);
  const ls = b.bgThemes.map((t) => t.l);
  const cStats = stats(cs);
  const lStats = stats(ls);
  console.log(
    `${b.label.padEnd(20)} ${cStats.median.toFixed(4).padStart(8)}    ${cStats.p75.toFixed(4).padStart(8)}   ${lStats.median.toFixed(3).padStart(8)}       ${b.bgThemes.length}`,
  );
}
console.log();

// bg 色相別の accent L/C
console.log("色相帯 (bg)          accent L median  accent C median  テーマ数");
console.log("─".repeat(70));
for (const b of bucketData) {
  if (!b.accentStats) continue;
  console.log(
    `${b.label.padEnd(20)} ${b.accentStats.lMedian.toFixed(3).padStart(12)}       ${b.accentStats.cMedian.toFixed(3).padStart(12)}        ${b.bgCount}`,
  );
}
console.log();

// --- G. spec 定数との比較 ---
console.log("--- G. Spec Constants Validation ---\n");

const accentLDark = darkThemes.flatMap((t) => {
  const ls: number[] = [];
  for (let i = 1; i <= 6; i++) {
    const hex = t.palette[i];
    if (!hex) continue;
    const oklch = hexToOklch(hex);
    if (oklch) ls.push(oklch.l);
  }
  return ls;
});
const accentCDark = darkThemes.flatMap((t) => {
  const cs: number[] = [];
  for (let i = 1; i <= 6; i++) {
    const hex = t.palette[i];
    if (!hex) continue;
    const oklch = hexToOklch(hex);
    if (oklch) cs.push(oklch.c);
  }
  return cs;
});

const specLDark = 0.75;
const specChrMin = 0.12;
const specNeutralCMax = 0.02;

const accentLStats = stats(accentLDark);
const accentCStats = stats(accentCDark);
const bgCStats = stats(bgCs);
const bgAccentCRStats = stats(bgAccentCRs);

console.log(`L_TARGET_DARK = ${specLDark}`);
console.log(`  → 実績 median=${accentLStats.median.toFixed(3)}, p25-p75=[${accentLStats.p25.toFixed(3)}, ${accentLStats.p75.toFixed(3)}]`);
console.log(`  → ${accentLStats.p25 <= specLDark && specLDark <= accentLStats.p75 ? "✓ IQR 内" : "✗ IQR 外"}`);
console.log();

console.log(`ERROR_CHROMA_MIN = ${specChrMin}`);
console.log(`  → palette 1 (red) の C 実績: median=${stats(darkThemes.map((t) => hexToOklch(t.palette[1])?.c ?? 0)).median.toFixed(3)}`);
console.log();

console.log(`NEUTRAL_CHROMA_MAX = ${specNeutralCMax}`);
console.log(`  → bg C 実績: median=${bgCStats.median.toFixed(3)}, p75=${bgCStats.p75.toFixed(3)}`);
console.log();

console.log(`CONTRAST_AA = 4.5`);
console.log(`  → bg vs accent 実績: median=${bgAccentCRStats.median.toFixed(1)}, min=${bgAccentCRStats.min.toFixed(1)}, p25=${bgAccentCRStats.p25.toFixed(1)}`);
console.log(`  → ${bgAccentCRStats.p25 >= 4.5 ? "✓ p25 が AA 以上" : "✗ p25 が AA 未満 — 実際のテーマでも AA を満たさない色は多い"}`);
