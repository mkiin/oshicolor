---
title: CAM16-UCS Jmh の TS 実装と Web Worker 並列化の実現可能性検証 (PoC)
labels: [research, feature]
mvp: 1
feature: color-extract
created: 2026-05-19
branch: research/040-cam16-ucs-ts-poc
---

# CAM16-UCS Jmh の TS 実装と Web Worker 並列化の実現可能性検証 (PoC)

## 何をやるか

wallust v4 が salience pipeline で使う CAM16-UCS Jmh 色空間の TypeScript 実装と、Web Worker による画素変換の並列化を組み合わせた PoC を作る。OKLch ではなく CAM16-UCS を採用する場合の実装コスト・実行速度・出力品質を実測し、`#035 color-extract salience pipeline` で採用するかを判定する。本 issue は color-extract feature の前座として位置付ける。

## なぜやるか

現 #035 spec は OKLch 採用だが、これは wallust の中核機能 (dark/light で観察条件 `L_A`, `Y_b`, surround を切替えて `BakedParameters` を焼く) を捨てている。Cinderella / Dorothy / Red Hood のチューニングで `--style` 切替の効果が劇的だったため、CAM16-UCS で再現したい。ただし TS で実装するコストと速度の見積もりが取れていない。PoC で採用可否を数値で判定し、その結果に応じて #035 と spec.md を書き換える。

## 完了条件

- [ ] CAM16-UCS Jmh の TS 実装 (sRGB → 線形 RGB → XYZ → CAT16 → Hunt-Pointer 非線形圧縮 → 対立色信号 → J/M/h → UCS)
- [ ] `Parameters → BakedParameters` の係数導出を分離して 1 度だけ実行する構造
- [ ] palette クレート (Rust) の出力との数値一致テスト (5〜10 サンプル色、誤差 1e-4 以内)
- [ ] 観察条件 dark (`L_A=140, Y_b=0.2`) と light (`L_A=500, Y_b=0.8`) で同じ sRGB が別 Jmh に変換されることを確認
- [ ] Web Worker × N (N ≈ `hardwareConcurrency - 1`) で 1024×1024 画像を変換するベンチマーク
- [ ] culori の OKLch 変換との速度比較 (同じ画像、Worker 数 1, 2, 4, 8 で並列化効果を計測)
- [ ] 採用判定レポートを `docs/references/cam16/ts-port-feasibility.md` に記録
- [ ] 結果に基づき #035 と `docs/features/color-extract/spec.md` の色空間部分を更新

## 実装方針

### 設計アプローチ

wallust の Rust 実装 (palette クレートの `cam16` モジュール) を参考に、CAT16 行列、Hunt-Pointer-Estévez 変換、対立色変換、UCS 変換を TS で書く。`BakedParameters` 相当を `Parameters` から導出する関数を分離し、Web Worker にはこの係数だけを Transferable で渡す構造にする。`BakedParameters` は画像非依存 (style にのみ依存) なのでメインスレッドで 1 回計算する。

### 触るファイル

- 新規: `src/features/color-extract/usecases/cam16.ts` (CAM16-UCS Jmh 変換の純粋関数群)
- 新規: `src/features/color-extract/usecases/baked-parameters.ts` (Parameters → BakedParameters 係数導出)
- 新規: `src/features/color-extract/workers/cam16-worker.ts` (画素並列変換 Worker)
- 新規: `src/features/color-extract/types/cam16.ts` (Parameters, BakedParameters, Cam16UcsJmh 型)
- 新規: `tests/features/color-extract/cam16.test.ts` (palette クレート出力との数値一致)
- 新規: `tests/features/color-extract/baked-parameters.test.ts` (係数導出の妥当性)
- 新規: `scripts/bench/cam16-vs-oklch.ts` (ベンチマーク)
- 新規: `scripts/refgen/cam16-reference.rs` (palette クレートで参照値生成)
- 新規: `docs/references/cam16/ts-port-feasibility.md` (採用判定レポート)
- 参照: `library/wallust/src/histogram/mod.rs:138-156` (BakedParameters 初期化のしかた)

### 構造・命名・責務分離

- `cam16.ts` は CAM16-UCS の純粋関数のみ。`Parameters` と `BakedParameters` の型は `types/cam16.ts` に分離
- `BakedParameters` は画像非依存 (style にのみ依存) なのでメインスレッドで 1 回計算
- Worker 内では `BakedParameters` を受け取り画素単位で `cam16` 関数を呼ぶ
- `ImageData` は Transferable で分割し、Worker 間でゼロコピー移送
- フィールド名は wallust に揃える (`L_A`, `Y_b`, `surround`, `whitePoint`)

### 使用ライブラリ

- 既存 TS で CAM16 を提供するものは無い (culori, @texel/color とも非対応)
- ベンチには Vitest の bench か mitata を採用
- 参照値生成には Rust の `palette` クレート (wallust が依存している `palette = "0.7"` の cam16 module) を直接使う

### テスト戦略

- ユニットテスト (Vitest):
  - `cam16`: sRGB の 5〜10 色について palette クレートの参照値と 1e-4 以内で一致
  - `cam16`: 観察条件 dark (`L_A=140, Y_b=0.2`) と light (`L_A=500, Y_b=0.8`) で同じ sRGB が異なる Jmh を返す
  - `baked-parameters`: `Parameters` から `BakedParameters` を導出した係数が参照値と一致
- ベンチ:
  - 1024^2 / 512^2 / 256^2 の 3 サイズ、Worker 数 1 / 2 / 4 / 8 で OKLch (culori) と速度比較
  - 結果を `docs/references/cam16/ts-port-feasibility.md` に表で記録

## 関連

- 参考: docs/references/wallust/v4-changes.md §4 (CAM16-UCS への移行)
- 参考: docs/references/wallust/cam16-ucs.md (CAM16 入門と wallust 実装の読み解き)
- 参考: library/wallust/src/histogram/mod.rs:138-156 (BakedParameters 初期化)
- 参考: library/wallust/Cargo.toml (`palette = "0.7"` の cam16 module)
- ブロッカー: #035 (本 PoC の結果次第で #035 spec を書き換える)
- 後続: kmeans / ansi 移植・ExtractedPalette 統合 (本 PoC 完了後に別途 issue 化)
