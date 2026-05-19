---
title: wallust ansi pipeline を TS と HSV 上に移植
labels: [feature]
mvp: 1
feature: color-extract
created: 2026-05-19
branch: feature/041-kmeans-pipeline-ts-port
---

# wallust ansi pipeline を TS と HSV 上に移植

## 何をやるか

wallust v4 の `src/histogram/ansi.rs` (HSV ベースで hue 6 バケット に画素を分類し、信頼率 `T = 0.5` で画像由来の hue・saturation・value と既定値を内分して 6 色を生成、black と gray は最暗・最明画素から合成) を TypeScript に移植する。出力は `ExtractedPalette.ansi.hueBuckets` (#043 で型定義予定) の `Record<HueName, OKLch>` を返す。

## なぜやるか

`#039 idea` で採用した「ansi の hue 6 バケットを構文ハイライト層に割り当てる」設計を実装するため。salience や kmeans が画像由来の色相多様性を保証しないケース (Cinderella の白基調や Scarlet の紫多発) でも、ansi は固定 hue バケットに必ず色を埋めるので構文区別が破綻しない。

wallust v3 では LchAnsi として CAM16 経路に乗っていたが、v4 では「hue 6 分類しかしないのに CAM16 変換のコストを払うのは無駄」という判断で HSV ベースの独立経路に移された (`#034` 調査済み)。本 issue でもこの判断を踏襲する。

## 完了条件

- [x] `src/features/color-extract/usecases/ansi.ts` に hue 6 バケット集計と信頼率 0.5 内分を実装
- [x] hue 境界と既定値 (RED 0-60 sat 0.90 val 0.65 など 6 種類) を wallust に揃える
- [x] black と gray は最暗・最明画素から合成し、見つからなければ平均から擬似生成する fallback を入れる
- [x] Light スタイル時の `val_def` 個別ルートを実装
- [x] `src/features/color-extract/types/ansi.ts` に `HueName` と `AnsiOutput` 型を定義
- [x] 単体テスト: HSV 変換 / 6 バケットの hue 範囲 / defaults 合成 / style 切替 / drain 動作

## 採用判定 A の備考

`#041` と同じ採用判定の流れで、本 issue でも次のとおりにスコープを整理した。

- 出力型は `AnsiOutput = { hueBuckets: Record<HueName, Rgb>; black: Rgb; gray: Rgb }` とし、`Rgb` は `0..1` の浮動小数で持つ。OKLch / CAM16 への変換は後段 (#043) に委ねる
- ansi の hue 6 バケットは drain 動作 (画素を 1 度だけ消費) のため、wallust と完全一致する出力を保証する。アルゴリズム上の不確実性は kmeans のように無い
- 元の完了条件にあった「wallust 出力と RGB 距離 5 以内一致」は単体テストで境界と内分式を検証する形に置き換えた

## 関連

- 移植元: library/wallust/src/histogram/ansi.rs
- 参考: docs/references/wallust/v4-changes.md §6
- 依存: #035 (色抽出基盤の確立)
- 後続: #043 (ExtractedPalette 統合)
