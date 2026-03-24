/**
 * mini.hues のパレット生成アルゴリズムを TypeScript で再実装し、
 * キャラクター画像から bg/fg を抽出して 26 色パレットを SVG 出力する。
 *
 * Usage: pnpm tsx scripts/gen-mini-hues-svg.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getSwatches } from "colorthief";
import {
  useMode,
  modeRgb,
  modeOklch,
  type Oklch,
  parse,
  formatHex,
} from "culori/fn";

const toRgbMode = useMode(modeRgb);
const toOklchMode = useMode(modeOklch);

const ROOT_DIR = new URL("../", import.meta.url).pathname;
const IMG_BASE = join(ROOT_DIR, "debug/img");
const OUT_DIR = join(ROOT_DIR, "debug/palettes/nvim-hues");

// ---------------------------------------------------------------------------
// colorthief 抽出オプション
// ---------------------------------------------------------------------------
const OPTIONS_BASE = {
  quality: 10,
  colorSpace: "rgb" as const,
  ignoreWhite: true,
  minSaturation: 0.05,
};

// ---------------------------------------------------------------------------
// Oklch ユーティリティ
// ---------------------------------------------------------------------------
type LCH = { l: number; c: number; h: number | undefined };

const hexToOklch = (hex: string): LCH => {
  const parsed = parse(hex);
  if (!parsed) return { l: 0, c: 0, h: 0 };
  const oklch = toOklchMode(parsed);
  return { l: oklch.l ?? 0, c: oklch.c ?? 0, h: oklch.h };
};

const oklchToHex = (lch: LCH): string => {
  const oklch: Oklch = { mode: "oklch", l: lch.l, c: lch.c, h: lch.h ?? 0 };
  const rgb = toRgbMode(oklch);
  // culori は gamut 外の値をクランプしてくれる
  return formatHex({ ...rgb, mode: "rgb" });
};

// ---------------------------------------------------------------------------
// mini.hues make_palette の TypeScript 再実装
// ---------------------------------------------------------------------------
type MiniHuesConfig = {
  background: string;
  foreground: string;
  n_hues: number;
  saturation: "low" | "lowmedium" | "medium" | "mediumhigh" | "high";
  accent: "bg" | "fg";
};

type MiniHuesPalette = {
  bg_edge2: string;
  bg_edge: string;
  bg: string;
  bg_mid: string;
  bg_mid2: string;
  fg_edge2: string;
  fg_edge: string;
  fg: string;
  fg_mid: string;
  fg_mid2: string;
  red: string;
  red_bg: string;
  orange: string;
  orange_bg: string;
  yellow: string;
  yellow_bg: string;
  green: string;
  green_bg: string;
  cyan: string;
  cyan_bg: string;
  azure: string;
  azure_bg: string;
  blue: string;
  blue_bg: string;
  purple: string;
  purple_bg: string;
  accent: string;
  accent_bg: string;
};

const CHROMA_MAP = {
  low: 0.04,
  lowmedium: 0.06,
  medium: 0.08,
  mediumhigh: 0.12,
  high: 0.16,
} as const;

// mini.hues の L は 0-100 スケールだが culori の Oklch は 0-1 スケール。
// ここでは culori の 0-1 スケールで統一する。

const distPeriod = (x: number, y: number, period = 360): number => {
  const d = Math.abs(
    (((x % period) + period) % period) - (((y % period) + period) % period),
  );
  return Math.min(d, period - d);
};

const getClosest = (ref: number, grid: number[]): number => {
  let best = grid[0];
  let bestDist = Infinity;
  for (const val of grid) {
    const d = distPeriod(ref, val, 360);
    if (d <= bestDist) {
      best = val;
      bestDist = d;
    }
  }
  return best;
};

const makeHues = (
  bgH: number | undefined,
  fgH: number | undefined,
  nHues: number,
): Record<string, number | undefined> => {
  const res: Record<string, number | undefined> = { bg: bgH, fg: fgH };
  if (nHues === 0) return res;

  const period = 360 / nHues;
  const halfPeriod = 0.5 * period;

  let d: number;
  if (bgH == null && fgH == null) {
    d = 0;
  } else if (bgH != null && fgH == null) {
    d = ((((bgH % period) + period) % period) + halfPeriod) % period;
  } else if (bgH == null && fgH != null) {
    d = ((((fgH % period) + period) % period) + halfPeriod) % period;
  } else {
    const refBg = ((bgH! % period) + period) % period;
    const refFg = ((fgH! % period) + period) % period;
    const mid = 0.5 * (refBg + refFg);
    const midAlt = (mid + halfPeriod) % period;
    d =
      distPeriod(mid, refBg, period) < distPeriod(midAlt, refBg, period)
        ? midAlt
        : mid;
  }

  const grid: number[] = [];
  for (let i = 0; i < nHues; i++) {
    grid.push(i * period + d);
  }

  const approx = (refHue: number) => getClosest(refHue, grid);

  res.red = approx(0);
  res.orange = approx(45);
  res.yellow = approx(90);
  res.green = approx(135);
  res.cyan = approx(180);
  res.azure = approx(225);
  res.blue = approx(270);
  res.purple = approx(315);

  return res;
};

const makePalette = (config: MiniHuesConfig): MiniHuesPalette => {
  const bgLch = hexToOklch(config.background);
  const fgLch = hexToOklch(config.foreground);
  const bgL = bgLch.l;
  const fgL = fgLch.l;

  const isDark = bgL <= 0.5;
  const lBgEdge = isDark ? 0 : 1;
  const lMid = 0.5 * (bgL + fgL);

  const chroma = CHROMA_MAP[config.saturation];
  const hues = makeHues(bgLch.h, fgLch.h, config.n_hues);

  const lch = (l: number, c: number, h: number | undefined): string =>
    oklchToHex({ l, c, h });

  const bgC = bgLch.c;
  const bgH = bgLch.h;
  const fgC = fgLch.c;
  const fgH = fgLch.h;

  const res: MiniHuesPalette = {
    bg_edge2: lch(0.33 * bgL + 0.67 * lBgEdge, bgC, bgH),
    bg_edge: lch(0.67 * bgL + 0.33 * lBgEdge, bgC, bgH),
    bg: config.background,
    bg_mid: lch(0.67 * bgL + 0.33 * lMid, bgC, bgH),
    bg_mid2: lch(0.33 * bgL + 0.67 * lMid, bgC, bgH),

    fg_edge2: lch(0.33 * fgL + 0.67 * (isDark ? 1 : 0), fgC, fgH),
    fg_edge: lch(0.67 * fgL + 0.33 * (isDark ? 1 : 0), fgC, fgH),
    fg: config.foreground,
    fg_mid: lch(0.67 * fgL + 0.33 * lMid, fgC, fgH),
    fg_mid2: lch(0.33 * fgL + 0.67 * lMid, fgC, fgH),

    red: lch(fgL, chroma, hues.red),
    red_bg: lch(bgL, chroma, hues.red),
    orange: lch(fgL, chroma, hues.orange),
    orange_bg: lch(bgL, chroma, hues.orange),
    yellow: lch(fgL, chroma, hues.yellow),
    yellow_bg: lch(bgL, chroma, hues.yellow),
    green: lch(fgL, chroma, hues.green),
    green_bg: lch(bgL, chroma, hues.green),
    cyan: lch(fgL, chroma, hues.cyan),
    cyan_bg: lch(bgL, chroma, hues.cyan),
    azure: lch(fgL, chroma, hues.azure),
    azure_bg: lch(bgL, chroma, hues.azure),
    blue: lch(fgL, chroma, hues.blue),
    blue_bg: lch(bgL, chroma, hues.blue),
    purple: lch(fgL, chroma, hues.purple),
    purple_bg: lch(bgL, chroma, hues.purple),

    accent: "",
    accent_bg: "",
  };

  if (config.accent === "bg") {
    res.accent = lch(fgL, chroma, bgH);
    res.accent_bg = config.background;
  } else {
    res.accent = config.foreground;
    res.accent_bg = lch(bgL, chroma, fgH);
  }

  return res;
};

// ---------------------------------------------------------------------------
// bg / fg 選定: Vibrant → bg（色相を保って暗く）、Muted → fg（明るく）
// ---------------------------------------------------------------------------
const swatchToBgFg = (
  vibrantHex: string,
  mutedHex: string,
): { bg: string; fg: string } => {
  const vib = hexToOklch(vibrantHex);
  const mut = hexToOklch(mutedHex);

  // bg: Vibrant の色相を保持、L=0.18, C=0.025（暗い背景に色味を残す）
  const bg = oklchToHex({ l: 0.18, c: 0.025, h: vib.h });

  // fg: Muted の色相を保持、L=0.82, C=0.01（明るい前景、ほぼニュートラル）
  const fg = oklchToHex({ l: 0.82, c: 0.01, h: mut.h });

  return { bg, fg };
};

// ---------------------------------------------------------------------------
// SVG 生成
// ---------------------------------------------------------------------------
const SVG_W = 800;
const PAD = 20;
const USABLE_W = SVG_W - PAD * 2;

const COLOR_NAMES_FG = [
  "red",
  "orange",
  "yellow",
  "green",
  "cyan",
  "azure",
  "blue",
  "purple",
] as const;

type BlockData = {
  name: string;
  inputBg: string;
  inputFg: string;
  palette: MiniHuesPalette;
};

const isDarkColor = (hex: string): boolean => {
  const lch = hexToOklch(hex);
  return lch.l < 0.5;
};

const textColor = (bgHex: string): string =>
  isDarkColor(bgHex) ? "#ffffff" : "#000000";

// レイアウト定数
const Y_NAME = 18;
const Y_INPUT = 30;
const H_INPUT = 36;
const Y_BG_LAYER = Y_INPUT + H_INPUT + 10;
const H_LAYER = 32;
const Y_FG_LAYER = Y_BG_LAYER + H_LAYER + 4;
const Y_ACCENT = Y_FG_LAYER + H_LAYER + 10;
const H_ACCENT = 28;
const Y_HUE_FG = Y_ACCENT + H_ACCENT + 10;
const H_HUE = 50;
const Y_HUE_BG = Y_HUE_FG + H_HUE + 4;
const Y_PREVIEW = Y_HUE_BG + H_HUE + 10;
const H_PREVIEW = 80;
const BLOCK_H = Y_PREVIEW + H_PREVIEW + 16;

const generateBlock = (data: BlockData, blockY: number): string => {
  const lines: string[] = [];
  const p = data.palette;
  lines.push(`  <g transform="translate(0,${blockY})">`);

  // キャラ名
  lines.push(
    `    <text x="${PAD}" y="${Y_NAME}" fill="#aaaaaa" font-size="13" font-weight="bold">${data.name}</text>`,
  );

  // Input: bg / fg 2色
  const inputW = USABLE_W / 2;
  for (const [i, { label, hex }] of [
    { label: "bg", hex: data.inputBg },
    { label: "fg", hex: data.inputFg },
  ].entries()) {
    const x = PAD + i * inputW;
    const tc = textColor(hex);
    lines.push(
      `    <rect x="${x}" y="${Y_INPUT}" width="${inputW}" height="${H_INPUT}" fill="${hex}" ${i === 0 ? 'rx="3 0 0 3"' : 'rx="0 3 3 0"'}/>`,
    );
    lines.push(
      `    <text x="${x + 8}" y="${Y_INPUT + 14}" fill="${tc}" font-size="9" font-weight="bold" opacity="0.7">${label}</text>`,
    );
    lines.push(
      `    <text x="${x + inputW / 2}" y="${Y_INPUT + H_INPUT - 8}" fill="${tc}" font-size="10" text-anchor="middle">${hex}</text>`,
    );
  }

  // bg レイヤー (5段階)
  const bgKeys = ["bg_edge2", "bg_edge", "bg", "bg_mid", "bg_mid2"] as const;
  const bgLabels = ["edge2", "edge", "bg", "mid", "mid2"];
  const layerCellW = USABLE_W / 5;
  for (let i = 0; i < bgKeys.length; i++) {
    const hex = p[bgKeys[i]];
    const x = PAD + i * layerCellW;
    const tc = textColor(hex);
    lines.push(
      `    <rect x="${x}" y="${Y_BG_LAYER}" width="${layerCellW}" height="${H_LAYER}" fill="${hex}"/>`,
    );
    lines.push(
      `    <text x="${x + 4}" y="${Y_BG_LAYER + 12}" fill="${tc}" font-size="7" opacity="0.6">${bgLabels[i]}</text>`,
    );
    lines.push(
      `    <text x="${x + layerCellW / 2}" y="${Y_BG_LAYER + H_LAYER - 6}" fill="${tc}" font-size="8" text-anchor="middle">${hex}</text>`,
    );
  }

  // fg レイヤー (5段階)
  const fgKeys = ["fg_edge2", "fg_edge", "fg", "fg_mid", "fg_mid2"] as const;
  const fgLabels = ["edge2", "edge", "fg", "mid", "mid2"];
  for (let i = 0; i < fgKeys.length; i++) {
    const hex = p[fgKeys[i]];
    const x = PAD + i * layerCellW;
    const tc = textColor(hex);
    lines.push(
      `    <rect x="${x}" y="${Y_FG_LAYER}" width="${layerCellW}" height="${H_LAYER}" fill="${hex}"/>`,
    );
    lines.push(
      `    <text x="${x + 4}" y="${Y_FG_LAYER + 12}" fill="${tc}" font-size="7" opacity="0.6">${fgLabels[i]}</text>`,
    );
    lines.push(
      `    <text x="${x + layerCellW / 2}" y="${Y_FG_LAYER + H_LAYER - 6}" fill="${tc}" font-size="8" text-anchor="middle">${hex}</text>`,
    );
  }

  // accent 2色
  const accentW = USABLE_W / 2;
  for (const [i, { label, hex }] of [
    { label: "accent", hex: p.accent },
    { label: "accent_bg", hex: p.accent_bg },
  ].entries()) {
    const x = PAD + i * accentW;
    const tc = textColor(hex);
    lines.push(
      `    <rect x="${x}" y="${Y_ACCENT}" width="${accentW}" height="${H_ACCENT}" fill="${hex}"/>`,
    );
    lines.push(
      `    <text x="${x + 4}" y="${Y_ACCENT + 12}" fill="${tc}" font-size="7" opacity="0.6">${label}</text>`,
    );
    lines.push(
      `    <text x="${x + accentW / 2}" y="${Y_ACCENT + H_ACCENT - 6}" fill="${tc}" font-size="8" text-anchor="middle">${hex}</text>`,
    );
  }

  // 色相8色 fg明度バリアント
  lines.push(
    `    <text x="${PAD}" y="${Y_HUE_FG - 2}" fill="#888888" font-size="9">hue colors (fg lightness)</text>`,
  );
  const hueCellW = USABLE_W / 8;
  for (let i = 0; i < COLOR_NAMES_FG.length; i++) {
    const name = COLOR_NAMES_FG[i];
    const hex = p[name];
    const x = PAD + i * hueCellW;
    const tc = textColor(hex);
    lines.push(
      `    <rect x="${x}" y="${Y_HUE_FG + 2}" width="${hueCellW}" height="${H_HUE - 4}" fill="${hex}" rx="2"/>`,
    );
    lines.push(
      `    <text x="${x + hueCellW / 2}" y="${Y_HUE_FG + 16}" fill="${tc}" font-size="9" text-anchor="middle" font-weight="bold">${name}</text>`,
    );
    lines.push(
      `    <text x="${x + hueCellW / 2}" y="${Y_HUE_FG + H_HUE - 10}" fill="${tc}" font-size="8" text-anchor="middle">${hex}</text>`,
    );
  }

  // 色相8色 bg明度バリアント
  lines.push(
    `    <text x="${PAD}" y="${Y_HUE_BG - 2}" fill="#888888" font-size="9">hue colors (bg lightness)</text>`,
  );
  for (let i = 0; i < COLOR_NAMES_FG.length; i++) {
    const name = COLOR_NAMES_FG[i];
    const bgKey = `${name}_bg` as keyof MiniHuesPalette;
    const hex = p[bgKey];
    const x = PAD + i * hueCellW;
    const tc = textColor(hex);
    lines.push(
      `    <rect x="${x}" y="${Y_HUE_BG + 2}" width="${hueCellW}" height="${H_HUE - 4}" fill="${hex}" rx="2"/>`,
    );
    lines.push(
      `    <text x="${x + hueCellW / 2}" y="${Y_HUE_BG + 16}" fill="${tc}" font-size="9" text-anchor="middle" font-weight="bold">${name}_bg</text>`,
    );
    lines.push(
      `    <text x="${x + hueCellW / 2}" y="${Y_HUE_BG + H_HUE - 10}" fill="${tc}" font-size="8" text-anchor="middle">${hex}</text>`,
    );
  }

  // Neovim 風プレビュー
  lines.push(
    `    <text x="${PAD}" y="${Y_PREVIEW - 2}" fill="#888888" font-size="9">neovim preview</text>`,
  );
  const previewX = PAD;
  const previewW = USABLE_W;
  lines.push(
    `    <rect x="${previewX}" y="${Y_PREVIEW}" width="${previewW}" height="${H_PREVIEW}" fill="${p.bg}" rx="4"/>`,
  );

  // 行番号
  const lnX = previewX + 8;
  const lineH = 14;
  for (let i = 0; i < 5; i++) {
    const y = Y_PREVIEW + 14 + i * lineH;
    lines.push(
      `    <text x="${lnX}" y="${y}" fill="${p.bg_mid2}" font-size="10">${(i + 1).toString().padStart(2, " ")}</text>`,
    );
  }

  // 擬似コード
  const codeX = lnX + 28;
  const codeLine = (
    i: number,
    parts: Array<{ text: string; fill: string }>,
  ) => {
    let x = codeX;
    const y = Y_PREVIEW + 14 + i * lineH;
    for (const part of parts) {
      lines.push(
        `    <text x="${x}" y="${y}" fill="${part.fill}" font-size="10">${part.text}</text>`,
      );
      x += part.text.length * 6.2;
    }
  };

  codeLine(0, [{ text: "-- comment", fill: p.fg_mid2 }]);
  codeLine(1, [
    { text: "local ", fill: p.fg },
    { text: "fn", fill: p.azure },
    { text: " = ", fill: p.fg },
    { text: "function", fill: p.purple },
    { text: "(", fill: p.orange },
    { text: "x", fill: p.blue },
    { text: ")", fill: p.orange },
  ]);
  codeLine(2, [
    { text: "  ", fill: p.fg },
    { text: "if ", fill: p.fg },
    { text: "x", fill: p.blue },
    { text: " > ", fill: p.fg },
    { text: "0", fill: p.purple },
    { text: " then ", fill: p.fg },
    { text: "return ", fill: p.orange },
    { text: '"ok"', fill: p.green },
  ]);
  codeLine(3, [
    { text: "  ", fill: p.fg },
    { text: "end", fill: p.fg },
  ]);
  codeLine(4, [{ text: "end", fill: p.fg }]);

  // CursorLine
  lines.push(
    `    <rect x="${previewX + 2}" y="${Y_PREVIEW + 3 + 1 * lineH}" width="${previewW - 4}" height="${lineH}" fill="${p.bg_mid}" rx="2" opacity="0.5"/>`,
  );

  lines.push("  </g>");
  return lines.join("\n");
};

const generateSvg = (blocks: BlockData[]): string => {
  const totalH = blocks.length * BLOCK_H + PAD * 2;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_W}" height="${totalH}" style="background:#111111; font-family:ui-monospace,monospace;">`,
    ...blocks.map((data, i) => generateBlock(data, PAD + i * BLOCK_H)),
    "</svg>",
  ];
  return parts.join("\n");
};

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

/** サンプル 5 キャラ（色味がバラけるように選定） */
const SAMPLE_CHARS: Record<string, string[]> = {
  genshin: ["Arlecchino", "Furina", "Nahida", "RaidenShogun", "Zhongli"],
  starrail: ["Acheron", "Argenti", "BlackSwan", "Blade", "Aventurine"],
};

await mkdir(OUT_DIR, { recursive: true });

for (const game of ["genshin", "starrail"] as const) {
  const imgDir = join(IMG_BASE, game);
  const targets = SAMPLE_CHARS[game];

  console.log(`\n[${game}] ${targets.length} characters (sample)`);

  const blocks: BlockData[] = [];

  for (const name of targets) {
    process.stdout.write(`  ${name} ... `);

    const imgPath = join(imgDir, `${name}.png`);
    const swatchMap = await getSwatches(imgPath, {
      ...OPTIONS_BASE,
      colorCount: 16,
    });

    const vibrant = swatchMap.Vibrant?.color;
    const muted = swatchMap.Muted?.color;

    if (!vibrant || !muted) {
      console.log("skip (no Vibrant/Muted)");
      continue;
    }

    const vibrantHex = vibrant.hex();
    const mutedHex = muted.hex();
    const { bg, fg } = swatchToBgFg(vibrantHex, mutedHex);

    const palette = makePalette({
      background: bg,
      foreground: fg,
      n_hues: 8,
      saturation: "medium",
      accent: "bg",
    });

    blocks.push({ name, inputBg: bg, inputFg: fg, palette });
    console.log(
      `done  vibrant=${vibrantHex} muted=${mutedHex} → bg=${bg} fg=${fg}`,
    );
  }

  const svg = generateSvg(blocks);
  const outFile = join(OUT_DIR, `${game}.svg`);
  await writeFile(outFile, svg, "utf-8");
  console.log(`Generated: ${outFile}`);
}
