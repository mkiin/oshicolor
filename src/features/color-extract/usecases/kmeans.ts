import { kmeans as runMlKmeans } from "ml-kmeans";

import type { KmeansConfig } from "../types/kmeans.ts";
import type { Lab } from "../types/lab.ts";
import { deltaE76 } from "./lab.ts";

export type KmeansResult = {
    dominantSortedByLightness: Lab[];
    converged: boolean;
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

export const sampleEvenly = (dominant: Lab[]): Lab[] => {
    const n = Math.max(dominant.length, 1);
    return Array.from({ length: 8 }, (_, i) => {
        const idx = n === 1 ? 0 : Math.floor((i * (n - 1)) / 7);
        return dominant[idx];
    });
};

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
