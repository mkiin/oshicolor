import { colornames } from "color-name-list";
import {
    type Color,
    differenceEuclidean,
    formatHex,
    nearest,
    parse,
} from "culori";
import { extractColorsFromImageData } from "extract-colors";

import type { ColorPoint } from "./types";

// アルゴリズム定数
const PIXELS = 64000; // extract-colors へ渡すリサイズ後総ピクセル数（パフォーマンス制御）
// デフォルト(0.22)は色のマージが強すぎて12色に届かないため低めに設定
const DISTANCE = 0.22; // デフォルト : 0.22
const HUE_DISTANCE = 0.083; // デフォルト: 1/12 ≈ 0.083
const SATURATION_DISTANCE = 0.2; // デフォルト: 1/5 = 0.2
const LIGHTNESS_DISTANCE = 0.2; // デフォルト: 1/5 = 0.2
const MIN_ALPHA = 128; // 半透明以下を除外
const MIN_BRIGHTNESS = 30; // エディタで使いにくい極暗色を除外（ピクセルレベル）
const MAX_BRIGHTNESS = 245; // エディタで使いにくい極明色を除外（ピクセルレベル）
// 結果レベルのフィルタ: ピクセル単位フィルタをすり抜けた極端色を除外（FinalColor.lightness は HSL 0-1）
const MIN_LIGHTNESS = 0.08;
const MAX_LIGHTNESS = 0.96;

// color-name-list の nearest 検索（初回呼び出し時に lazy 初期化）
let _finder: ((color: Color | string, n?: number) => Color[]) | null = null;
// formatHex(parsed) をキーとして色名を引くテーブル
const _nameByHex = new Map<string, string>();

const getNameFinder = () => {
    if (_finder) return _finder;

    const parsedColors: Color[] = [];

    for (const c of colornames) {
        const parsed = parse(c.hex);
        if (!parsed) continue;
        const hex = formatHex(parsed);
        if (!hex) continue;
        parsedColors.push(parsed);
        _nameByHex.set(hex, c.name);
    }

    _finder = nearest(parsedColors, differenceEuclidean("oklab"));
    return _finder;
};

/**
 * HEX文字列から最近傍の色名を返す（OKLab 知覚距離）
 *
 * @param hex - 検索対象の HEX 文字列
 * @returns color-name-list の色名、見つからない場合は undefined
 */
const findColorName = (hex: string): string | undefined => {
    const finder = getNameFinder();
    const target = parse(hex);
    if (!target) return undefined;

    const results = finder(target, 1);
    if (!results.length) return undefined;

    // formatHex でキーを統一し Map から色名を引く（参照同一性に依存しない）
    const resultHex = formatHex(results[0]);
    return resultHex ? _nameByHex.get(resultHex) : undefined;
};

/**
 * 画像データからドミナントカラーを抽出する
 *
 * extract-colors ライブラリ（HSL距離ベースクラスタリング）で色を量子化し、
 * OKLab 知覚距離で色名を付与する。
 *
 * @param imageData - Canvas から取得した ImageData
 * @param _imageWidth - 未使用（インターフェース統一のために保持）
 * @param _imageHeight - 未使用（インターフェース統一のために保持）
 * @param count - 抽出する色の数（デフォルト: 12）
 * @returns 抽出された ColorPoint の配列
 */
export const extractColors = (
    imageData: ImageData,
    _imageWidth: number,
    _imageHeight: number,
    count = 12,
): ColorPoint[] => {
    const colors = extractColorsFromImageData(imageData, {
        pixels: PIXELS,
        distance: DISTANCE,
        hueDistance: HUE_DISTANCE,
        saturationDistance: SATURATION_DISTANCE,
        lightnessDistance: LIGHTNESS_DISTANCE,
        // 明度が極端な色はエディタテーマで使いにくいため除外する
        colorValidator: (red, green, blue, alpha) => {
            if (alpha < MIN_ALPHA) return false;
            const brightness = 0.299 * red + 0.587 * green + 0.114 * blue;
            return brightness >= MIN_BRIGHTNESS && brightness <= MAX_BRIGHTNESS;
        },
    });

    // ライブラリのデフォルトは鮮やかさ優先ソートのため、面積降順（支配的な色が先頭）に並び替える
    return colors
        .filter(
            (c) => c.lightness >= MIN_LIGHTNESS && c.lightness <= MAX_LIGHTNESS,
        )
        .sort((a, b) => b.area - a.area)
        .slice(0, count)
        .map((color, i) => ({
            id: i + 1,
            x: 0,
            y: 0,
            color: color.hex,
            name: findColorName(color.hex),
            percent: Math.round(color.area * 10000) / 100,
        }));
};
