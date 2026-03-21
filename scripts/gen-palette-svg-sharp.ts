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

// --- seed スコアリング（node-vibrant target 方式） ---

/** node-vibrant の Vibrant/DarkVibrant target（saturation, luma は 0-1） */
const VIBRANT_TARGET = { saturation: 0.74, luma: 0.45 };
const DARK_VIBRANT_TARGET = { saturation: 0.74, luma: 0.26 };

/** node-vibrant 準拠の重み付き距離 */
const W_SATURATION = 3;
const W_LUMA = 6.5;

const targetDistance = (
  saturation: number,
  luma: number,
  target: { saturation: number; luma: number },
): number => {
  const ds = saturation - target.saturation;
  const dl = luma - target.luma;
  return Math.sqrt(W_SATURATION * ds * ds + W_LUMA * dl * dl);
};

/** DarkVibrant の距離閾値（これを超えるとフォールバック） */
const DARK_DISTANCE_THRESHOLD = 0.5;

type SeedResult = { color: Color; distance: number };
type SeedPair = {
  bright: SeedResult;
  dark: SeedResult | null;
};

/** HSL → hex 変換（フォールバック合成用） */
const hslToHex = (h: number, s: number, l: number): string => {
  const sn = s / 100;
  const ln = l / 100;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = ln - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * Math.max(0, Math.min(1, color)))
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

/** 軸内から Vibrant/DarkVibrant の2 seed を選定 */
const selectSeeds = (colors: Color[]): SeedPair => {
  let bestBright: SeedResult = { color: colors[0], distance: Infinity };
  let bestDark: SeedResult = { color: colors[0], distance: Infinity };

  for (const color of colors) {
    const hsl = color.hsl();
    const s = hsl.s / 100;
    const l = hsl.l / 100;

    const vibrantDist = targetDistance(s, l, VIBRANT_TARGET);
    if (vibrantDist < bestBright.distance) {
      bestBright = { color, distance: vibrantDist };
    }

    const darkDist = targetDistance(s, l, DARK_VIBRANT_TARGET);
    if (darkDist < bestDark.distance) {
      bestDark = { color, distance: darkDist };
    }
  }

  // 同一色が両方で選ばれた場合 → Vibrant に割り当て、DarkVibrant は null
  if (bestBright.color === bestDark.color) {
    return { bright: bestBright, dark: null };
  }

  // DarkVibrant が閾値を超える場合 → フォールバック
  if (bestDark.distance > DARK_DISTANCE_THRESHOLD) {
    return { bright: bestBright, dark: null };
  }

  return { bright: bestBright, dark: bestDark };
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
const H_SEED = 42;
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
type SeedInfo = ColorInfo & { distance: number; isFallback: boolean };
type AxisInfo = {
  role: string;
  colors: ColorInfo[];
  brightSeed: SeedInfo;
  darkSeed: SeedInfo | null;
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

  // Seed Colors（5 seeds: main-bright, main-dark, sub-bright, sub-dark, accent）
  if (result.axes.length > 0) {
    lines.push(
      `    <text x="${PAD}" y="${Y_SEED + 4}" fill="#888888" font-size="9">seed colors (vibrant / dark-vibrant)</text>`,
    );

    // seed を flat なリストに展開
    type SeedSlot = {
      label: string;
      role: string;
      seed: SeedInfo;
    };
    const slots: SeedSlot[] = [];
    for (const axis of result.axes) {
      const roleColor = axis.role;
      slots.push({
        label: `${roleColor}-B`,
        role: roleColor,
        seed: axis.brightSeed,
      });
      if (axis.darkSeed) {
        slots.push({
          label: `${roleColor}-D`,
          role: roleColor,
          seed: axis.darkSeed,
        });
      } else if (roleColor !== "accent") {
        // フォールバック: bright seed を暗くして合成
        const brightHsl = axis.brightSeed;
        slots.push({
          label: `${roleColor}-D`,
          role: roleColor,
          seed: { ...brightHsl, isFallback: true },
        });
      }
    }

    const seedCellW = USABLE_W / Math.max(slots.length, 1);
    for (let si = 0; si < slots.length; si++) {
      const { label, role, seed } = slots[si];
      const { hex, isDark, distance, isFallback } = seed;
      const textColor = isDark ? "#ffffff" : "#000000";
      const roleColor = ROLE_COLORS[role] ?? "#888888";
      const x = PAD + si * seedCellW;
      const cx = x + seedCellW / 2;

      // フォールバック seed は破線ボーダー
      if (isFallback) {
        lines.push(
          `    <rect x="${x}" y="${Y_SEED + 8}" width="${seedCellW}" height="${H_SEED - 12}" fill="${hex}" rx="3" stroke="#ff6666" stroke-width="1" stroke-dasharray="4,2"/>`,
        );
      } else {
        lines.push(
          `    <rect x="${x}" y="${Y_SEED + 8}" width="${seedCellW}" height="${H_SEED - 12}" fill="${hex}" rx="3"/>`,
        );
      }
      lines.push(
        `    <text x="${x + 4}" y="${Y_SEED + 20}" fill="${roleColor}" font-size="8" font-weight="bold" opacity="0.9">${label}</text>`,
      );
      lines.push(
        `    <text x="${cx}" y="${Y_SEED + H_SEED - 8}" fill="${textColor}" font-size="8" text-anchor="middle">${hex}</text>`,
      );
      lines.push(
        `    <text x="${x + seedCellW - 4}" y="${Y_SEED + 20}" fill="${textColor}" font-size="7" text-anchor="end" opacity="0.6">d=${distance.toFixed(2)}</text>`,
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

    // Color Axes + Seed 選定（Vibrant / DarkVibrant target 方式）
    const paletteColors = palette ?? [];
    const colorAxes = deriveColorAxes(paletteColors);
    const axes: AxisInfo[] = colorAxes.map((axis) => {
      const { bright, dark } = selectSeeds(axis.colors);

      // dark seed のフォールバック合成（bright の HSL lightness を下げる）
      let darkSeedInfo: SeedInfo | null = null;
      if (dark) {
        darkSeedInfo = {
          ...toColorInfo(dark.color),
          distance: dark.distance,
          isFallback: false,
        };
      } else if (axis.role !== "accent") {
        const brightHsl = bright.color.hsl();
        const fallbackHex = hslToHex(
          brightHsl.h,
          brightHsl.s,
          Math.max(brightHsl.l - 20, 5),
        );
        darkSeedInfo = {
          hex: fallbackHex,
          isDark: true,
          distance: -1,
          isFallback: true,
        };
      }

      return {
        role: axis.role,
        colors: axis.colors.map(toColorInfo),
        brightSeed: {
          ...toColorInfo(bright.color),
          distance: bright.distance,
          isFallback: false,
        },
        darkSeed: darkSeedInfo,
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
