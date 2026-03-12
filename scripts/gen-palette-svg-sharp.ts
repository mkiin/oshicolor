import { mkdir, readdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { Color } from "colorthief";
import { getPalette, getSwatches } from "colorthief";

const ROOT_DIR = new URL("../", import.meta.url).pathname;
const IMG_BASE = join(ROOT_DIR, "debug/img");
const OUT_DIR = join(ROOT_DIR, "debug/palettes/colorthief");

const OPTIONS_BASE = {
    quality: 10,
    colorSpace: "rgb" as const,
    ignoreWhite: true,
    minSaturation: 0.1,
};

const OPTIONS = { ...OPTIONS_BASE, colorCount: 16 };

const DOMINANT_COUNT = 5;

// --- SVG レイアウト定数 ---

const SVG_W = 660;
const PAD = 20;
const USABLE_W = SVG_W - PAD * 2;

const Y_NAME = 18;
const Y_DOM = 25;
const H_DOM = 40;
const Y_PAL = Y_DOM + H_DOM + 7; // 72
const H_PAL = 30;
const Y_SWA = Y_PAL + H_PAL + 7; // 109
const H_SWA = 62;
const BLOCK_H = Y_SWA + H_SWA + 13; // 184

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

// --- 型 ---

type SwatchRole = (typeof SWATCH_ROLES)[number];
type ColorInfo = { hex: string; isDark: boolean };
type ExtractionResult = {
    dominantColors: ColorInfo[];
    palette: ColorInfo[];
    swatches: Record<SwatchRole, ColorInfo | null>;
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

    // ドミナントカラー上位 5 色（順位付き）
    const domCellW = USABLE_W / DOMINANT_COUNT;
    for (let i = 0; i < result.dominantColors.length; i++) {
        const { hex, isDark } = result.dominantColors[i];
        const textColor = isDark ? "#ffffff" : "#000000";
        const x = PAD + i * domCellW;
        const cx = x + domCellW / 2;
        const rx =
            i === 0 ? 'rx="3"' : i === DOMINANT_COUNT - 1 ? 'rx="3"' : "";
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

        blocks.push({
            name,
            result: {
                dominantColors: (dominant5 ?? []).map(toColorInfo),
                palette: (palette ?? []).map(toColorInfo),
                swatches,
            },
        });

        console.log("done");
    }

    const svg = generateSvg(blocks);
    const outFile = join(OUT_DIR, `${game}.svg`);
    await writeFile(outFile, svg, "utf-8");
    console.log(`Generated: ${outFile}`);
}
