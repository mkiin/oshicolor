# アーキテクチャ概要

## モノレポ構成

node-vibrant は `packages/` 配下に複数のパッケージを持つモノレポ構成。
責務が明確に分離されており、ブラウザ/Node.js 両環境に対応している。

```
node-vibrant/
└── packages/
    ├── vibrant-types/           # 汎用型ユーティリティ
    ├── vibrant-color/           # 色の表現・変換・比較
    ├── vibrant-image/           # 画像インターフェース定義 + Histogram
    ├── vibrant-image-node/      # Node.js 向け画像実装（Jimp使用）
    ├── vibrant-image-browser/   # ブラウザ向け画像実装（Canvas使用）
    ├── vibrant-quantizer/       # Quantizer インターフェース定義
    ├── vibrant-quantizer-mmcq/  # MMCQ アルゴリズム実装
    ├── vibrant-generator/       # Generator インターフェース定義
    ├── vibrant-generator-default/ # デフォルトパレット生成器
    ├── vibrant-worker/          # Web Worker ユーティリティ
    ├── vibrant-core/            # コア（Vibrant クラス・Pipeline）
    └── node-vibrant/            # エントリポイント（Node.js + ブラウザ）
```

## 各パッケージの役割

### `vibrant-types`
Promise.withResolvers の内部実装 `Defer<R>` と `Resolvable<T>` 型を提供。
非同期処理の基盤となる軽量ユーティリティ。

### `vibrant-color`
カラーに関するすべての型と変換ロジック。

| エクスポート | 説明 |
|---|---|
| `Swatch` クラス | RGB・HSL・Hex・人口数・テキスト色を保持する色単位 |
| `Filter` 型 | `(r,g,b,a) => boolean` のフィルタ関数型 |
| `Vec3` 型 | `[number, number, number]` の3次元ベクトル |
| `Palette` 型 | 6スロットの名前付きSwatch辞書 |
| 色変換関数群 | `rgbToHsl`, `hslToRgb`, `rgbToHex`, `hexToRgb`, `rgbToCIELab`, `deltaE94` など |

### `vibrant-image`
プラットフォーム非依存の画像インターフェース。

- `ImageBase` 抽象クラス: load / resize / getImageData などを定義
- `Histogram` クラス: ピクセルデータを5ビット量子化してヒストグラムを構築
- `applyFilters()`: フィルタ関数を全ピクセルに適用し、不要ピクセルのアルファを0にする
- `scaleDown()`: `quality` または `maxDimension` に従ってリサイズ比を計算

### `vibrant-image-node` / `vibrant-image-browser`
`ImageBase` の環境別実装。

| パッケージ | 実装手法 |
|---|---|
| `vibrant-image-node` | [Jimp](https://github.com/jimp-dev/jimp) でデコード・リサイズ |
| `vibrant-image-browser` | `<canvas>` + Canvas 2D API でデコード・ピクセル取得 |

### `vibrant-quantizer-mmcq`
MMCQ（Modified Median Cut Quantization）アルゴリズムの実装。
詳細は [algorithm.md](./algorithm.md) を参照。

### `vibrant-generator-default`
量子化で得た Swatch 群を HSL 空間でスコアリングし、6つの名前付きスロットへ割り当てる。
詳細は [algorithm.md](./algorithm.md) を参照。

### `vibrant-worker`
Web Worker を使ってパイプライン処理をバックグラウンドスレッドで実行するためのユーティリティ。

- `WorkerPool`: 最大5ワーカーのプール管理、タスクキュー
- `runInWorker()`: Worker スレッド側のメッセージハンドラ設定

### `vibrant-core`
ライブラリの中心。

- `Vibrant` クラス: エントリポイント、`getPalette()` / `getPalettes()` を公開
- `Builder` クラス: メソッドチェーンで設定を組み立てるビルダー
- `BasicPipeline`: フィルタ → 量子化 → パレット生成 を同期的に実行
- `WorkerPipeline`: `BasicPipeline` を Worker 経由で実行

### `node-vibrant`（エントリポイント）
環境に合わせた設定を `Vibrant.DefaultOpts` に注入して再エクスポートする薄いラッパー。

```
node.ts   → ImageClass = NodeImage,   pipeline を注入
browser.ts → ImageClass = BrowserImage, pipeline を注入
```

`pipeline/index.ts` でフィルタ・量子化器・生成器をすべて登録:
```typescript
// デフォルトフィルタ: 半透明以下 or ほぼ白 を除外
(r, g, b, a) => a >= 125 && !(r > 250 && g > 250 && b > 250)

// 量子化器: MMCQ
// 生成器: DefaultGenerator
```

## 依存関係グラフ

```
node-vibrant
└── vibrant-core
    ├── vibrant-color
    ├── vibrant-image
    │   └── vibrant-types
    ├── vibrant-quantizer
    ├── vibrant-generator
    └── vibrant-worker
        └── vibrant-types

node-vibrant (Node.js entry)
├── vibrant-image-node      (Jimp)
├── vibrant-quantizer-mmcq  (MMCQ実装)
└── vibrant-generator-default

node-vibrant (Browser entry)
├── vibrant-image-browser   (Canvas API)
├── vibrant-quantizer-mmcq
└── vibrant-generator-default
```

## デフォルト設定値

| オプション | デフォルト値 | 説明 |
|---|---|---|
| `colorCount` | 64 | MMCQ が生成する色数 |
| `quality` | 5 | スケールダウン係数（1/quality にリサイズ） |
| `filters` | `["default"]` | 使用するフィルタ名のリスト |
| `quantizer` | `"mmcq"` | 使用する量子化器名 |
| `generators` | `["default"]` | 使用する生成器名のリスト |
