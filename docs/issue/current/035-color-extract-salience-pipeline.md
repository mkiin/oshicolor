---
title: color-extract feature - wallust v4 Salience pipeline を CAM16-UCS Jmh 上に移植
labels: [feature]
mvp: 1
feature: color-extract
created: 2026-05-18
last-updated: 2026-05-19
branch: feature/035-color-extract-salience-pipeline
---

# color-extract feature - wallust v4 Salience pipeline を CAM16-UCS Jmh 上に移植

## 何をやるか

新規 feature `color-extract` を立ち上げ、wallust v4 の Salience pipeline (threshold histogram + auto_threshold + salience scoring + 16 色割り当て) を TypeScript と CAM16-UCS Jmh 上に移植する。`extractColors(image, style)` を公開 API として、wallust の `Colors` 構造体相当の 16 色パレットを返す。

## なぜやるか

oshicolor の最初の処理層として「画像から代表色 16 色を取り出す」処理が要る。自前で設計するより wallust v4 の成熟したアルゴリズムを踏襲する方が、設計判断のリスクを抑えながら確実に動くものを得られる。色空間に CAM16-UCS Jmh を選ぶ理由は、dark テーマと light テーマで観察条件 (`L_A` / `Y_b` / surround) を切り替えて別の `BakedParameters` を焼くという wallust の中核機能を再現するためで、これは OKLch では取れない挙動になる。

色空間の選定は PoC (#040) で採用判定済みになる。CAM16-UCS Jmh の TS 実装は palette クレートの参照値と 1e-3 以内で一致し、Web Worker 並列化により 1024² で OKLch の 2.29 倍速く動くことを実測で確認した。詳細は `docs/references/cam16/ts-port-feasibility.md` に残してある。

Phase 2 で oshicolor 固有の semantic ロール層を上に乗せる前提の中間出力にあたる。

## 完了条件

- [ ] `src/features/color-extract/usecases/` に gather, autoThreshold, dedup, postDedup, saliencePalette, image を実装
- [ ] `src/features/color-extract/types/` に Histo, Colors の型定義 (CAM16-UCS Jmh ベース、cam16 型は #040 で作成済み)
- [ ] `gather` と `auto_threshold` が Web Worker pool で並列実行される
- [ ] 画像サイズに応じた並列化の自動切替が動く (256k 画素以下は同期、それ以上は並列)
- [ ] `src/features/color-extract/index.ts` から `extractColors(image, style): Promise<Colors>` を公開
- [ ] 各 usecase の単体テスト (Vitest)
- [ ] 参照画像 3 枚 (アニメ風 / 写真 / ロゴ調) で golden test が通る
- [ ] `docs/features/color-extract/spec.md` と整合

## 実装方針

### 設計アプローチ

wallust v4 (Rust) の `src/histogram/` 配下と `src/lib.rs::gen_colors` の `Palette::Salience` 分岐を TS に移植する。色空間は CAM16-UCS Jmh とし、距離と salience の計算は wallust と同じ重み構造を使う。正規化定数は `[J_MAX, M_MAX, H_MAX] = [100, 40, 180]` で wallust と同じ値にする。

CAM16-UCS Jmh 変換と Web Worker 並列化の基盤は PoC (#040) で実装済みで、本 issue ではその上に gather / auto_threshold / dedup / postDedup / saliencePalette を載せる形になる。Web Worker pool は `convertPixelsParallel` で使った構造を再利用し、画素変換と auto_threshold 探索の両方で同じ pool を使い回す。

dark と light の切替は `extractColors(image, style)` の引数で受け取り、対応する `Parameters` を `bake` してから histogram を構築する。

### 触るファイル

#040 で作成済みのファイルを使い回す部分と、本 issue で新規に作るファイルを分けて並べる。

#040 で作成済み (本 issue ではそのまま使う):

- `src/features/color-extract/types/cam16.ts`
- `src/features/color-extract/usecases/cam16.ts`
- `src/features/color-extract/usecases/baked-parameters.ts`
- `src/features/color-extract/usecases/cam16-parallel.ts`
- `src/features/color-extract/workers/cam16-worker.ts`
- `tests/features/color-extract/cam16.test.ts`
- `tests/features/color-extract/__browser__/cam16-parallel.test.ts`

本 issue で新規作成:

- `src/features/color-extract/usecases/image.ts` (OffscreenCanvas でリサイズ、ImageData 抽出)
- `src/features/color-extract/usecases/gather.ts`
- `src/features/color-extract/usecases/auto-threshold.ts`
- `src/features/color-extract/usecases/dedup.ts`
- `src/features/color-extract/usecases/post-dedup.ts`
- `src/features/color-extract/usecases/salience-palette.ts`
- `src/features/color-extract/usecases/diff.ts` (canBucket, salience, salNaive, scoreHistogram と重みプリセット)
- `src/features/color-extract/usecases/extract-colors.ts` (公開 API 本体)
- `src/features/color-extract/workers/threshold-worker.ts` (auto_threshold 並列探索用)
- `src/features/color-extract/types/histo.ts` (Histo)
- `src/features/color-extract/types/colors.ts` (Colors, Style, Histo)
- `src/features/color-extract/index.ts` (公開 API)
- `tests/features/color-extract/gather.test.ts`
- `tests/features/color-extract/dedup.test.ts`
- `tests/features/color-extract/post-dedup.test.ts`
- `tests/features/color-extract/salience-palette.test.ts`
- `tests/features/color-extract/auto-threshold.test.ts`
- `tests/features/color-extract/diff.test.ts`
- `tests/features/color-extract/__browser__/image.test.ts` (OffscreenCanvas を使うので browser project)
- `tests/features/color-extract/__browser__/extract-colors.test.ts` (公開 API の E2E)
- `tests/features/color-extract/__browser__/golden.test.ts` (参照画像 3 枚で出力固定)
- `tests/features/color-extract/fixtures/anime.png`
- `tests/features/color-extract/fixtures/photo.png`
- `tests/features/color-extract/fixtures/logo.png`

### 構造・命名・責務分離

- 各 usecase は React 非依存の純粋関数として書き、単体テストできる状態を保つ
- `canBucket`、`salience`、`salNaive`、`scoreHistogram` は `diff.ts` に集約する
- 重みプリセット `WEIGHTS_NAIVE`、`WEIGHTS_FULL`、`WEIGHTS_BUCKETING` は `diff.ts` 冒頭で `as const` にする
- Web Worker は `workers/` 配下に隔離し、メインスレッドからは usecase 経由でのみ呼ぶ
- 入力画像処理は `usecases/image.ts` に閉じ、`OffscreenCanvas` を使う
- フィールド名は wallust の `Colors` に揃える (`color0` から `color15`、`background`、`foreground`、`cursor`)
- `Colors` 内の各色は CAM16-UCS Jmh の `{ j, m, h }` 形式で持つ

### 使用ライブラリ

- `culori`: sRGB の取り扱いと `Srgb → linearRGB` 変換に使う。CAM16 変換は #040 で書いた自前実装を使うので culori の cam16 系は使わない
- 標準 Web API: `OffscreenCanvas`、`ImageData`、`Web Worker`、`crypto.subtle.digest`、`navigator.hardwareConcurrency`

### テスト戦略

ユニットテスト (Vitest node project):

- `gather`: 5 画素入力で期待バケット 3 個になり、threshold で挙動が変わる
- `dedup`: 重複入力で count が統合される
- `postDedup`: salience スコアが計算され、bg が末尾に来る
- `saliencePalette`: 6 色入力で Colors が完全に埋まる
- `autoThreshold`: 同じ画素列で同じ threshold が選ばれる (再現性)
- `diff`: `canBucket` / `salience` / `salNaive` / `scoreHistogram` が wallust と一致

ブラウザテスト (Vitest browser project):

- `image`: 1920x1080 の画像が 512x288 にリサイズされ、ImageData が正しく取れる
- `extractColors`: dark style と light style で異なる Colors が返る
- `golden`: 参照画像 3 枚 (アニメ風 / 写真 / ロゴ調) で `extractColors` の Jmh 出力が固定値と一致 (誤差許容 1e-3)

## 関連

- spec: docs/features/color-extract/spec.md
- 前段 PoC: docs/issue/done/040-cam16-ucs-ts-poc.md
- 採用判定レポート: docs/references/cam16/ts-port-feasibility.md
- 参考: docs/references/wallust/v4-changes.md §3 §4 §8
- 参考: docs/references/wallust/cam16-ucs.md
- 移植元: library/wallust/src/histogram/{mod,salience,diff,util}.rs
- 後続 issue: #036 intensity (Pastel / Vibrant)、#037 sampling mode、#038 WCAG コントラスト、Phase 2 で palette-design feature
