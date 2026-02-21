import { colornames } from "color-name-list";
import {
    type Color,
    differenceEuclidean,
    formatHex,
    nearest,
    parse,
} from "culori";

import type { ColorPoint } from "./types";

// アルゴリズム定数
const SAMPLING_STEP = 8; // サンプリング間隔（px）
const QUANTIZE_STEP = 24; // RGB量子化ステップ
const MIN_ALPHA = 128; // 半透明以下を除外
const MIN_BRIGHTNESS = 30; // エディタで使いにくい極暗色を除外
const MAX_BRIGHTNESS = 225; // エディタで使いにくい極明色を除外
const MIN_FREQUENCY = 10; // ノイズ色を除去するための最低出現回数
const MAX_CANDIDATES = 100; // 貪欲法の計算コスト抑制。count の最大想定値（20）の 5 倍を確保する

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
 * HEX文字列から最近傍の色名を返す
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

const toHex = (r: number, g: number, b: number): string => {
    return (
        formatHex({ mode: "rgb", r: r / 255, g: g / 255, b: b / 255 }) ??
        "#000000"
    );
};

/**
 * 画像データからドミナントカラーを抽出する
 *
 * OKLab 知覚距離を使った貪欲法により、視覚的に多様な色を選択する。
 *
 * @param imageData - Canvas から取得した ImageData
 * @param imageWidth - 元画像の幅（正規化座標の分母）。ImageData と元画像のサイズが
 *   異なる場合（縮小キャンバス等）に正しい正規化のために必要。
 * @param imageHeight - 元画像の高さ（正規化座標の分母）
 * @param count - 抽出する色の数（デフォルト: 5）
 * @returns 抽出された ColorPoint の配列
 */
export const extractColors = (
    imageData: ImageData,
    imageWidth: number,
    imageHeight: number,
    count = 5,
): ColorPoint[] => {
    const { data, width, height } = imageData;

    // ステップ1: サンプリング → 量子化 → グルーピング
    // x, y は重心計算のためにグループ内の合計値を蓄積し、最後に count で割る
    const colorMap = new Map<
        string,
        {
            r: number;
            g: number;
            b: number;
            count: number;
            xSum: number;
            ySum: number;
        }
    >();

    for (let py = 0; py < height; py += SAMPLING_STEP) {
        for (let px = 0; px < width; px += SAMPLING_STEP) {
            const idx = (py * width + px) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];

            if (a < MIN_ALPHA) continue;

            // 明度が極端な色はエディタテーマで使いにくいため除外する
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
            if (brightness < MIN_BRIGHTNESS || brightness > MAX_BRIGHTNESS)
                continue;

            const qr = Math.round(r / QUANTIZE_STEP) * QUANTIZE_STEP;
            const qg = Math.round(g / QUANTIZE_STEP) * QUANTIZE_STEP;
            const qb = Math.round(b / QUANTIZE_STEP) * QUANTIZE_STEP;
            const key = `${qr},${qg},${qb}`;

            const existing = colorMap.get(key);
            if (existing) {
                existing.count += 1;
                existing.xSum += px;
                existing.ySum += py;
            } else {
                colorMap.set(key, {
                    r: qr,
                    g: qg,
                    b: qb,
                    count: 1,
                    xSum: px,
                    ySum: py,
                });
            }
        }
    }

    // ステップ2: 出現回数でフィルタリングし上位 MAX_CANDIDATES 色に絞る
    const candidates = Array.from(colorMap.values())
        .filter((c) => c.count >= MIN_FREQUENCY)
        .sort((a, b) => b.count - a.count)
        .slice(0, MAX_CANDIDATES)
        .map((c) => ({
            ...c,
            // 重心座標を正規化（グループ内の平均ピクセル位置 → 元画像基準で 0-1 に変換）
            x: c.xSum / c.count / imageWidth,
            y: c.ySum / c.count / imageHeight,
        }));

    if (candidates.length === 0) return [];

    // ステップ3: 貪欲法で OKLab 知覚距離が最大の色を順次選択
    const diffOklab = differenceEuclidean("oklab");

    const parsedCandidates = candidates.map((c) => {
        const hex = toHex(c.r, c.g, c.b);
        return { ...c, hex, parsed: parse(hex) };
    });

    const selectedIndices = new Set<number>([0]);
    const selected = [parsedCandidates[0]];

    while (
        selected.length < count &&
        selected.length < parsedCandidates.length
    ) {
        let maxDist = -1;
        let bestIdx = -1;

        for (let i = 0; i < parsedCandidates.length; i++) {
            if (selectedIndices.has(i)) continue;

            const candidate = parsedCandidates[i].parsed;
            if (!candidate) continue;

            // 既選択色との最小距離が最大の候補を選ぶ（多様性最大化）
            let minDist = Number.POSITIVE_INFINITY;
            for (const s of selected) {
                if (!s.parsed) continue;
                const dist = diffOklab(candidate, s.parsed);
                if (dist < minDist) minDist = dist;
            }

            if (minDist > maxDist) {
                maxDist = minDist;
                bestIdx = i;
            }
        }

        if (bestIdx === -1) break;
        selectedIndices.add(bestIdx);
        selected.push(parsedCandidates[bestIdx]);
    }

    // ステップ4: ColorPoint に変換し色名を付与
    return selected.map((c, i) => ({
        id: i + 1,
        x: c.x,
        y: c.y,
        color: c.hex,
        name: findColorName(c.hex),
    }));
};
