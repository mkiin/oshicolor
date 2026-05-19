// wallust v4 の kmeans pipeline 設定値。
// wallust 側の `KmeansConfig` (library/wallust/src/config.rs:127) に対応する。

export type KmeansConfig = {
    /** クラスタ数。wallust default = 16 */
    k: number;
    /**
     * 重心統合の最小知覚距離 (CIEDE76 / Lab Euclidean 上の DeltaE)。
     * これ未満の距離にある重心は直前のものと統合する。wallust default = 10.0
     */
    minDist: number;
    /**
     * PRNG シード。同じ入力に対して同じ重心を返すための決定性確保用。
     * wallust は `fastrand::seed(0xBEEF)` を使う。
     */
    seed: number;
};

export const DEFAULT_KMEANS_CONFIG: KmeansConfig = {
    k: 16,
    minDist: 10.0,
    seed: 0xbeef,
} as const;
