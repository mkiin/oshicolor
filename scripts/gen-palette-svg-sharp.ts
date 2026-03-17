import { mkdir, readdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { Color } from "colorthief";
import { getPalette, getSwatches } from "colorthief";
import { deriveColorAxes } from "../src/features/color-extractor/color-axes";

const ROOT_DIR = new URL("../", import.meta.url).pathname;
const IMG_BASE = join(ROOT_DIR, "debug/img");
const OUT_DIR = join(ROOT_DIR, "debug/palettes/colorthief");

const OPTIONS_BASE = {
  quality: 10,
  colorSpace: "rgb" as const,
  ignoreWhite: true,
  minSaturation: 0.05,
};

const OPTIONS = { ...OPTIONS_BASE, colorCount: 16 };

const DOMINANT_COUNT = 5;

// --- seed スコアリング ---

/** sRGB(0-255) → OkLch 簡易変換 */
const rgbToOklch = (r: number, g: number, b: number) => {
  const srgbToLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const lr = srgbToLinear(r / 255);
  const lg = srgbToLinear(g / 255);
  const lb = srgbToLinear(b / 255);
  const l_ = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m_ = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s_ = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l1 = Math.cbrt(l_);
  const m1 = Math.cbrt(m_);
  const s1 = Math.cbrt(s_);
  const L = 0.2104542553 * l1 + 0.793617785 * m1 - 0.0040720468 * s1;
  const a = 1.9779984951 * l1 - 2.428592205 * m1 + 0.4505937099 * s1;
  const bk = 0.0259040371 * l1 + 0.7827717662 * m1 - 0.808675766 * s1;
  const C = Math.sqrt(a * a + bk * bk);
  let H = (Math.atan2(bk, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { l: L, c: C, h: H };
};

/** syntax 色として使いやすさをスコアリング */
const scoreSeed = (l: number, c: number): number => {
  const TARGET_CHROMA = 0.15;
  const chromaScore =
    c >= 0.05 ? 1 - Math.min(Math.abs(c - TARGET_CHROMA) / 0.2, 1) : 0;
  const TARGET_L = 0.62;
  const lightnessScore = 1 - Math.min(Math.abs(l - TARGET_L) / 0.3, 1);
  return chromaScore * lightnessScore;
};

/** 軸内から seed 色を選定 */
const selectSeed = (colors: Color[]): { color: Color; score: number } => {
  let best = { color: colors[0], score: 0 };
  for (const color of colors) {
    const rgb = color.rgb();
    const o = rgbToOklch(rgb.r, rgb.g, rgb.b);
    const s = scoreSeed(o.l, o.c);
    if (s > best.score) best = { color, score: s };
  }
  return best;
};

// --- SVG レイアウト定数 ---

const SVG_W = 660;
const PAD = 20;
const USABLE_W = SVG_W - PAD * 2;

const Y_NAME = 18;
const Y_DOM = 25;
const H_DOM = 40;
const Y_PAL = Y_DOM + H_DOM + 7;
const H_PAL = 30;
const Y_SWA = Y_PAL + H_PAL + 7;
const H_SWA = 62;
const Y_AXES = Y_SWA + H_SWA + 10;
const H_AXIS_ROW = 36;
const AXIS_COUNT = 3;
const Y_SEED = Y_AXES + H_AXIS_ROW * AXIS_COUNT + 8;
const H_SEED = 36;
const BLOCK_H = Y_SEED + H_SEED + 13;

const SWATCH_ROLES = [
  "Vibrant",
  "Muted",
  "DarkVibrant",
  "DarkMuted",
  "LightVibrant",
  "LightMuted",
] as const;

const SWATCH_LABELS: Record<(typeof SWATCH_ROLES)[number], string> = {
  Vibrant: "Vibrant",
  Muted: "Muted",
  DarkVibrant: "DkVibrant",
  DarkMuted: "DkMuted",
  LightVibrant: "LtVibrant",
  LightMuted: "LtMuted",
};

const ROLE_COLORS: Record<string, string> = {
  main: "#ff9966",
  sub: "#66ccff",
  accent: "#cc66ff",
};

// --- 型 ---

type SwatchRole = (typeof SWATCH_ROLES)[number];
type ColorInfo = { hex: string; isDark: boolean };
type AxisInfo = {
  role: string;
  colors: ColorInfo[];
  seed: ColorInfo & { score: number };
};
type ExtractionResult = {
  dominantColors: ColorInfo[];
  palette: ColorInfo[];
  swatches: Record<SwatchRole, ColorInfo | null>;
  axes: AxisInfo[];
};

const toColorInfo = (color: Color): ColorInfo => ({
  hex: color.hex(),
  isDark: color.isDark,
});

// --- SVG 生成 ---

const generateBlock = (
  name: string,
  result: ExtractionResult,
  blockY: number,
): string => {
  const lines: string[] = [];
  lines.push(`  <g transform="translate(0,${blockY})">`);

  lines.push(
    `    <text x="${PAD}" y="${Y_NAME}" fill="#aaaaaa" font-size="13" font-weight="bold">${name}</text>`,
  );

  // ドミナントカラー上位 5 色
  const domCellW = USABLE_W / DOMINANT_COUNT;
  for (let i = 0; i < result.dominantColors.length; i++) {
    const { hex, isDark } = result.dominantColors[i];
    const textColor = isDark ? "#ffffff" : "#000000";
    const x = PAD + i * domCellW;
    const cx = x + domCellW / 2;
    const rx = i === 0 ? 'rx="3"' : i === DOMINANT_COUNT - 1 ? 'rx="3"' : "";
    lines.push(
      `    <rect x="${x}" y="${Y_DOM}" width="${domCellW}" height="${H_DOM}" fill="${hex}" ${rx}/>`,
    );
    lines.push(
      `    <text x="${x + 5}" y="${Y_DOM + 14}" fill="${textColor}" font-size="11" font-weight="bold" opacity="0.7">${i + 1}</text>`,
    );
    lines.push(
      `    <text x="${cx}" y="${Y_DOM + H_DOM - 7}" fill="${textColor}" font-size="9" text-anchor="middle">${hex}</text>`,
    );
  }

  // パレット 16 色
  const palCount = result.palette.length;
  if (palCount > 0) {
    const cellW = USABLE_W / palCount;
    for (let i = 0; i < palCount; i++) {
      const { hex } = result.palette[i];
      const x = PAD + i * cellW;
      lines.push(
        `    <rect x="${x}" y="${Y_PAL}" width="${cellW}" height="${H_PAL}" fill="${hex}"/>`,
      );
    }
  }

  // スウォッチ 6 スロット
  const swaCellW = USABLE_W / SWATCH_ROLES.length;
  for (let i = 0; i < SWATCH_ROLES.length; i++) {
    const role = SWATCH_ROLES[i];
    const label = SWATCH_LABELS[role];
    const x = PAD + i * swaCellW;
    const cx = x + swaCellW / 2;
    const swatch = result.swatches[role];

    if (!swatch) {
      lines.push(
        `    <rect x="${x}" y="${Y_SWA}" width="${swaCellW}" height="${H_SWA}" fill="#2a2a2a" rx="2"/>`,
      );
      lines.push(
        `    <text x="${cx}" y="${Y_SWA + Math.floor(H_SWA / 2) + 4}" fill="#555555" font-size="9" text-anchor="middle">—</text>`,
      );
    } else {
      const { hex, isDark } = swatch;
      const textColor = isDark ? "#ffffff" : "#000000";
      lines.push(
        `    <rect x="${x}" y="${Y_SWA}" width="${swaCellW}" height="${H_SWA}" fill="${hex}" rx="2"/>`,
      );
      lines.push(
        `    <text x="${cx}" y="${Y_SWA + 14}" fill="${textColor}" font-size="8" text-anchor="middle">${label}</text>`,
      );
      lines.push(
        `    <text x="${cx}" y="${Y_SWA + H_SWA - 8}" fill="${textColor}" font-size="9" text-anchor="middle">${hex}</text>`,
      );
    }
  }

  // Color Axes（3軸）
  const labelW = 60;
  const axisColorAreaW = USABLE_W - labelW;
  for (let ai = 0; ai < result.axes.length; ai++) {
    const axis = result.axes[ai];
    const rowY = Y_AXES + ai * H_AXIS_ROW;
    const roleColor = ROLE_COLORS[axis.role] ?? "#888888";

    lines.push(
      `    <text x="${PAD}" y="${rowY + 22}" fill="${roleColor}" font-size="11" font-weight="bold">${axis.role}</text>`,
    );
    lines.push(
      `    <text x="${PAD + 38}" y="${rowY + 22}" fill="#666666" font-size="9">(${axis.colors.length})</text>`,
    );

    if (axis.colors.length > 0) {
      const cellW = Math.min(
        axisColorAreaW / axis.colors.length,
        axisColorAreaW / 8,
      );
      for (let ci = 0; ci < axis.colors.length; ci++) {
        const { hex, isDark } = axis.colors[ci];
        const textColor = isDark ? "#ffffff" : "#000000";
        const x = PAD + labelW + ci * cellW;
        lines.push(
          `    <rect x="${x}" y="${rowY + 4}" width="${cellW}" height="${H_AXIS_ROW - 8}" fill="${hex}" rx="2"/>`,
        );
        lines.push(
          `    <text x="${x + cellW / 2}" y="${rowY + H_AXIS_ROW - 12}" fill="${textColor}" font-size="7" text-anchor="middle">${hex}</text>`,
        );
      }
    }
  }

  // Seed Colors
  if (result.axes.length > 0) {
    lines.push(
      `    <text x="${PAD}" y="${Y_SEED + 4}" fill="#888888" font-size="9">seed colors</text>`,
    );

    const seedAreaW = USABLE_W / result.axes.length;
    for (let ai = 0; ai < result.axes.length; ai++) {
      const axis = result.axes[ai];
      const { hex, isDark, score } = axis.seed;
      const textColor = isDark ? "#ffffff" : "#000000";
      const roleColor = ROLE_COLORS[axis.role] ?? "#888888";
      const x = PAD + ai * seedAreaW;
      const cx = x + seedAreaW / 2;

      lines.push(
        `    <rect x="${x}" y="${Y_SEED + 8}" width="${seedAreaW}" height="${H_SEED - 12}" fill="${hex}" rx="3"/>`,
      );
      lines.push(
        `    <text x="${x + 5}" y="${Y_SEED + 21}" fill="${roleColor}" font-size="9" font-weight="bold" opacity="0.9">${axis.role}</text>`,
      );
      lines.push(
        `    <text x="${cx}" y="${Y_SEED + H_SEED - 8}" fill="${textColor}" font-size="9" text-anchor="middle">${hex}</text>`,
      );
      lines.push(
        `    <text x="${x + seedAreaW - 5}" y="${Y_SEED + 21}" fill="${textColor}" font-size="8" text-anchor="end" opacity="0.6">${score.toFixed(2)}</text>`,
      );
    }
  }

  lines.push("  </g>");
  return lines.join("\n");
};

const generateSvg = (
  blocks: Array<{ name: string; result: ExtractionResult }>,
): string => {
  const totalH = blocks.length * BLOCK_H + PAD * 2;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_W}" height="${totalH}" style="background:#111111; font-family:ui-monospace,monospace;">`,
    ...blocks.map(({ name, result }, i) =>
      generateBlock(name, result, PAD + i * BLOCK_H),
    ),
    "</svg>",
  ];
  return parts.join("\n");
};

// --- メイン ---

await mkdir(OUT_DIR, { recursive: true });

for (const game of ["genshin", "starrail"] as const) {
  const imgDir = join(IMG_BASE, game);
  const files = (await readdir(imgDir))
    .filter((f) => f.endsWith(".png"))
    .sort();

  console.log(`\n[${game}] ${files.length} characters`);

  const blocks: Array<{ name: string; result: ExtractionResult }> = [];

  for (const file of files) {
    const name = basename(file, ".png");
    process.stdout.write(`  ${name} ... `);

    const imgPath = join(imgDir, file);

    const [dominant5, palette, swatchMap] = await Promise.all([
      getPalette(imgPath, {
        colorCount: DOMINANT_COUNT,
        ...OPTIONS_BASE,
      }),
      getPalette(imgPath, OPTIONS),
      getSwatches(imgPath, OPTIONS),
    ]);

    const swatches = Object.fromEntries(
      SWATCH_ROLES.map((role) => {
        const swatch = swatchMap[role];
        return [role, swatch ? toColorInfo(swatch.color) : null];
      }),
    ) as Record<SwatchRole, ColorInfo | null>;

    // Color Axes + Seed 選定
    const paletteColors = palette ?? [];
    const colorAxes = deriveColorAxes(paletteColors);
    const axes: AxisInfo[] = colorAxes.map((axis) => {
      const { color: seedColor, score } = selectSeed(axis.colors);
      return {
        role: axis.role,
        colors: axis.colors.map(toColorInfo),
        seed: { ...toColorInfo(seedColor), score },
      };
    });

    blocks.push({
      name,
      result: {
        dominantColors: (dominant5 ?? []).map(toColorInfo),
        palette: paletteColors.map(toColorInfo),
        swatches,
        axes,
      },
    });

    console.log("done");
  }

  const svg = generateSvg(blocks);
  const outFile = join(OUT_DIR, `${game}.svg`);
  await writeFile(outFile, svg, "utf-8");
  console.log(`Generated: ${outFile}`);
}
