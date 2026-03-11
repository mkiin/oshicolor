import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { chromium } from "playwright";

const ROOT_DIR = new URL("../", import.meta.url).pathname;
const IMG_BASE = join(ROOT_DIR, "debug/img");
const OUT_DIR = join(ROOT_DIR, "debug/palettes/colorthief");

const OPTIONS = {
    colorCount: 16,
    quality: 10,
    colorSpace: "rgb",
    ignoreWhite: true,
    minSaturation: 0.05,
};

// --- SVG レイアウト定数 ---

const SVG_W = 660;
const PAD = 20;
const USABLE_W = SVG_W - PAD * 2;
const BLOCK_H = 175;

const Y_NAME = 18;
const Y_DOM = 25;
const H_DOM = 28;
const Y_PAL = 60;
const H_PAL = 30;
const Y_SWA = 98;
const H_SWA = 62;

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
    dominantColor: ColorInfo | null;
    palette: ColorInfo[];
    swatches: Record<SwatchRole, ColorInfo | null>;
};

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

    if (result.dominantColor) {
        const { hex, isDark } = result.dominantColor;
        const textColor = isDark ? "#ffffff" : "#000000";
        lines.push(
            `    <rect x="${PAD}" y="${Y_DOM}" width="${USABLE_W}" height="${H_DOM}" fill="${hex}" rx="3"/>`,
        );
        lines.push(
            `    <text x="${PAD + USABLE_W - 6}" y="${Y_DOM + Math.floor(H_DOM / 2) + 4}" fill="${textColor}" font-size="10" text-anchor="end">${hex}</text>`,
        );
    }

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

const colorthiefBundle = await readFile(
    join(ROOT_DIR, "node_modules/colorthief/dist/index.browser.js"),
    "utf-8",
);

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

// colorthief ブラウザバンドルをローカル URL として提供
await page.route("http://local.test/colorthief.js", (route) =>
    route.fulfill({
        contentType: "application/javascript; charset=utf-8",
        body: colorthiefBundle,
    }),
);

// colorthief の関数を window に展開するページを提供
await page.route("http://local.test/", (route) =>
    route.fulfill({
        contentType: "text/html",
        body: `<!DOCTYPE html><html><body>
<script type="module">
import { getColor, getPalette, getSwatches } from "./colorthief.js";
window.__getColor = getColor;
window.__getPalette = getPalette;
window.__getSwatches = getSwatches;
window.__ready = true;
</script>
</body></html>`,
    }),
);

await page.goto("http://local.test/");
await page.waitForFunction(
    () => (window as Window & { __ready?: boolean }).__ready === true,
);

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

        const imageData = await readFile(join(imgDir, file));
        const imageSrc = `data:image/png;base64,${imageData.toString("base64")}`;

        const result = await page.evaluate(
            async ({ src, opts }) => {
                const img = new Image();
                img.src = src;
                await new Promise<void>((resolve, reject) => {
                    img.onload = () => resolve();
                    img.onerror = () => reject(new Error("Image load failed"));
                });

                const w = window as unknown as {
                    __getColor: (
                        img: HTMLImageElement,
                        opts: unknown,
                    ) => Promise<{ hex(): string; isDark: boolean } | null>;
                    __getPalette: (
                        img: HTMLImageElement,
                        opts: unknown,
                    ) => Promise<Array<{
                        hex(): string;
                        isDark: boolean;
                    }> | null>;
                    __getSwatches: (
                        img: HTMLImageElement,
                        opts: unknown,
                    ) => Promise<
                        Record<
                            string,
                            { color: { hex(): string; isDark: boolean } } | null
                        >
                    >;
                };

                const [dominant, palette, swatches] = await Promise.all([
                    w.__getColor(img, opts),
                    w.__getPalette(img, opts),
                    w.__getSwatches(img, opts),
                ]);

                return {
                    dominantColor: dominant
                        ? { hex: dominant.hex(), isDark: dominant.isDark }
                        : null,
                    palette: (palette ?? []).map((c) => ({
                        hex: c.hex(),
                        isDark: c.isDark,
                    })),
                    swatches: Object.fromEntries(
                        Object.entries(swatches).map(([role, sw]) => [
                            role,
                            sw
                                ? {
                                      hex: sw.color.hex(),
                                      isDark: sw.color.isDark,
                                  }
                                : null,
                        ]),
                    ),
                };
            },
            { src: imageSrc, opts: OPTIONS },
        );

        blocks.push({ name, result: result as ExtractionResult });
        console.log("done");
    }

    const svg = generateSvg(blocks);
    const outFile = join(OUT_DIR, `${game}.svg`);
    await writeFile(outFile, svg, "utf-8");
    console.log(`Generated: ${outFile}`);
}

await browser.close();
