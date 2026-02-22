import type { ColorPoint } from "@/features/color-extractor/types";

/**
 * 色抽出アルゴリズムの種別
 */
export type ExtractMethod = "extract-colors" | "kmeans";

/**
 * 色抽出の実行結果（アルゴリズム・カラーリスト・計算時間）
 */
export type ExtractionResult = {
    method: ExtractMethod;
    colors: ColorPoint[];
    /** 計算時間 (ms) */
    elapsedMs: number;
};
