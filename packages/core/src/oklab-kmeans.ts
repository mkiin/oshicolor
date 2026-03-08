import { Swatch } from "@oshicolor/color";
import type { Vec3 } from "@oshicolor/color";
import type { Pixels } from "@oshicolor/image";
// oklab をインポートすることで culori に oklab モードを登録する
// biome-ignore lint/correctness/noUnusedImports: サイドエフェクトとして oklab モードを登録するため必要
import { converter, oklab as _oklabMode } from "culori";
import type { QuantizerOptions } from "./types";

// ── 定数 ────────────────────────────────────────────────────────────────────

/** L 軸圧縮係数（okolors デフォルト値） */
const LIGHTNESS_WEIGHT = 0.325;
/** k-means 最大反復回数 */
const MAX_ITERATIONS = 16;
/** 収束判定：全重心移動距離の合計のしきい値 */
const CONVERGENCE_THRESHOLD = 0.001;

// ── culori コンバータ（トップレベルで一度だけ生成） ────────────────────────

const toOklab = converter("oklab");
const toRgb = converter("rgb");

// ── 内部型 ──────────────────────────────────────────────────────────────────

type OklabKmeansOptions = {
    colorCount: number;
    lightnessWeight?: number;
    maxIterations?: number;
    convergenceThreshold?: number;
};

type OklabPoint = { l: number; a: number; b: number; weight: number };
type Cluster = { l: number; a: number; b: number };

// ── 内部関数 ─────────────────────────────────────────────────────────────────

/**
 * RGBA ピクセルバッファを OklabPoint 配列に変換する。
 * - alpha < 125 のピクセルはスキップ
 * - 半透明（125〜254）は weight を alpha / 255 で減衰
 * - 同一 Oklab 座標は weight に加算してデデュープ
 */
const pixelsToOklabPoints = (
    pixels: Pixels,
    lightnessWeight: number,
): OklabPoint[] => {
    const map = new Map<string, OklabPoint>();

    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];

        if (a < 125) continue;

        const oklabColor = toOklab({ mode: "rgb", r: r / 255, g: g / 255, b: b / 255 });
        if (!oklabColor) continue;

        const l = (oklabColor.l ?? 0) * lightnessWeight;
        const oa = oklabColor.a ?? 0;
        const ob = oklabColor.b ?? 0;

        const key = `${l.toFixed(4)},${oa.toFixed(4)},${ob.toFixed(4)}`;
        const w = a < 255 ? a / 255 : 1;

        const existing = map.get(key);
        if (existing) {
            existing.weight += w;
        } else {
            map.set(key, { l, a: oa, b: ob, weight: w });
        }
    }

    return Array.from(map.values());
};

/** Oklab 空間でのユークリッド距離二乗 */
const squaredDistance = (p: OklabPoint, c: Cluster): number => {
    const dl = p.l - c.l;
    const da = p.a - c.a;
    const db = p.b - c.b;
    return dl * dl + da * da + db * db;
};

/**
 * k-means++ で初期重心を選択する。
 * 距離二乗に比例した確率でサンプリングすることで、重心が分散しやすくなる。
 */
const initKmeansPlusPlus = (points: OklabPoint[], k: number): Cluster[] => {
    if (points.length === 0) return [];

    const centers: Cluster[] = [];

    // 最初の重心はランダムに選択
    const first = points[Math.floor(Math.random() * points.length)];
    centers.push({ l: first.l, a: first.a, b: first.b });

    for (let ci = 1; ci < k; ci++) {
        // 各点から最近傍重心への距離二乗を計算
        const dists = points.map((p) => {
            let minDist = Number.POSITIVE_INFINITY;
            for (const c of centers) {
                const d = squaredDistance(p, c);
                if (d < minDist) minDist = d;
            }
            return minDist * p.weight;
        });

        // 距離二乗の合計でルーレット選択
        const total = dists.reduce((s, d) => s + d, 0);
        let rand = Math.random() * total;
        let chosen = points[points.length - 1];
        for (let i = 0; i < points.length; i++) {
            rand -= dists[i];
            if (rand <= 0) {
                chosen = points[i];
                break;
            }
        }
        centers.push({ l: chosen.l, a: chosen.a, b: chosen.b });
    }

    return centers;
};

/** 各点を最近傍クラスタに割り当てる */
const assignClusters = (points: OklabPoint[], centers: Cluster[]): Int32Array => {
    const assignments = new Int32Array(points.length);
    for (let i = 0; i < points.length; i++) {
        let minDist = Number.POSITIVE_INFINITY;
        let minIdx = 0;
        for (let j = 0; j < centers.length; j++) {
            const d = squaredDistance(points[i], centers[j]);
            if (d < minDist) {
                minDist = d;
                minIdx = j;
            }
        }
        assignments[i] = minIdx;
    }
    return assignments;
};

/**
 * 重み付き平均で重心を更新する。
 * 空クラスタは prevCenters の値を維持する。
 */
const updateCenters = (
    points: OklabPoint[],
    assignments: Int32Array,
    prevCenters: Cluster[],
): Cluster[] => {
    const k = prevCenters.length;
    const sumL = new Float64Array(k);
    const sumA = new Float64Array(k);
    const sumB = new Float64Array(k);
    const totalWeight = new Float64Array(k);

    for (let i = 0; i < points.length; i++) {
        const ci = assignments[i];
        const w = points[i].weight;
        sumL[ci] += points[i].l * w;
        sumA[ci] += points[i].a * w;
        sumB[ci] += points[i].b * w;
        totalWeight[ci] += w;
    }

    return prevCenters.map((prev, j) => {
        if (totalWeight[j] === 0) return { ...prev };
        return {
            l: sumL[j] / totalWeight[j],
            a: sumA[j] / totalWeight[j],
            b: sumB[j] / totalWeight[j],
        };
    });
};

/**
 * 収束まで assign → update を反復する。
 */
const runKmeans = (
    points: OklabPoint[],
    initialCenters: Cluster[],
    maxIter: number,
    threshold: number,
): { centers: Cluster[]; populations: Float64Array } => {
    let centers = initialCenters;
    let assignments = new Int32Array(points.length);

    for (let iter = 0; iter < maxIter; iter++) {
        const newAssignments = assignClusters(points, centers);
        const newCenters = updateCenters(points, newAssignments, centers);

        // 全重心の移動距離を合計して収束判定
        let totalShift = 0;
        for (let j = 0; j < centers.length; j++) {
            const dl = newCenters[j].l - centers[j].l;
            const da = newCenters[j].a - centers[j].a;
            const db = newCenters[j].b - centers[j].b;
            totalShift += Math.sqrt(dl * dl + da * da + db * db);
        }

        assignments = newAssignments;
        centers = newCenters;

        if (totalShift < threshold) break;
    }

    // クラスタごとの重み合計を population として計算
    const populations = new Float64Array(centers.length);
    for (let i = 0; i < points.length; i++) {
        populations[assignments[i]] += points[i].weight;
    }

    return { centers, populations };
};

/**
 * クラスタ重心を Swatch に変換する。
 * L 軸を lightnessWeight で復元してから Oklab → RGB に変換する。
 */
const clusterToSwatch = (
    center: Cluster,
    population: number,
    lightnessWeight: number,
): Swatch => {
    const restoredL = lightnessWeight > 0 ? center.l / lightnessWeight : center.l;
    const rgbColor = toRgb({ mode: "oklab", l: restoredL, a: center.a, b: center.b });

    const r = Math.round(Math.max(0, Math.min(1, rgbColor?.r ?? 0)) * 255);
    const g = Math.round(Math.max(0, Math.min(1, rgbColor?.g ?? 0)) * 255);
    const b = Math.round(Math.max(0, Math.min(1, rgbColor?.b ?? 0)) * 255);

    return new Swatch([r, g, b] as Vec3, Math.round(population));
};

// ── エクスポート ──────────────────────────────────────────────────────────────

/**
 * Oklab 色空間で k-means クラスタリングを行うQuantizer。
 *
 * Rust 製の okolors アルゴリズムを TypeScript で再実装。
 * RGB 空間の MMCQ と比べて知覚的均等性があり、
 * 色相多様性が高いキャラクターイラストでより正確な代表色抽出が期待できる。
 *
 * `opts` の `options` フィールド経由で拡張パラメータを渡せる:
 * - `lightnessWeight` (デフォルト: 0.325): L 軸圧縮係数
 * - `maxIterations` (デフォルト: 16): k-means 最大反復回数
 * - `convergenceThreshold` (デフォルト: 0.001): 収束判定しきい値
 *
 * @param pixels - RGBA 順の Uint8ClampedArray
 * @param opts - 量子化オプション（QuantizerOptions + 拡張パラメータ）
 * @returns 代表色の Swatch 配列
 */
export const OklabKmeans = (pixels: Pixels, opts: QuantizerOptions): Swatch[] => {
    const { colorCount } = opts;
    const extOpts = opts as OklabKmeansOptions;
    const lightnessWeight = extOpts.lightnessWeight ?? LIGHTNESS_WEIGHT;
    const maxIterations = extOpts.maxIterations ?? MAX_ITERATIONS;
    const convergenceThreshold = extOpts.convergenceThreshold ?? CONVERGENCE_THRESHOLD;

    const points = pixelsToOklabPoints(pixels, lightnessWeight);
    if (points.length === 0) return [];

    const k = Math.min(colorCount, points.length);
    const initialCenters = initKmeansPlusPlus(points, k);
    const { centers, populations } = runKmeans(
        points,
        initialCenters,
        maxIterations,
        convergenceThreshold,
    );

    return centers
        .map((center, i) => ({ swatch: clusterToSwatch(center, populations[i], lightnessWeight), pop: populations[i] }))
        .filter(({ pop }) => pop > 0)
        .map(({ swatch }) => swatch);
};
