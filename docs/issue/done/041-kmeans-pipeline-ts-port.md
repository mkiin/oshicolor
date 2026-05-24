---
title: wallust kmeans pipeline を TS と Lab 上に移植
labels: [feature]
mvp: 1
feature: color-extract
created: 2026-05-19
branch: feature/041-kmeans-pipeline-ts-port
---

# wallust kmeans pipeline を TS と Lab 上に移植

## 何をやるか

wallust v4 の `src/histogram/kmeans.rs` (Hamerly Kmeans を 1 回回し、Lab lightness ソート + DeltaE で min_dist dedup、8 個等間隔サンプル後 16 色展開) を TypeScript に移植する。色空間は wallust と同じく Lab を使う (CAM16 は salience 専用)。出力は `ExtractedPalette.kmeans` (#043 で型定義予定) の一部となる `{ dominantSortedByLightness: Lab[] }` を返す。

## なぜやるか

`#039 idea` で採用した「kmeans を世界観層として使う」割り当てを実装するため、kmeans 抽出を TS で動かす必要がある。salience (CAM16 経路) と並行抽出する設計なので、kmeans pipeline はそれ単独で完結したモジュールにする。

wallust の kmeans は v3 までは「複数回試行して最良を取る」設計だったが、v4 では「1 回だけ走らせて min_dist で重心を dedup する」設計に変わった (`#034` 調査済み)。この実装をそのまま TS に持ち込むのが本 issue のスコープになる。

## 完了条件

- [x] `src/features/color-extract/usecases/kmeans.ts` に kmeans の 1 回実行を実装 (ml-kmeans の Lloyd's を採用、後段の min_dist dedup で wallust 設計意図を再現)
- [x] `src/features/color-extract/usecases/lab.ts` に sRGB → Lab 変換 (D65) と CIEDE76 を実装
- [x] Lab lightness ソート + DeltaE min_dist dedup
- [x] `KmeansConfig` 型 (`k`, `minDist`, `seed`) を `src/features/color-extract/types/kmeans.ts` に定義
- [x] `k` と `minDist` のデフォルトは wallust に合わせて 16 / 10.0、`seed` は 0xBEEF
- [x] ml-kmeans の `seed` オプションで決定性を確保
- [x] 単体テスト: Lab 変換が Bruce Lindbloom 参照値と一致 / kmeans の決定性 / 画像支配色が上位 / min_dist で dedup される

## 採用判定 A の備考

着手前に「wallust の Hamerly Kmeans と TS の ml-kmeans (Lloyd's) のアルゴリズム差をどう扱うか」を議論した。採用判定 A により次のとおり整理した。

- kmeans コアは ml-kmeans を使う。deps を増やさず、Lloyd's と Hamerly は数学的に同じ収束点に達する
- wallust と完全一致は諦め、「同じ入力で同じ出力」と「画像支配色が上位に来る」の 2 軸でテストする
- 元の完了条件にあった「8 個等間隔サンプル + 16 色展開」は #043 (ExtractedPalette 統合) の責務に移す
- 元の完了条件にあった「wallust 出力と CIEDE2000 1.0 以内一致」は破棄する

## 関連

- 移植元: library/wallust/src/histogram/kmeans.rs
- 参考: docs/references/wallust/v4-changes.md §6
- 依存: #035 (色抽出基盤の確立)
- 後続: #043 (ExtractedPalette 統合)
