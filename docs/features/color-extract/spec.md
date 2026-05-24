---
feature: color-extract
status: planned
last-updated: 2026-05-24
---

# color-extract 仕様

## 概要

`color-extract` feature は、画像から 16 色のカラーパレットを取り出して `Colors` として返すレイヤにあたる。中身は wallust v4 の色抽出ロジックを Rust のまま自前クレート `crates/wasm` に再構築し、それを WebAssembly にコンパイルしたモジュールで、TypeScript からはこの wasm を呼ぶ薄いラッパだけを持つ。後段の `palette-design` feature が semantic ロールを派生させる前提の中間出力を担う。

抽出ロジックを TypeScript に移植せず Rust のまま wasm として動かすのは、保守コストを下げるためである。パイプラインごとに Rust から TypeScript へ書き写すと、wallust 側の更新に追従するたびに移植とテストをやり直すことになり、しかも浮動小数の処理差で出力が完全には一致しない。Rust ソースを再構築して wasm にすれば、wallust の出力と byte レベルで一致し、ロジックの追従はソースを取り込み直してビルドするだけで済む。

vendored の `library/wallust` を直接いじらず、抽出に要る部分だけ自前クレートに再構築するのは、wallust が OSS だからである。上流の OSS ツリーに我々の wasm 用コードを混ぜると、上流のどこを変えたのかが追いにくくなり管理がややこしくなる。`library/wallust` は再構築の参照元として無改変のまま残し、`crates/wasm` を我々が保守する資産として切り分ける。

## 入出力

入力は画像の生バイト列と抽出設定で、出力は 16 色に背景と前景とカーソル色を加えた `Colors` になる。色は sRGB の hex 文字列で返す。

入力画像はブラウザ側で `Blob` から `Uint8Array` に変換してから wasm に渡す。デコードとリサイズは wasm 内の `image` クレートが担うため、JavaScript 側は画像の中身に触れない。

- 入力: 画像の生バイト列 `Uint8Array`（PNG / JPEG / WebP）と `ExtractConfig`
- 出力: `Colors`

```ts
type Palette = "salience" | "ansi" | "kmeans";
type Style = "dark" | "light";

type ExtractConfig = {
  palette: Palette;
  style: Style;
  use16cols: boolean;
  dynamic: boolean;
  checkContrast: boolean;
  saturation?: number;
};

type Colors = {
  background: string;
  foreground: string;
  cursor: string;
  color0: string; color1: string; color2: string; color3: string;
  color4: string; color5: string; color6: string; color7: string;
  color8: string; color9: string; color10: string; color11: string;
  color12: string; color13: string; color14: string; color15: string;
};

const extractColors = (
  image: Blob,
  config: ExtractConfig,
): Promise<Colors> => {
  /* Blob を Uint8Array にして wasm の genColorsFromBytes を呼ぶ */
};
```

公開 API は `extractColors(image, config)` 1 本にする。`style` は dark と light で観察条件の白色点と背景輝度を切り替える引数なので、palette-design 側がテーマ種別を判定した上で渡す前提になる。

## アルゴリズム / 処理フロー

処理は wasm の境界をまたいで進む。JavaScript 側はバイト列を渡して結果を受け取るだけで、色抽出の本体は wasm 内で完結する。ここで言う本体とは、画像のデコードからリサイズ、ヒストグラム構築、16 色割り当て、最終補正までを指す。本体のロジックは `crates/wasm` に再構築済みで、`library/wallust` のソースと同じ計算をする。

### 1. バイト列の受け渡し

ブラウザ側で `image.arrayBuffer()` を呼んで `Uint8Array` を作り、wasm の `genColorsFromBytes(bytes, config)` に渡す。リサイズもデコードも wasm 内で行うため、ブラウザ側に `OffscreenCanvas` や Web Worker は要らない。これにより画素変換の並列化や転送コストの設計をすべて Rust 側に寄せられる。

### 2. デコードとリサイズ

wasm 内で `image::load_from_memory` がバイト列をデコードし、wallust の `resized` バックエンドと同じ縮小をかける。縮小は長辺が 1024px 以上のとき縦横を半分にし、Gaussian フィルタを使う。アスペクト比を保つのは、画像中の色面の相対面積を維持して顕著性スコアに偏りが入らないようにするためである。

リサイズに `image` の純スカラー Gaussian を使い、wallust のデフォルトである `fast_image_resize` を採らないのは、parity をビットレベルで保つためである。`fast_image_resize` は SIMD バックエンドが環境依存で、native の x86 と wasm の SIMD128 やスカラーで結果が一致する保証がない。リサイズで数 LSB ずれるとヒストグラムのバケット境界で画素の振り分けが変わり、最終 16 色が変わりうる。純スカラーの Gaussian なら環境に依らず同じ結果になり、native CLI を `backend=resized` で動かした出力と完全に一致させられる。バックエンドの選択は `crates/wasm` 内で `resized` に固定し、`ExtractConfig` には出さない。

### 3. ヒストグラムと 16 色割り当て

`gen_colors` の中で palette 分岐ごとに走るパイプラインを再構築して呼ぶ。`config.palette` が salience なら `Histogram` を組んで dedup と post_dedup と salience_palette を通し、ansi なら ANSI 順の割り当て、kmeans なら Lab 空間のクラスタリングに進む。dark と light の違いは wallust の `ColorOrder` を経由して白色点と背景輝度に反映される。

各段のアルゴリズムの正本は `library/wallust/src/histogram/` とする。`crates/wasm` 側はこのソースを再構築したものなので、アルゴリズムを独自に変えず、上流の計算と一致させ続けることを原則にする。

### 4. 最終補正と hex 化

`postcolor` で `use16cols` と `checkContrast` と `saturation` に応じた補正をかけたあと、19 個の `Myrgb` を `#RRGGBB` の文字列に変換して `Colors` として返す。hex で返すのは、後段の palette-design と Neovim カラースキーム生成が sRGB の hex を直接扱うためで、中間で別の色空間を経由する必要がない。

## フォルダ構成と wasm ビルド

Rust のコードはルート直下の `crates/wasm` 1 クレートにまとめ、wasm-pack の生成物は `generated/wasm` に出す。この置き方は wasm を内包する Vite プロジェクトの一般的な慣習に沿っていて、Rust ソースとビルド成果物とアプリ本体を物理的に分ける。

```
oshicolor/
├── Cargo.toml              # [workspace] members = ["crates/*"]
├── crates/
│   └── wasm/               # 我々のクレート。cdylib
│       ├── Cargo.toml
│       ├── LICENSE         # wallust の MIT を継承して明記する
│       └── src/
│           ├── lib.rs      # #[wasm_bindgen] genColorsFromBytes
│           ├── histogram/  # library/wallust から再構築
│           ├── colors.rs
│           ├── backends.rs # デコードとリサイズだけ
│           └── config.rs   # 抽出に要る設定だけ
├── generated/wasm/         # wasm-pack の出力先。中身は gitignore し .gitkeep だけ追跡
├── library/wallust/        # OSS 原本。再構築の参照元として無改変で残す
└── src/features/color-extract/
```

`crates/wasm` は wallust の抽出ロジックを再構築した自前クレートで、CLI 専用モジュール（`main` / `template` / `cache` / `sequences` / `args` / `pick`）は取り込まない。これらは端末出力やファイルキャッシュを扱うもので、ブラウザ内の色抽出には不要であり、しかも wasm32 が非 unix のため `sequences.rs` のように cfg ボディが空になって型が合わなくなる。要る部分だけ再構築することで、ビルドが通り、バイナリも小さくなる。

wallust は MIT ライセンスの OSS なので、ソースを再構築して取り込む `crates/wasm` にも MIT のライセンス表記と帰属を残す。

ビルドと依存の要点を次に示す。

- `crates/wasm/Cargo.toml` で `crate-type = ["cdylib"]` を指定し、`image` / `palette` / `kmeans_colors` を直接依存にする
- リサイズは `image` の Gaussian に固定し、`fast_image_resize` は依存に入れない
- `getrandom` を `wasm_js` feature 付きで依存に加え、ビルド時に `--cfg getrandom_backend="wasm_js"` を渡す
- `jxl-oxide` は取り込まない。JPEG XL はキャラクターイラスト用途で使わないので、バイナリサイズを抑える方を優先する
- `wasm-pack build crates/wasm --target web --out-dir ../../generated/wasm` で生成物を出し、`vite-plugin-wasm` と `vite-plugin-top-level-await` を通して import する

## 主要な型・定数

公開する型は最小限にして、数値定数や重みは wallust 側に閉じる。

- `Palette`: `"salience" | "ansi" | "kmeans"`
- `Style`: `"dark" | "light"`
- `ExtractConfig`: 上記の入力設定
- `Colors`: 19 個の hex 文字列フィールド
- リサイズ縮小の境界は wallust の `shrink` に従い、長辺 1024px 以上で半分にする

## 依存

色抽出のロジックはすべて wasm 側にあるため、TypeScript 側の依存は最小限になる。

- wasm クレート `crates/wasm`: `image` / `palette` / `kmeans_colors` / `getrandom`
- ビルド: `wasm-pack` と `wasm32-unknown-unknown` target
- パッケージ: ランタイムの追加依存はなく、Vite の `vite-plugin-wasm` と `vite-plugin-top-level-await` のみ
- 他 feature: なし

## 設計の前提と制約

メモリキャッシュは `Map<key, Colors>` の LRU で TypeScript 側に持ち、永続化は対象外にする。キーは画像バイト列のハッシュと `ExtractConfig` の組で取り、設定違いは別エントリとして扱う。

wasm は単一スレッドで動かす。リサイズ後の画像は長辺が高々 512px 程度に収まり、抽出は短時間で終わるため、現時点ではスレッド並列を入れない。将来ベンチマークで不足が出たら、wasm threads と SharedArrayBuffer の導入を専用 issue で検討する。その場合は COOP と COEP のヘッダ設定が前提になる。

intensity 補正や sampling mode といった抽出のバリエーションは wallust の config を通すだけで切り替わるため、本 feature 側で再実装しない。`ExtractConfig` に項目を足して wasm に渡す形で拡張する。

## 関連

- 再構築元: library/wallust/src/{lib.rs, histogram/, backends/, colors.rs, config.rs}
- 後続 issue: #036 intensity、#037 sampling mode、#038 WCAG コントラスト
