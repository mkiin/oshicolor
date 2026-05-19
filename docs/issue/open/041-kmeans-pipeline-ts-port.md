---
title: wallust kmeans pipeline を TS と Lab 上に移植
labels: [feature]
mvp: 1
feature: color-extract
created: 2026-05-19
branch:
---

# wallust kmeans pipeline を TS と Lab 上に移植

## 何をやるか

wallust v4 の `src/histogram/kmeans.rs` (Hamerly Kmeans を 1 回回し、Lab lightness ソート + DeltaE で min_dist dedup、8 個等間隔サンプル後 16 色展開) を TypeScript に移植する。色空間は wallust と同じく Lab を使う (CAM16 は salience 専用)。出力は `ExtractedPalette.kmeans` (#043 で型定義予定) の一部となる `{ dominantSortedByLightness: Lab[] }` を返す。

## なぜやるか

`#039 idea` で採用した「kmeans を世界観層として使う」割り当てを実装するため、kmeans 抽出を TS で動かす必要がある。salience (CAM16 経路) と並行抽出する設計なので、kmeans pipeline はそれ単独で完結したモジュールにする。

wallust の kmeans は v3 までは「複数回試行して最良を取る」設計だったが、v4 では「1 回だけ走らせて min_dist で重心を dedup する」設計に変わった (`#034` 調査済み)。この実装をそのまま TS に持ち込むのが本 issue のスコープになる。

## 完了条件

- [ ] `src/features/color-extract/usecases/kmeans.ts` に Hamerly kmeans の 1 回実行を実装
- [ ] `src/features/color-extract/usecases/lab.ts` に sRGB → Lab 変換 (D65)
- [ ] Lab lightness ソート + DeltaE min_dist dedup + 8 個等間隔サンプル + 16 色展開
- [ ] `KmeansConfig` 型 (`k`, `min_dist`) を `src/features/color-extract/types/kmeans.ts` に定義
- [ ] `k` と `min_dist` のデフォルトは wallust に合わせて 16 / 10.0
- [ ] シード固定 (`fastrand` 相当の TS 実装) で再現性確保
- [ ] 参照画像 3 枚で wallust の kmeans 出力と CIEDE2000 で 1.0 以内に一致する golden test

## 関連

- 移植元: library/wallust/src/histogram/kmeans.rs
- 参考: docs/references/wallust/v4-changes.md §6
- 依存: #035 (色抽出基盤の確立)
- 後続: #043 (ExtractedPalette 統合)
