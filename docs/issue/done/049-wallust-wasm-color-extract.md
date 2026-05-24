---
title: color-extract feature - wallust v4 を wasm にして色抽出を直接動かす
labels: [feature]
mvp: 1
feature: color-extract
created: 2026-05-24
last-updated: 2026-05-24
branch: feature/049-wallust-wasm-color-extract
---

# color-extract feature - wallust v4 を wasm にして色抽出を直接動かす

## 何をやるか

wallust v4 の色抽出ロジックを Rust のまま自前クレート `crates/wasm` に再構築し、それを WebAssembly にコンパイルしてブラウザ内で色抽出を走らせる。`crates/wasm` には `gen_colors` のパイプライン本体とデコード・リサイズだけを取り込み、CLI 専用モジュールは捨てる。wasm エントリ `genColorsFromBytes(bytes, config)` を作り、`src/features/color-extract` の公開 API `extractColors(image, config)` からこの wasm を呼ぶ。出力は 16 色に背景と前景とカーソル色を加えた sRGB hex の `Colors` にする。

vendored の `library/wallust` は無改変のまま再構築の参照元として残し、我々の wasm 用コードは `crates/wasm` に分離する。

## なぜやるか

色抽出ロジックを Rust から TypeScript へ移植すると、wallust の更新に追従するたびに移植とテストをやり直す保守コストがかかり、浮動小数の処理差で出力が完全には一致しない。Rust ソースを再構築して wasm にすれば、wallust の出力と byte レベルで一致し、ロジックの追従はソースを取り込み直してビルドするだけで済む。

vendored の `library/wallust` を直接パッチせず自前クレートに再構築するのは、wallust が OSS だからである。上流の OSS ツリーに我々の wasm 用コードを混ぜると、上流のどこを変えたのかが追いにくく管理がややこしくなる。`library/wallust` を無改変の参照元として残し、`crates/wasm` を我々の資産として切り分ける。

実行場所をブラウザにするのは、画像を端末から出さずに済み、サーバーコストもかからず、応答も速いためである。oshicolor は 1 枚のイラストから 16 色を出すツールなので、サーバー往復を挟む利点が薄い。

feasibility は確認済みで、依存スタック（`image` / `palette` / `kmeans_colors` / `getrandom`）は `wasm32-unknown-unknown` で通る。残る障害は wallust の CLI 専用コード 2 箇所だけで、これらは `crates/wasm` に取り込まないことで消える。

リサイズは `image` の純スカラー Gaussian（`resized` backend 相当）に固定し、`fast_image_resize` は使わない。`fast_image_resize` は SIMD バックエンドが環境依存で native と wasm でビット一致しないため、リサイズ段で parity が崩れる。純スカラーの Gaussian なら環境に依らず同じ結果になる。

## 完了条件

- [ ] ルートに Cargo workspace を立て `crates/wasm` を `crate-type = ["cdylib"]` で新設
- [ ] wallust の抽出コード（`histogram/` / `colors.rs` / `backends` の `resized`（image Gaussian）/ `config`）を `crates/wasm/src` に再構築し CLI 専用モジュールと `fast_image_resize` は取り込まない
- [ ] `crates/wasm/LICENSE` に wallust の MIT を継承して帰属を明記
- [ ] `crates/wasm/src/lib.rs` に `#[wasm_bindgen]` 付き `genColorsFromBytes` を実装
- [ ] `getrandom` を `wasm_js` feature 付きで追加し `--cfg getrandom_backend="wasm_js"` でビルド
- [ ] `wasm-pack build crates/wasm --target web --out-dir generated/wasm` が成功し生成物が出る
- [ ] `src/features/color-extract/index.ts` から `extractColors(image, config): Promise<Colors>` を公開
- [ ] 第 1 層 native `cargo test`: 再構築した抽出関数と wallust CLI（`backend=resized`）が 19 色 hex で完全一致
- [ ] 第 2 層 Vitest browser golden: 生成した wasm の出力 hex が golden と完全一致
- [ ] `library/wallust` が無改変のまま残っている
- [ ] `docs/features/color-extract/spec.md` と整合

## 実装方針

### 設計アプローチ

`library/wallust` の抽出に要るソース（`histogram/` / `colors.rs` / `backends` のデコードとリサイズ / `config` / `diff`）を `crates/wasm/src` に取り込み直し、`gen_colors` の `run(bytes) -> Colors` クロージャと `postcolor` に相当する処理を fs と cache 抜きで組む。CLI 専用モジュール（`main` / `template` / `cache` / `sequences` / `args` / `pick`）は取り込まない。これにより wasm32 で型が合わない箇所が消え、バイナリも小さくなる。

ルートに Cargo workspace を立てて `crates/wasm` を 1 クレートにまとめ、`wasm-pack build crates/wasm --target web --out-dir generated/wasm` で生成物を出す。生成物は `vite-plugin-wasm` と `vite-plugin-top-level-await` を通して import する。TypeScript 側は Blob を Uint8Array にして wasm を呼ぶだけのラッパに保つ。

`library/wallust` は無改変のまま参照元として残し、再構築コードが上流とずれていないかを照合できる状態を保つ。

### 触るファイル

ルートと Rust 側（新規）:

- `Cargo.toml`（新規。`[workspace] members = ["crates/*"]`）
- `crates/wasm/Cargo.toml`（新規。`crate-type = ["cdylib"]`、`image` / `palette` / `kmeans_colors` / `getrandom` / `wasm-bindgen`、fast_image_resize と jxl-oxide は入れない）
- `crates/wasm/LICENSE`（新規。wallust の MIT を継承）
- `crates/wasm/src/lib.rs`（新規。`genColorsFromBytes` と `ExtractConfig` → 内部 config 変換）
- `crates/wasm/src/{histogram/, colors.rs, backends.rs, config.rs, diff.rs}`（library/wallust から再構築。backends.rs はデコードと `resized` Gaussian だけ）
- `crates/wasm/.cargo/config.toml`（新規。wasm target に getrandom cfg を渡す）
- `generated/wasm/.gitkeep`（新規。中身は .gitignore）

color-extract feature 側:

- `src/features/color-extract/usecases/extract-colors.ts`（公開 API 本体。Blob → Uint8Array → wasm 呼び出し）
- `src/features/color-extract/types/colors.ts`（`Colors` / `ExtractConfig` / `Palette` / `Style`）
- `src/features/color-extract/usecases/cache.ts`（hash + config キーの LRU メモリキャッシュ）
- `src/features/color-extract/index.ts`（公開 API）
- `vite.config.ts`（generated/wasm を読むプラグイン設定）
- `.gitignore`（generated/wasm の中身を無視）

テスト:

- `crates/wasm/tests/parity.rs`（新規。第 1 層。native cargo test で wallust CLI `backend=resized` と 19 色 hex 一致）
- `tests/features/color-extract/__browser__/extract-colors.test.ts`（新規。公開 API のハッピーパスとエラー系）
- `tests/features/color-extract/__browser__/golden.test.ts`（新規。第 2 層。既存流用なしで組み直し、wasm 実物の hex を golden と照合）
- `tests/features/color-extract/fixtures/*.png`（新規。参照画像）
- `tests/features/color-extract/fixtures/golden.json`（新規。wallust CLI で生成した期待 hex）

### 構造・命名・責務分離

- wasm エントリ名は JS から呼ぶので `genColorsFromBytes` を camelCase で公開する
- 色抽出のアルゴリズムは `crates/wasm` に閉じ、feature 側に再実装しない。feature 側は変換と受け渡しとキャッシュだけを持つ
- `crates/wasm` の再構築コードは library/wallust のモジュール構成をなるべく保ち、上流との差分照合をしやすくする
- `ExtractConfig` から内部 config を組む変換は `crates/wasm/src/lib.rs` 側に置き、JS は素直なオブジェクトを渡す
- 出力 `Colors` は 19 個の `#RRGGBB` 文字列フィールドにそろえ、フィールド名は wallust の `Colors` に合わせる

### 使用ライブラリ

- Rust 側: `image` / `palette` / `kmeans_colors` を `crates/wasm` の直接依存にする。`getrandom` を `wasm_js` feature 付きで追加し、`wasm-bindgen` を wasm エントリ用に追加する。`fast_image_resize` は parity のため使わない
- ビルド: `wasm-pack` と `wasm32-unknown-unknown` target を新規導入する
- TypeScript 側: ランタイムの npm 追加依存はなし。`vite-plugin-wasm` と `vite-plugin-top-level-await` のみ

### テスト戦略

テストは 2 層に分ける。native の `cargo test` で抽出ロジックと CLI parity を取り、Vitest browser で wasm 実物の出力を検証する。native テストだけで wasm の一致を保証しないのは、CAM16 や Lab 変換で使う超越関数（pow / cbrt / 三角関数）が libm の実装差で native と wasm で最下位ビットがずれ得るためで、wasm 実物を回す層を別に置く。

第 1 層は native `cargo test`。`crates/wasm/tests/parity.rs` で、再構築した抽出関数と wallust CLI（`backend=resized`）に同じ画像を通し 19 色 hex の完全一致を確認する。リサイズを純スカラー Gaussian に固定したので環境差が出ず、TS 移植で起きていた max 2 LSB 差が原理的に消えることをここで担保する。

第 2 層は Vitest browser project。既存の golden テストは無く、TS 移植版の unit テストも流用しないので、`__browser__/golden.test.ts` を新規に組む。生成した wasm を介して `extractColors` を呼び、19 色 hex を wallust CLI から作った golden 値と完全一致で照合する。あわせて `extractColors` が Blob を受けて `Colors` を返すハッピーパスと、dark と light で異なる結果になること、壊れたバイト列でパニックせずエラーを返すことを確認する。

golden 値の生成元として、参照画像数枚を `tests/features/color-extract/fixtures/` に置き、各画像の期待 hex を wallust CLI で先に作って committed の golden とする。

## 関連

- spec: docs/features/color-extract/spec.md
- 再構築元: library/wallust/src/{lib.rs, histogram/, backends/, colors.rs, config.rs}
- 後続 issue: #036 intensity、#037 sampling mode、#038 WCAG コントラスト
