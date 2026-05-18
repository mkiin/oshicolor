---
title: color-extract feature - wallust v4 Salience pipeline を OKLch 上に移植
labels: [feature]
mvp: 1
feature: color-extract
created: 2026-05-18
branch: feature/035-color-extract-salience-pipeline
---

# color-extract feature - wallust v4 Salience pipeline を OKLch 上に移植

## 何をやるか

新規 feature `color-extract` を立ち上げ、wallust v4 の Salience pipeline (threshold histogram + auto_threshold + salience scoring + 16 色割り当て) を TypeScript と OKLch 上に移植する。出力は wallust の Colors 構造体相当の 16 色パレットになる。

## なぜやるか

oshicolor の最初の処理層として「画像から代表色 16 色を取り出す」処理が要る。自前で設計するより wallust v4 の成熟したアルゴリズムを踏襲する方が、設計判断のリスクを抑えながら確実に動くものを得られる。Phase 2 で oshicolor 固有の semantic ロール層を上に乗せる前提の中間出力にあたる。

## 完了条件

- [ ] `src/features/color-extract/usecases/` に gather, autoThreshold, dedup, postDedup, saliencePalette を実装
- [ ] `src/features/color-extract/types/` に Colors, OKLch, Histo の型定義
- [ ] auto_threshold が Web Worker pool で並列実行される
- [ ] `src/features/color-extract/index.ts` から `extractColors(image): Promise<Colors>` を公開
- [ ] 各 usecase の単体テスト (Vitest)
- [ ] 参照画像 3 枚 (アニメ風 / 写真 / ロゴ調) で golden test が通る
- [ ] `docs/features/color-extract/spec.md` と整合

## 実装方針

### 設計アプローチ

wallust v4 (Rust) の `src/histogram/` 配下と `src/lib.rs::gen_colors` の `Palette::Salience` 分岐をそのまま TS に移植する。色空間は OKLch (CAM16-UCS は不採用)。距離・salience の計算は wallust と同じ重み構造を使い、OKLch 用に正規化定数だけ差し替える。auto_threshold は素の Web Worker で並列化する。

### 触るファイル

- 新規: `src/features/color-extract/usecases/gather.ts`
- 新規: `src/features/color-extract/usecases/auto-threshold.ts`
- 新規: `src/features/color-extract/usecases/dedup.ts`
- 新規: `src/features/color-extract/usecases/post-dedup.ts`
- 新規: `src/features/color-extract/usecases/salience-palette.ts`
- 新規: `src/features/color-extract/usecases/diff.ts` (canBucket, salience, salNaive, scoreHistogram)
- 新規: `src/features/color-extract/usecases/image.ts` (Canvas リサイズ、sRGB → OKLch)
- 新規: `src/features/color-extract/workers/threshold-worker.ts`
- 新規: `src/features/color-extract/types/color.ts` (OKLch)
- 新規: `src/features/color-extract/types/histo.ts` (Histo)
- 新規: `src/features/color-extract/types/colors.ts` (Colors)
- 新規: `src/features/color-extract/index.ts`
- 新規: `tests/features/color-extract/gather.test.ts`
- 新規: `tests/features/color-extract/dedup.test.ts`
- 新規: `tests/features/color-extract/post-dedup.test.ts`
- 新規: `tests/features/color-extract/salience-palette.test.ts`
- 新規: `tests/features/color-extract/auto-threshold.test.ts`
- 新規: `tests/features/color-extract/diff.test.ts`
- 新規: `tests/features/color-extract/image.test.ts`
- 新規: `tests/features/color-extract/extract-colors.test.ts` (公開 API の E2E)
- 新規: `tests/features/color-extract/golden.test.ts` (参照画像 3 枚で出力固定)
- 新規: `tests/features/color-extract/fixtures/anime.png`
- 新規: `tests/features/color-extract/fixtures/photo.png`
- 新規: `tests/features/color-extract/fixtures/logo.png`
- 新規: `docs/features/color-extract/spec.md` (本 issue と同時)
- 編集: `package.json` (culori 追加)

### 構造・命名・責務分離

- 各 usecase は React 非依存の pure 関数として書き、単体テストできる状態を保つ
- `canBucket`、`salience`、`salNaive`、`scoreHistogram` は diff.ts に集約
- 重みプリセット `WEIGHTS_NAIVE`、`WEIGHTS_FULL`、`WEIGHTS_BUCKETING` は diff.ts 冒頭で `as const`
- Web Worker は `workers/threshold-worker.ts` に隔離。メインスレッドからは usecase 経由でのみ呼ぶ
- 入力画像処理は `usecases/image.ts` に閉じ、`OffscreenCanvas` を使う
- フィールド名は wallust の `Colors` に揃える (`color0` から `color15`、`background`、`foreground`、`cursor`)

### 使用ライブラリ

- `culori`: OKLch 変換用。距離・salience の計算は自前で書く (wallust の式を移植するため)
- 標準 Web API: `OffscreenCanvas`、`ImageData`、`Web Worker`、`crypto.subtle.digest`

### テスト戦略

- ユニットテスト (Vitest):
  - `gather`: 5 画素入力で期待バケット 3 個、threshold で挙動が変わる
  - `dedup`: 重複入力で count が統合される
  - `postDedup`: salience スコアが計算され bg が末尾になる
  - `saliencePalette`: 6 色入力で Colors が完全に埋まる
  - `autoThreshold`: 同じ画素列で同じ threshold が選ばれる (再現性)
- golden test:
  - 参照画像 3 枚 (アニメ風 / 写真 / ロゴ調) で `extractColors` の OKLch 出力が固定値と一致 (誤差許容 1e-4)

## 関連

- spec: docs/features/color-extract/spec.md
- 参考: docs/references/wallust/v4-changes.md (§3, §4, §8)
- 参考: docs/references/wallust/cam16-ucs.md
- 後続 issue: #036 (intensity)、#037 (sampling mode)、#038 (WCAG コントラスト)、Phase 2 で palette-design feature
