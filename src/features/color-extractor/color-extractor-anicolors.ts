import { colornames } from "color-name-list";
import { formatHex } from "culori";
import nearestColor from "nearest-color";
import quantize from "quantize";

import type { ColorPoint } from "./types";

// アルゴリズム定数
const SAMPLE_STEP = 4; // サンプリング間隔（px）。anicolors CPP Cinema に合わせて 4px
const MIN_ALPHA = 125; // 透明ピクセルの除外閾値

// nearest-color はモジュールロード時に初期化（{ name: hex } のフラットオブジェクトを要求する）
const colorNameMap = colornames.reduce<Record<string, string>>(
    (acc, { name, hex }) => {
        acc[name] = hex;
        return acc;
    },
    {},
);
const findNearestColor = nearestColor.from(colorNameMap);

/**
 * 画像データからドミナントカラーを抽出する（anicolors CPP Cinema 参照実装）
 *
 * quantize ライブラリ（中央値カット法）による色量子化と出現パーセンテージを使用する。
 * OKLab 実装との比較用。
 *
 * @param imageData - Canvas から取得した ImageData
 * @param imageWidth - 元画像の幅（現実装では未使用。インターフェース統一のために保持）
 * @param imageHeight - 元画像の高さ（現実装では未使用。インターフェース統一のために保持）
 * @param count - 抽出する色の数（デフォルト: 12）
 * @returns 抽出された ColorPoint の配列（percent フィールド付き）
 */
export const extractColorsAnicolors = (
    imageData: ImageData,
    _imageWidth: number,
    _imageHeight: number,
    count = 12,
): ColorPoint[] => {
    const { data, width, height } = imageData;

    // ステップ1: ピクセルをサンプリングして quantize に渡す形式に変換
    const pixels: [number, number, number][] = [];

    for (let py = 0; py < height; py += SAMPLE_STEP) {
        for (let px = 0; px < width; px += SAMPLE_STEP) {
            const idx = (py * width + px) * 4;
            const r = data[idx] ?? 0;
            const g = data[idx + 1] ?? 0;
            const b = data[idx + 2] ?? 0;
            const a = data[idx + 3] ?? 0;

            if (a < MIN_ALPHA) continue;

            pixels.push([r, g, b]);
        }
    }

    if (pixels.length === 0) return [];

    // ステップ2: quantize（中央値カット法）で色量子化
    // count + 1 で呼ぶのは先頭1色が背景として除外される設計のため（anicolors 準拠）
    const cmap = quantize(pixels, count + 1);
    if (!cmap) return [];

    const palette: [number, number, number][] = cmap.palette();

    // ステップ3: 各 VBox のピクセルカウントを直接取得（全ピクセル再走査を回避）
    const counts = Array.from({ length: palette.length }, (_, i) =>
        cmap.vboxes.peek(i).vbox.count(),
    );
    const total = counts.reduce((sum, c) => sum + c, 0);

    // ステップ4: ColorPoint に変換し色名・パーセンテージを付与
    return palette.map(([r = 0, g = 0, b = 0], i) => {
        const hex =
            formatHex({ mode: "rgb", r: r / 255, g: g / 255, b: b / 255 }) ??
            "#000000";
        const colorName = findNearestColor(hex);
        const percent =
            total > 0
                ? Math.round(((counts[i] ?? 0) / total) * 10000) / 100
                : 0;

        return {
            id: i + 1,
            // quantize は位置情報を持たないため座標は 0 で埋める
            x: 0,
            y: 0,
            color: hex,
            name: colorName?.name,
            percent,
        };
    });
};
