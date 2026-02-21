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
const MAX_CANDIDATES = 20; // 貪欲法の計算コスト抑制

// color-name-list の nearest 検索（初回呼び出し時に lazy 初期化）
let _finder: ((color: Color | string, n?: number) => Color[]) | null = null;
const _parsedColors: Color[] = [];
const _colorMeta: Array<{ hex: string; name: string }> = [];

const getNameFinder = () => {
    if (_finder) return _finder;

    for (const c of colornames) {
        const parsed = parse(c.hex);
        if (parsed) {
            _parsedColors.push(parsed);
            _colorMeta.push({ hex: c.hex, name: c.name });
        }
    }

    _finder = nearest(_parsedColors, differenceEuclidean("oklab"));
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

    const idx = _parsedColors.indexOf(results[0]);
    return idx >= 0 ? _colorMeta[idx]?.name : undefined;
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
 * @param imageWidth - 元画像の幅（正規化座標の分母）
 * @param imageHeight - 元画像の高さ（正規化座標の分母）
 * @param count - 抽出する色の数（デフォルト: 20）
 * @returns 抽出された ColorPoint の配列
 */
export const extractColors = (
    imageData: ImageData,
    imageWidth: number,
    imageHeight: number,
    count = 20,
): ColorPoint[] => {
    const { data, width, height } = imageData;

    // ステップ1: サンプリング → 量子化 → グルーピング
    const colorMap = new Map<
        string,
        { r: number; g: number; b: number; count: number; x: number; y: number }
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
            } else {
                colorMap.set(key, {
                    r: qr,
                    g: qg,
                    b: qb,
                    count: 1,
                    x: px / imageWidth,
                    y: py / imageHeight,
                });
            }
        }
    }

    // ステップ2: 出現回数でフィルタリングし上位 MAX_CANDIDATES 色に絞る
    const candidates = Array.from(colorMap.values())
        .filter((c) => c.count >= MIN_FREQUENCY)
        .sort((a, b) => b.count - a.count)
        .slice(0, MAX_CANDIDATES);

    if (candidates.length === 0) return [];

    // ステップ3: 貪欲法で OKLab 知覚距離が最大の色を順次選択
    const diffOklab = differenceEuclidean("oklab");

    const parsedCandidates = candidates.map((c) => ({
        ...c,
        hex: toHex(c.r, c.g, c.b),
        parsed: parse(toHex(c.r, c.g, c.b)),
    }));

    const selected: typeof parsedCandidates = [parsedCandidates[0]];

    while (
        selected.length < count &&
        selected.length < parsedCandidates.length
    ) {
        let maxDist = -1;
        let bestIdx = -1;

        for (let i = 0; i < parsedCandidates.length; i++) {
            if (selected.some((s) => s.hex === parsedCandidates[i].hex))
                continue;

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
