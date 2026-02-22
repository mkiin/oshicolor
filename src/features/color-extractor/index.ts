import { extractColors } from "./color-extractor";
import { extractColorsKmeans } from "./kmeans-extractor";
import type { ExtractionResult } from "./types";

export { extractColors } from "./color-extractor";
export { extractColorsKmeans } from "./kmeans-extractor";
export type { ColorPoint, ExtractionResult, ExtractMethod } from "./types";

/**
 * 2種類の色抽出アルゴリズムを実行し、それぞれの結果と計算時間を返す
 *
 * @param imageData - Canvas から取得した ImageData
 * @param width - 画像の幅
 * @param height - 画像の高さ
 * @param count - 抽出する色の数
 * @returns 両手法の ExtractionResult をまとめたオブジェクト
 */
export const runExtraction = (
    imageData: ImageData,
    width: number,
    height: number,
    count: number,
): { extractColors: ExtractionResult; kmeans: ExtractionResult } => {
    const t0 = performance.now();
    const extractColorsResult = extractColors(imageData, width, height, count);
    const t1 = performance.now();

    const kmeansResult = extractColorsKmeans(imageData, width, height, count);
    const t2 = performance.now();

    return {
        extractColors: {
            method: "extract-colors",
            colors: extractColorsResult,
            elapsedMs: Math.round(t1 - t0),
        },
        kmeans: {
            method: "kmeans",
            colors: kmeansResult,
            elapsedMs: Math.round(t2 - t1),
        },
    };
};
