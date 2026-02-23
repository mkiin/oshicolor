/**
 * デバッグ用一括色抽出スクリプト
 *
 * 指定フォルダ内の画像をすべて処理し、結果を JSON で出力する。
 *
 * 使い方:
 *   pnpm debug:extract [画像フォルダ] [出力先.json]
 *
 * デフォルト:
 *   画像フォルダ: ./debug
 *   出力先:       ./debug-result.json
 */
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { pipeline } from "@oshicolor/core";
import type { ImageData as OshiImageData } from "@oshicolor/image";
import sharp from "sharp";
import {
    buildResultFromSwatches,
    type VibrantResult,
} from "../src/features/color-extractor/vibrant-extractor";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

/** ダウンサンプリング係数（ブラウザ側の Extractor デフォルトと同値） */
const QUALITY = 5;
/** 量子化後の最大色数（同上） */
const COLOR_COUNT = 64;

/**
 * sharp でファイルを読み込み、quality でスケールダウンした RGBA ピクセルを返す
 */
const loadScaledImageData = async (
    filePath: string,
): Promise<OshiImageData> => {
    const meta = await sharp(filePath).metadata();
    const origW = meta.width ?? 100;
    const origH = meta.height ?? 100;
    const targetW = Math.max(1, Math.round(origW / QUALITY));
    const targetH = Math.max(1, Math.round(origH / QUALITY));

    const { data, info } = await sharp(filePath)
        .resize(targetW, targetH)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    return {
        data: new Uint8ClampedArray(
            data.buffer,
            data.byteOffset,
            data.byteLength,
        ),
        width: info.width,
        height: info.height,
    };
};

type ImageResult = VibrantResult & { file: string };

const processImage = async (filePath: string): Promise<ImageResult> => {
    const t0 = performance.now();

    const imageData = await loadScaledImageData(filePath);

    // @oshicolor/core の共有パイプラインを直接呼ぶ（BrowserImage を使わない）
    const processed = await pipeline.process(imageData, {
        filters: ["default"],
        quantizer: { name: "mmcq", options: { colorCount: COLOR_COUNT } },
        generators: ["default"],
    });

    const t1 = performance.now();

    const palette = processed.palettes.default;
    if (!palette) {
        throw new Error("Generator 'default' returned no palette");
    }

    return {
        file: path.basename(filePath),
        ...buildResultFromSwatches(palette, processed.colors),
        elapsedMs: Math.round(t1 - t0),
    };
};

const main = async (): Promise<void> => {
    const debugDir = process.argv[2] ?? "debug";
    const outputPath = process.argv[3] ?? "debug-result.json";

    let entries: import("node:fs").Dirent<string>[] = [];
    try {
        entries = await readdir(debugDir, {
            withFileTypes: true,
            encoding: "utf8",
        });
    } catch {
        console.error(`エラー: フォルダ "${debugDir}" を読み込めません`);
        process.exit(1);
    }

    const imageFiles = entries
        .filter(
            (e) =>
                e.isFile() &&
                IMAGE_EXTENSIONS.has(path.extname(e.name).toLowerCase()),
        )
        .map((e) => path.join(debugDir, e.name));

    if (imageFiles.length === 0) {
        console.log(`"${debugDir}" に画像ファイルが見つかりません`);
        return;
    }

    console.log(`${imageFiles.length}枚の画像を処理中...`);

    const results: ImageResult[] = [];
    for (const filePath of imageFiles) {
        process.stdout.write(`  ${path.basename(filePath)} ...`);
        try {
            const result = await processImage(filePath);
            results.push(result);
            console.log(` ${result.swatchCount}色 (${result.elapsedMs}ms)`);
        } catch (err) {
            console.log(
                ` エラー: ${err instanceof Error ? err.message : String(err)}`,
            );
        }
    }

    await writeFile(outputPath, JSON.stringify(results, null, 2), "utf-8");
    console.log(`\n完了: ${outputPath} に出力しました（${results.length}件）`);
};

main().catch(console.error);
