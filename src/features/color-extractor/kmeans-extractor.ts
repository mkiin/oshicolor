import { colornames } from "color-name-list";
import {
    type Color,
    differenceEuclidean,
    formatHex,
    nearest,
    parse,
} from "culori";

import type { ColorPoint } from "./types";

// ─── アルゴリズム定数 ─────────────────────────────────────────────────────────
const PIXELS = 64000;
const MAX_ITER = 30;
const TOLERANCE = 0.001;
const MIN_ALPHA = 128;
const MIN_BRIGHTNESS = 30;
const MAX_BRIGHTNESS = 245;
const MIN_LIGHTNESS = 0.08;
const MAX_LIGHTNESS = 0.96;

// ─── 彩度加重スコアリング定数 ─────────────────────────────────────────────────
// OKLab chroma のおおよその範囲:
//   0.00–0.04: 無彩色（グレー・黒・白）     → 強ペナルティ
//   0.04–0.08: 近無彩色（くすんだ色）       → 軽ペナルティ
//   0.08–0.12: 低中彩度                    → 中立
//   0.12–0.18: 中彩度（落ち着いた印象色）   → 加点
//   0.18+:     高彩度（ビビッド）            → 強加点
const CHROMA_ACHROMATIC = 0.04;
const CHROMA_LOW = 0.08;
const CHROMA_MID = 0.12;
const CHROMA_HIGH = 0.18;

// ─── 高彩度クラスタ明暗分割定数 ──────────────────────────────────────────────
// 人間は同色相の明暗ペア（例: 鮮やかな赤と深い赤）を意図的にパレットに入れる。
// K-means が1クラスタにまとめた広範囲L色相を明/暗で2色に分割して再現する。
const SPLIT_CHROMA_MIN = 0.08; // 分割対象の最小 chroma（無彩色は分割しない）
const SPLIT_L_STD_MIN = 0.07; // 分割トリガー: L 標準偏差がこれを超えたら分割
const SPLIT_MIN_PIXELS = 30; // 分割に必要な最小ピクセル数

// ─── 重複除去定数 ─────────────────────────────────────────────────────────────
// 視覚的に近すぎる色がパレットの複数席を占有するのを防ぐ。
// グレー系クラスタ（#636166 と #7b7b7c など）がまとめられ、
// その分の席が彩度の高い印象色に開放される。
const DEDUP_BASE_DISTANCE = 0.09; // OKLab ユークリッド距離の基準値
const DEDUP_ACHROMATIC_EXTRA = 0.04; // 低彩度ペアへの追加マージン
const DEDUP_CHROMA_REF = 0.15; // この chroma 以上で追加マージン = 0

// ─── 乱数生成定数 ────────────────────────────────────────────────────────────
// シード固定により同一画像で常に同じ結果を返す
const DEFAULT_SEED = 42;

// ─── 内部型定義 ──────────────────────────────────────────────────────────────
type OklabPoint = { L: number; a: number; b: number };

type Candidate = {
    centroid: OklabPoint;
    count: number;
    chroma: number;
    hex: string;
    /** 明暗分割前の元クラスタの合計ピクセル数（分割されていなければ count と同値） */
    parentCount: number;
};

// ─── color-name-list の lazy 初期化 ──────────────────────────────────────────
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

// ─── 疑似乱数生成器 ───────────────────────────────────────────────────────────

/**
 * mulberry32 疑似乱数生成器
 *
 * Math.random() はシードを外部制御できないため、同一画像で毎回異なる
 * クラスタ初期化が発生し結果が変わってしまう。mulberry32 は軽量かつ
 * 統計的に良質な PRNG で、シード固定による再現性を実現する。
 *
 * @param seed - シード値
 * @returns [0, 1) の範囲の乱数を返す関数
 */
const mulberry32 = (seed: number): (() => number) => {
    let s = seed;
    return () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

// ─── 数値ヘルパー ────────────────────────────────────────────────────────────

/** OKLab ユークリッド距離の二乗 */
const distanceSq = (a: OklabPoint, b: OklabPoint): number => {
    return (a.L - b.L) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2;
};

/** OKLab 点群の算術平均（重心） */
const averageOklab = (pixels: OklabPoint[]): OklabPoint => {
    let sumL = 0;
    let sumA = 0;
    let sumB = 0;
    for (const p of pixels) {
        sumL += p.L;
        sumA += p.a;
        sumB += p.b;
    }
    return {
        L: sumL / pixels.length,
        a: sumA / pixels.length,
        b: sumB / pixels.length,
    };
};

/** 点群の L 成分の標準偏差 */
const lStdDev = (pixels: OklabPoint[]): number => {
    const mean = pixels.reduce((s, p) => s + p.L, 0) / pixels.length;
    const variance =
        pixels.reduce((s, p) => s + (p.L - mean) ** 2, 0) / pixels.length;
    return Math.sqrt(Math.max(0, variance));
};

/** 点群の L 成分の中央値 */
const medianL = (pixels: OklabPoint[]): number => {
    const sorted = pixels.map((p) => p.L).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
};

/** OKLab 点の chroma（彩度） */
const chromaOf = (p: OklabPoint): number => {
    return Math.sqrt(p.a ** 2 + p.b ** 2);
};

// ─── スコアリング ────────────────────────────────────────────────────────────

/**
 * OKLab chroma から面積スコアへの加重係数を返す
 *
 * ダーク系キャラクターでは画像の80%以上が低彩度（グレー・黒）だが、
 * 人間はそれらを選ばず高彩度の印象色を優先する。
 * この補正により、面積が小さくても彩度が高い色をパレット上位に昇格させる。
 *
 * スコア = count × (1 + boost) なので面積ゼロの色が昇格することはない。
 */
const saturationBoost = (chroma: number): number => {
    if (chroma < CHROMA_ACHROMATIC) return -0.7; // ×0.3: 無彩色を強く抑制
    if (chroma < CHROMA_LOW) return -0.3; // ×0.7: くすみ色を軽く抑制
    if (chroma < CHROMA_MID) return 0.0; // ×1.0: 中立
    if (chroma < CHROMA_HIGH) return 0.8; // ×1.8: 中彩度を加点
    return 1.5; // ×2.5: 高彩度を強く加点
};

/**
 * 候補のスコアを計算する
 *
 * 明暗分割された候補は parentCount（元クラスタの合計ピクセル数）を
 * 面積の代わりに使う。これにより分割によるスコア低下を防ぎ、
 * 分割前と同等の面積的な重みを維持する。
 *
 * 例: 赤クラスタ(978px)を明(490px)/暗(488px)に分割した場合
 *   分割前: 978 × 2.5 = 2445
 *   改善前: 490 × 2.5 = 1225 ← 半減してグレーに負ける可能性
 *   改善後: 978 × 2.5 = 2445 ← 元クラスタの面積で計算、順位を維持
 */
const candidateScore = (c: Candidate): number => {
    return c.parentCount * (1 + saturationBoost(c.chroma));
};

// ─── 重複除去 ────────────────────────────────────────────────────────────────

/**
 * 2つの候補間の適応的な重複判定距離を返す
 *
 * 低彩度のペア（グレー同士など）は OKLab 距離が近くても知覚差が小さいため
 * より広い閾値で集約する。高彩度のペアは色相が異なれば小さな距離でも
 * 知覚差が大きいため閾値を狭くする。
 *
 * ```
 * 両方 chroma >= 0.15 → 閾値 = 0.09（基準値のみ）
 * 両方 chroma ≈ 0     → 閾値 = 0.09 + 0.04 = 0.13（グレーを積極集約）
 * 片方だけ高彩度     → 中間値
 * ```
 */
const dedupThreshold = (a: Candidate, b: Candidate): number => {
    const minChroma = Math.min(a.chroma, b.chroma);
    // chroma が DEDUP_CHROMA_REF 以上なら追加マージン = 0
    // chroma が 0 に近いほど追加マージンが最大（DEDUP_ACHROMATIC_EXTRA）
    const t = Math.min(1, minChroma / DEDUP_CHROMA_REF);
    return DEDUP_BASE_DISTANCE + DEDUP_ACHROMATIC_EXTRA * (1 - t);
};

// ─── k-means 初期化 ──────────────────────────────────────────────────────────

/**
 * k-means++ 初期化: d² 重み付き確率でセントロイドを k 個選ぶ
 *
 * @param samples - クラスタリング対象の OKLab 点群
 * @param k - クラスタ数
 * @param rng - 疑似乱数生成器（mulberry32 などシード固定済みのもの）
 */
const initCentroids = (
    samples: OklabPoint[],
    k: number,
    rng: () => number,
): OklabPoint[] => {
    const centroids: OklabPoint[] = [];

    const firstIdx = Math.floor(rng() * samples.length);
    centroids.push({ ...samples[firstIdx] });

    for (let c = 1; c < k; c++) {
        const weights = samples.map((s) =>
            Math.min(...centroids.map((centroid) => distanceSq(s, centroid))),
        );

        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        let rand = rng() * totalWeight;
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

// ─── 色空間変換 ──────────────────────────────────────────────────────────────

/** sRGB 値 (0–1) を線形化する（ガンマ除去） */
const linearize = (v: number): number => {
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

/** OKLab 点を HEX 文字列に変換する */
const oklabToHex = (point: OklabPoint): string | undefined => {
    const color = parse(`oklab(${point.L} ${point.a} ${point.b})`);
    if (!color) return undefined;
    return formatHex(color) ?? undefined;
};

// ─── 後処理ヘルパー ───────────────────────────────────────────────────────────

/**
 * クラスタの候補を candidates リストに追加する。
 *
 * 高彩度クラスタの L 分散が SPLIT_L_STD_MIN を超える場合、
 * 中央値で明/暗の2グループに分割して別々の候補として追加する。
 * これにより「明るい赤・暗い赤」のような明暗ペアが自動的に生成される。
 *
 * 分割された各サブクラスタは parentCount に元クラスタの合計ピクセル数を持つ。
 * スコア計算時にこの値を使うことで、分割によるスコア低下を防ぐ。
 */
const addClusterCandidates = (
    candidates: Candidate[],
    centroid: OklabPoint,
    pixels: OklabPoint[],
) => {
    const chroma = chromaOf(centroid);
    const totalCount = pixels.length;

    // サブクラスタを candidates に追加するヘルパー
    const pushCandidate = (pts: OklabPoint[], parent: number) => {
        if (pts.length === 0) return;
        const avg = averageOklab(pts);
        if (avg.L < MIN_LIGHTNESS || avg.L > MAX_LIGHTNESS) return;
        const hex = oklabToHex(avg);
        if (!hex) return;
        const c = chromaOf(avg);
        candidates.push({
            centroid: avg,
            count: pts.length,
            chroma: c,
            hex,
            parentCount: parent,
        });
    };

    // 高彩度 + 十分なピクセル数 + L 分散が大きい → 明暗2分割
    if (
        chroma >= SPLIT_CHROMA_MIN &&
        pixels.length >= SPLIT_MIN_PIXELS &&
        lStdDev(pixels) >= SPLIT_L_STD_MIN
    ) {
        const median = medianL(pixels);
        pushCandidate(
            pixels.filter((p) => p.L >= median),
            totalCount,
        );
        pushCandidate(
            pixels.filter((p) => p.L < median),
            totalCount,
        );
        return;
    }

    // 通常: クラスタ重心をそのまま追加
    if (centroid.L < MIN_LIGHTNESS || centroid.L > MAX_LIGHTNESS) return;
    const hex = oklabToHex(centroid);
    if (!hex) return;
    candidates.push({
        centroid,
        count: pixels.length,
        chroma,
        hex,
        parentCount: totalCount,
    });
};

// ─── 公開 API ────────────────────────────────────────────────────────────────

/**
 * 画像データから k-means++ でドミナントカラーを抽出する
 *
 * ## アルゴリズム概要
 *
 * 1. **サンプリング** — ImageData を間引き、sRGB → OKLab 変換
 * 2. **k-means++** — OKLab 空間でクラスタリング（最大 MAX_ITER 回）
 * 3. **明暗分割** — 高彩度クラスタの L 分散が大きい場合、明/暗の2色に分割
 *    （同色相の明暗ペアをカラースキーマの syntax 色として使いやすくする）
 * 4. **彩度加重スコアリング** — 分割前の面積(parentCount) × 彩度ブーストでソート
 *    （グレーを強く抑制し、キャラの印象色を上位に昇格。分割でスコアが半減しない）
 * 5. **適応的重複除去** — 低彩度ペアはより広い閾値で集約し、
 *    高彩度ペアは色相差を尊重して狭い閾値で保持
 *
 * @param imageData - Canvas から取得した ImageData
 * @param imageWidth - 画像の幅（サンプリングステップ計算に使用）
 * @param imageHeight - 画像の高さ（サンプリングステップ計算に使用）
 * @param count - 抽出する色の数（デフォルト: 12）
 * @param seed - PRNG のシード値。同じ画像 + 同じシードで常に同じ結果を返す（デフォルト: DEFAULT_SEED）
 * @returns 抽出された ColorPoint の配列（彩度加重スコア降順）
 */
export const extractColorsKmeans = (
    imageData: ImageData,
    imageWidth: number,
    imageHeight: number,
    count = 12,
    seed = DEFAULT_SEED,
): ColorPoint[] => {
    const totalPixels = imageWidth * imageHeight;
    const step = Math.max(1, Math.round(Math.sqrt(totalPixels / PIXELS)));

    // ── Step 1: サンプリング & OKLab 変換 ────────────────────────────────
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

            // sRGB → OKLab を直接計算（culori の変換を都度呼ぶよりも高速）
            // 参考: https://bottosson.github.io/posts/oklab/
            const rl = linearize(r / 255);
            const gl = linearize(g / 255);
            const bl = linearize(b / 255);

            const lmsL =
                0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl;
            const lmsM =
                0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl;
            const lmsS =
                0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl;

            const lp = Math.cbrt(lmsL);
            const mp = Math.cbrt(lmsM);
            const sp = Math.cbrt(lmsS);

            oklabSamples.push({
                L: 0.2104542553 * lp + 0.793617785 * mp - 0.0040720468 * sp,
                a: 1.9779984951 * lp - 2.428592205 * mp + 0.4505937099 * sp,
                b: 0.0259040371 * lp + 0.7827717662 * mp - 0.808675766 * sp,
            });
        }
    }

    if (oklabSamples.length === 0) return [];

    // ── Step 2: k-means++ クラスタリング ─────────────────────────────────
    const k = Math.min(count, oklabSamples.length);
    const rng = mulberry32(seed);
    let centroids = initCentroids(oklabSamples, k, rng);
    const assignments = new Int32Array(oklabSamples.length);

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

        // 重心の正規化（先に全クラスタを確定させてから空クラスタ処理する）
        for (let c = 0; c < centroids.length; c++) {
            if (counts[c] > 0) {
                newCentroids[c].L /= counts[c];
                newCentroids[c].a /= counts[c];
                newCentroids[c].b /= counts[c];
            }
        }

        // 空クラスタの再初期化
        // 最大クラスタを「重心から最も遠いサンプル」で分割することで
        // 常に k 個のクラスタを維持し、抽出色数の不足を防ぐ
        for (let c = 0; c < centroids.length; c++) {
            if (counts[c] > 0) continue;

            // 最大クラスタを探す
            let maxCount = 0;
            let maxCluster = 0;
            for (let j = 0; j < counts.length; j++) {
                if (counts[j] > maxCount) {
                    maxCount = counts[j];
                    maxCluster = j;
                }
            }

            // 最大クラスタの重心から最も遠いサンプルを新セントロイドに設定
            let maxDist = -1;
            let farthest = oklabSamples[0];
            for (let i = 0; i < oklabSamples.length; i++) {
                if (assignments[i] !== maxCluster) continue;
                const d = distanceSq(oklabSamples[i], newCentroids[maxCluster]);
                if (d > maxDist) {
                    maxDist = d;
                    farthest = oklabSamples[i];
                }
            }
            newCentroids[c] = { ...farthest };
        }

        // 収束判定
        const maxShift = Math.max(
            ...centroids.map((c, i) =>
                Math.sqrt(distanceSq(c, newCentroids[i])),
            ),
        );
        centroids = newCentroids;
        if (maxShift < TOLERANCE) break;
    }

    // ── Step 3: クラスタ別ピクセルグループ化 ─────────────────────────────
    const clusterPixels: OklabPoint[][] = Array.from({ length: k }, () => []);
    for (let i = 0; i < oklabSamples.length; i++) {
        clusterPixels[assignments[i]].push(oklabSamples[i]);
    }

    // ── Step 4: 候補リスト構築（高彩度クラスタは明暗分割） ──────────────
    const candidates: Candidate[] = [];
    for (let idx = 0; idx < centroids.length; idx++) {
        if (clusterPixels[idx].length === 0) continue;
        addClusterCandidates(candidates, centroids[idx], clusterPixels[idx]);
    }

    // ── Step 5: 彩度加重スコアでソート ───────────────────────────────────
    candidates.sort((a, b) => candidateScore(b) - candidateScore(a));

    // ── Step 6: 適応的重複除去 ───────────────────────────────────────────
    // 高彩度ペアは閾値が狭く色相差を保存、低彩度ペアは閾値が広くグレーを集約。
    const selected: Candidate[] = [];
    for (const item of candidates) {
        const tooClose = selected.some(
            (s) =>
                Math.sqrt(distanceSq(item.centroid, s.centroid)) <
                dedupThreshold(item, s),
        );
        if (!tooClose) {
            selected.push(item);
        }
        if (selected.length >= count) break;
    }

    // ── Step 7: ColorPoint 形式に変換 ────────────────────────────────────
    return selected.map((item, i) => ({
        id: i + 1,
        x: 0,
        y: 0,
        color: item.hex,
        name: findColorName(item.hex),
        percent: Math.round((item.count / oklabSamples.length) * 10000) / 100,
    }));
};
