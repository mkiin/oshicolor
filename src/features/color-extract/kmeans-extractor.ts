import { colornames } from "color-name-list";
import {
    type Color,
    differenceEuclidean,
    formatHex,
    nearest,
    parse,
} from "culori";

import type { ColorPoint } from "@/features/color-extractor/types";

// アルゴリズム定数
const PIXELS = 64000;
const MAX_ITER = 30;
const TOLERANCE = 0.001;
const MIN_ALPHA = 128;
const MIN_BRIGHTNESS = 30;
const MAX_BRIGHTNESS = 245;
const MIN_LIGHTNESS = 0.08;
const MAX_LIGHTNESS = 0.96;

// OKLab の各成分
type OklabPoint = { L: number; a: number; b: number };

// color-name-list の nearest 検索（lazy 初期化）
let _finder: ((color: Color | string, n?: number) => Color[]) | null = null;
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

    const resultHex = formatHex(results[0]);
    return resultHex ? _nameByHex.get(resultHex) : undefined;
};

/** OKLab ユークリッド距離の二乗 */
const distanceSq = (a: OklabPoint, b: OklabPoint): number => {
    return (a.L - b.L) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2;
};

/**
 * k-means++ 初期化: d² 重み付き確率でセントロイドを k 個選ぶ
 */
const initCentroids = (samples: OklabPoint[], k: number): OklabPoint[] => {
    const centroids: OklabPoint[] = [];

    // 最初の1点はランダムに選択
    const firstIdx = Math.floor(Math.random() * samples.length);
    centroids.push({ ...samples[firstIdx] });

    for (let c = 1; c < k; c++) {
        // 各サンプルと既存セントロイドの最近傍距離² を計算
        const weights = samples.map((s) => {
            const minDist = Math.min(
                ...centroids.map((centroid) => distanceSq(s, centroid)),
            );
            return minDist;
        });

        // 重みの累積和を作成してルーレット選択
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        let rand = Math.random() * totalWeight;
        let chosen = 0;
        for (let i = 0; i < weights.length; i++) {
            rand -= weights[i];
            if (rand <= 0) {
                chosen = i;
                break;
            }
        }
        centroids.push({ ...samples[chosen] });
    }

    return centroids;
};

/**
 * 画像データから k-means++ でドミナントカラーを抽出する
 *
 * OKLab 色空間でクラスタリングを行い、知覚的に均等な色分類を実現する。
 *
 * @param imageData - Canvas から取得した ImageData
 * @param imageWidth - 画像の幅（サンプリングステップ計算に使用）
 * @param imageHeight - 画像の高さ（サンプリングステップ計算に使用）
 * @param count - 抽出する色の数（デフォルト: 12）
 * @returns 抽出された ColorPoint の配列（面積降順）
 */
export const extractColorsKmeans = (
    imageData: ImageData,
    imageWidth: number,
    imageHeight: number,
    count = 12,
): ColorPoint[] => {
    const totalPixels = imageWidth * imageHeight;

    // PIXELS に収まるよう step を自動調整（最小 1）
    const step = Math.max(1, Math.round(Math.sqrt(totalPixels / PIXELS)));

    const oklabSamples: OklabPoint[] = [];

    for (let y = 0; y < imageHeight; y += step) {
        for (let x = 0; x < imageWidth; x += step) {
            const idx = (y * imageWidth + x) * 4;
            const r = imageData.data[idx];
            const g = imageData.data[idx + 1];
            const b = imageData.data[idx + 2];
            const a = imageData.data[idx + 3];

            if (a < MIN_ALPHA) continue;

            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
            if (brightness < MIN_BRIGHTNESS || brightness > MAX_BRIGHTNESS) {
                continue;
            }

            // culori の oklab コンバータを都度呼ぶとコスト高のため sRGB → OKLab を直接計算
            // 参考: https://bottosson.github.io/posts/oklab/
            const rl = linearize(r / 255);
            const gl = linearize(g / 255);
            const bl = linearize(b / 255);

            const lms_l =
                0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl;
            const lms_m =
                0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl;
            const lms_s =
                0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl;

            const l_ = Math.cbrt(lms_l);
            const m_ = Math.cbrt(lms_m);
            const s_ = Math.cbrt(lms_s);

            oklabSamples.push({
                L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
                a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
                b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
            });
        }
    }

    if (oklabSamples.length === 0) return [];

    // k はサンプル数を超えない
    const k = Math.min(count, oklabSamples.length);

    let centroids = initCentroids(oklabSamples, k);
    const assignments = new Int32Array(oklabSamples.length);

    // k-means 反復
    for (let iter = 0; iter < MAX_ITER; iter++) {
        // 割り当てステップ
        for (let i = 0; i < oklabSamples.length; i++) {
            let minDist = Infinity;
            let minIdx = 0;
            for (let c = 0; c < centroids.length; c++) {
                const d = distanceSq(oklabSamples[i], centroids[c]);
                if (d < minDist) {
                    minDist = d;
                    minIdx = c;
                }
            }
            assignments[i] = minIdx;
        }

        // 重心再計算ステップ
        const newCentroids: OklabPoint[] = centroids.map(() => ({
            L: 0,
            a: 0,
            b: 0,
        }));
        const counts = new Int32Array(centroids.length);

        for (let i = 0; i < oklabSamples.length; i++) {
            const c = assignments[i];
            newCentroids[c].L += oklabSamples[i].L;
            newCentroids[c].a += oklabSamples[i].a;
            newCentroids[c].b += oklabSamples[i].b;
            counts[c]++;
        }

        for (let c = 0; c < centroids.length; c++) {
            if (counts[c] > 0) {
                newCentroids[c].L /= counts[c];
                newCentroids[c].a /= counts[c];
                newCentroids[c].b /= counts[c];
            } else {
                // 空クラスタは旧セントロイドを維持
                newCentroids[c] = { ...centroids[c] };
            }
        }

        // 収束判定: 全重心の移動量が TOLERANCE 未満なら終了
        const maxShift = Math.max(
            ...centroids.map((c, i) =>
                Math.sqrt(distanceSq(c, newCentroids[i])),
            ),
        );
        centroids = newCentroids;
        if (maxShift < TOLERANCE) break;
    }

    // クラスタサイズを集計して面積比を計算
    const clusterCounts = new Int32Array(k);
    for (let i = 0; i < assignments.length; i++) {
        clusterCounts[assignments[i]]++;
    }

    // OKLab → hex 変換してフィルタ・ソート
    return centroids
        .map((centroid, idx) => {
            const hex = oklabToHex(centroid);
            if (!hex) return null;

            // OKLab の L は 0–1 なのでそのまま明度フィルタに使える
            if (centroid.L < MIN_LIGHTNESS || centroid.L > MAX_LIGHTNESS) {
                return null;
            }

            return {
                hex,
                count: clusterCounts[idx],
            };
        })
        .filter((item): item is { hex: string; count: number } => item !== null)
        .sort((a, b) => b.count - a.count)
        .slice(0, count)
        .map((item, i) => ({
            id: i + 1,
            x: 0,
            y: 0,
            color: item.hex,
            name: findColorName(item.hex),
            percent:
                Math.round((item.count / oklabSamples.length) * 10000) / 100,
        }));
};

/**
 * sRGB 値 (0–1) を線形化する（ガンマ除去）
 */
const linearize = (v: number): number => {
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

/**
 * OKLab 点を HEX 文字列に変換する
 */
const oklabToHex = (point: OklabPoint): string | undefined => {
    const color = parse(`oklab(${point.L} ${point.a} ${point.b})`);
    if (!color) return undefined;
    return formatHex(color) ?? undefined;
};
