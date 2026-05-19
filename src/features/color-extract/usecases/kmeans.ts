// wallust v4 の kmeans pipeline (library/wallust/src/histogram/kmeans.rs) を TS に移植する。
//
// 設計判断: kmeans コアは ml-kmeans の Lloyd's アルゴリズムを使い、wallust の Hamerly Kmeans とは
// 異なる実装になるが、収束点は数学的に同じになり、後段の min_dist dedup でばらつきを吸収できる。
// シードは ml-kmeans の `seed` オプションで固定するため、同じ入力に対して同じ重心が返る。

import { kmeans as runMlKmeans } from "ml-kmeans";

import type { KmeansConfig } from "../types/kmeans.ts";
import type { Lab } from "../types/lab.ts";
import { deltaE76 } from "./lab.ts";

export type KmeansResult = {
    /** lightness 昇順 + DeltaE min_dist で dedup 済みの重心列 */
    dominantSortedByLightness: Lab[];
    /** ml-kmeans が収束したか */
    converged: boolean;
    /** 実行された反復回数 */
    iterations: number;
};

const sortByLightness = (centroids: Lab[]): Lab[] =>
    centroids.toSorted((a, b) => a.l - b.l);

const dedupByMinDist = (sorted: Lab[], minDist: number): Lab[] => {
    const out: Lab[] = [];
    for (const c of sorted) {
        const prev = out.at(-1);
        const tooClose = prev !== undefined && deltaE76(prev, c) < minDist;
        if (!tooClose) out.push(c);
    }
    return out;
};

/**
 * Lab 画素配列に対して kmeans を 1 回だけ走らせ、lightness 昇順 + min_dist dedup 済みの
 * 重心列を返す。
 *
 * wallust の `kmeans(bytes, config)` のうち「重心算出 → ソート → dedup」までを担当する。
 * 8 個等間隔サンプル + 16 色展開は #043 (ExtractedPalette 統合) で行う。
 */
export const runKmeans = (pixels: Lab[], config: KmeansConfig): KmeansResult => {
    const data = pixels.map((p) => [p.l, p.a, p.b]);
    const result = runMlKmeans(data, config.k, {
        seed: config.seed,
        maxIterations: 100,
        tolerance: 1e-3,
        initialization: "random",
    });
    const centroids: Lab[] = result.centroids.map(([l, a, b]) => ({ l, a, b }));
    const sorted = sortByLightness(centroids);
    const deduped = dedupByMinDist(sorted, config.minDist);
    return {
        dominantSortedByLightness: deduped,
        converged: result.converged,
        iterations: result.iterations,
    };
};
