export type KmeansConfig = {
    k: number;
    minDist: number;
    seed: number;
};

export const DEFAULT_KMEANS_CONFIG: KmeansConfig = {
    k: 16,
    minDist: 10.0,
    seed: 0xbeef,
} as const;
