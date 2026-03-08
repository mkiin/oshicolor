#!/usr/bin/env tsx
/**
 * debug/img/genshin 以下の画像に node-vibrant でカラー抽出し、
 * 全キャラクターを1枚の SVG にまとめる。
 *
 * 6スロット: Vibrant / DarkVibrant / LightVibrant / Muted / DarkMuted / LightMuted
 *
 * 出力: debug/palettes/node-vibrant/genshin.svg
 * 実行前に要インストール: pnpm add node-vibrant
 * 実行: pnpm tsx scripts/gen-vibrant-genshin.ts
 */

import { mkdir, readdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { Vibrant } from "node-vibrant/node";

const IMG_DIR = "debug/img/starrail";
const OUT_DIR = "debug/palettes/node-vibrant";
const OUT_FILE = join(OUT_DIR, "starrail.svg");

const SLOT_NAMES = [
    "Vibrant",
    "DarkVibrant",
    "LightVibrant",
    "Muted",
    "DarkMuted",
    "LightMuted",
] as const;

const SLOT_COUNT = SLOT_NAMES.length;
const SWATCH_W = 36;
const SWATCH_H = 36;
const ROW_HEIGHT = 46;
const LABEL_WIDTH = 170;
const PADDING = 8;

const escapeSvgAttr = (s: string) =>
    s
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

async function main() {
    await mkdir(OUT_DIR, { recursive: true });

    const files = (await readdir(IMG_DIR))
        .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
        .sort();

    console.log(`処理対象: ${files.length} 枚`);

    const rows: string[] = [];
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const name = basename(file, `.${file.split(".").at(-1)}`);
        const imgPath = join(IMG_DIR, file);
        const rowY = PADDING + i * ROW_HEIGHT;
        const swatchY = rowY + (ROW_HEIGHT - SWATCH_H) / 2;

        try {
            const palette = await Vibrant.from(imgPath).getPalette();

            // キャラクター名ラベル
            rows.push(
                `  <text x="${PADDING}" y="${rowY + ROW_HEIGHT / 2}" ` +
                    `font-size="13" font-family="monospace" fill="#333" dominant-baseline="middle">` +
                    `${escapeSvgAttr(name)}</text>`,
            );

            // 6スロット分のスウォッチ
            for (let j = 0; j < SLOT_NAMES.length; j++) {
                const role = SLOT_NAMES[j];
                const swatch = palette[role];
                const swatchX = LABEL_WIDTH + j * (SWATCH_W + 2);

                if (swatch == null) {
                    // スロットが null の場合はグレーの空枠
                    rows.push(
                        `  <rect x="${swatchX}" y="${swatchY}" width="${SWATCH_W}" height="${SWATCH_H}" ` +
                            `fill="#eee" stroke="#ccc" stroke-width="1">` +
                            `<title>${role}: null</title></rect>`,
                    );
                    rows.push(
                        `  <text x="${swatchX + SWATCH_W / 2}" y="${swatchY + SWATCH_H / 2}" ` +
                            `font-size="6" font-family="monospace" fill="#aaa" text-anchor="middle" dominant-baseline="middle">` +
                            `null</text>`,
                    );
                } else {
                    const hex = swatch.hex;
                    const textFill = swatch.titleTextColor;
                    const pop = swatch.population;

                    rows.push(
                        `  <rect x="${swatchX}" y="${swatchY}" width="${SWATCH_W}" height="${SWATCH_H}" fill="${hex}">` +
                            `<title>${escapeSvgAttr(`${role}\n${hex}  pop=${pop}`)}</title></rect>`,
                    );
                    rows.push(
                        `  <text x="${swatchX + SWATCH_W / 2}" y="${swatchY + SWATCH_H - 5}" ` +
                            `font-size="6" font-family="monospace" fill="${textFill}" text-anchor="middle">` +
                            `${hex.slice(1)}</text>`,
                    );
                }
            }

            successCount++;
            process.stdout.write(
                `  [${String(i + 1).padStart(2)}/${files.length}] ${name}\n`,
            );
        } catch (err) {
            console.error(`  [ERROR] ${name}:`, err);
        }
    }

    const totalW = LABEL_WIDTH + SLOT_COUNT * (SWATCH_W + 2) + PADDING;
    const totalH = PADDING * 2 + files.length * ROW_HEIGHT;

    // スロット名ヘッダー
    const header = SLOT_NAMES.map((role, j) => {
        const x = LABEL_WIDTH + j * (SWATCH_W + 2) + SWATCH_W / 2;
        return (
            `  <text x="${x}" y="${PADDING - 1}" ` +
            `font-size="7" font-family="monospace" fill="#666" text-anchor="middle">` +
            `${role}</text>`
        );
    }).join("\n");

    // 行の区切り線
    const separators = files
        .map((_, i) => {
            const y = PADDING + i * ROW_HEIGHT;
            return `  <line x1="0" y1="${y}" x2="${totalW}" y2="${y}" stroke="#ddd" stroke-width="0.5"/>`;
        })
        .join("\n");

    const svg = [
        `<svg height="${totalH}" width="${totalW}" viewBox="0 0 ${totalW} ${totalH}"`,
        `  xmlns="http://www.w3.org/2000/svg" style="background:#f8f8f8">`,
        `  <!-- node-vibrant getPalette — genshin — 6 slots -->`,
        header,
        separators,
        ...rows,
        `</svg>`,
    ].join("\n");

    await writeFile(OUT_FILE, svg, "utf-8");
    console.log(`\n完了: ${OUT_FILE}`);
    console.log(`成功: ${successCount}/${files.length} キャラクター`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
