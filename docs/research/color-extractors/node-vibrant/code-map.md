# コードマップガイド

## パッケージ別ファイルマップ

### `packages/vibrant-types/src/index.ts`

| シンボル        | 種別   | 説明                                             |
| --------------- | ------ | ------------------------------------------------ |
| `Resolvable<T>` | 型     | `T \| Promise<T>`                                |
| `Defer<R>`      | クラス | resolve/reject を外部から呼べる Promise ラッパー |
| `defer<R>()`    | 関数   | `new Defer<R>()` のファクトリ                    |

---

### `packages/vibrant-color/src/index.ts`

| シンボル                | 種別             | 説明                                                                   |
| ----------------------- | ---------------- | ---------------------------------------------------------------------- |
| `Filter`                | インターフェース | `(r,g,b,a) => boolean` のフィルタ関数型                                |
| `Vec3`                  | 型               | `[number, number, number]`                                             |
| `Palette`               | インターフェース | `{ Vibrant, Muted, DarkVibrant, DarkMuted, LightVibrant, LightMuted }` |
| `Swatch`                | クラス           | 1色の表現。RGB・HSL・Hex・population・テキスト色を保持                 |
| `Swatch.applyFilters()` | 静的メソッド     | Swatch 配列にフィルタを適用して絞り込む                                |
| `Swatch.clone()`        | 静的メソッド     | Swatch の値コピーを返す（Worker 経由でのデシリアライズ用）             |
| `Swatch#r/g/b`          | getter           | RGB 各成分                                                             |
| `Swatch#hsl`            | getter           | HSL 変換（遅延計算・キャッシュ）                                       |
| `Swatch#hex`            | getter           | Hex 文字列（遅延計算・キャッシュ）                                     |
| `Swatch#population`     | getter           | この色のピクセル数（量子化ボックス内の合計）                           |
| `Swatch#titleTextColor` | getter           | YIQ輝度 < 200 → `"#fff"`, それ以外 → `"#000"`                          |
| `Swatch#bodyTextColor`  | getter           | YIQ輝度 < 150 → `"#fff"`, それ以外 → `"#000"`                          |

---

### `packages/vibrant-color/src/converter.ts`

| 関数                    | 入力       | 出力     | 説明                                      |
| ----------------------- | ---------- | -------- | ----------------------------------------- |
| `hexToRgb(hex)`         | `string`   | `Vec3`   | Hex → RGB                                 |
| `rgbToHex(r,g,b)`       | `number×3` | `string` | RGB → Hex                                 |
| `rgbToHsl(r,g,b)`       | `number×3` | `Vec3`   | RGB → HSL（H:0-1, S:0-1, L:0-1）          |
| `hslToRgb(h,s,l)`       | `number×3` | `Vec3`   | HSL → RGB（R/G/B: 0-255）                 |
| `rgbToXyz(r,g,b)`       | `number×3` | `Vec3`   | RGB → CIE XYZ（ガンマ補正あり）           |
| `xyzToCIELab(x,y,z)`    | `number×3` | `Vec3`   | XYZ → CIE L\*a\*b\*                       |
| `rgbToCIELab(r,g,b)`    | `number×3` | `Vec3`   | RGB → CIE L\*a\*b\*（合成）               |
| `deltaE94(lab1, lab2)`  | `Vec3×2`   | `number` | CIE Delta E 1994 色差計算                 |
| `rgbDiff(rgb1, rgb2)`   | `Vec3×2`   | `number` | RGB → CIELab 変換後に Delta E94           |
| `hexDiff(hex1, hex2)`   | `string×2` | `number` | Hex → RGB → CIELab → Delta E94            |
| `getColorDiffStatus(d)` | `number`   | `string` | Delta E 値を "Perfect"/"Close"/... に変換 |

---

### `packages/vibrant-image/src/index.ts`

| シンボル                           | 種別             | 説明                                                                       |
| ---------------------------------- | ---------------- | -------------------------------------------------------------------------- |
| `ImageSource`                      | 型               | `string \| HTMLImageElement \| Buffer`                                     |
| `Pixels`                           | 型               | `Uint8ClampedArray \| Buffer`                                              |
| `ImageData`                        | インターフェース | `{ data: Pixels, width, height }`                                          |
| `ImageOptions`                     | インターフェース | `{ quality, maxDimension }`                                                |
| `Image`                            | インターフェース | load/resize/getImageData などの抽象メソッド群                              |
| `ImageBase`                        | 抽象クラス       | `Image` の共通実装。`scaleDown()` を提供                                   |
| `ImageBase#scaleDown(opts)`        | メソッド         | `maxDimension` or `quality` に基づいてリサイズ比を計算し `resize()` を呼ぶ |
| `applyFilters(imageData, filters)` | 関数             | フィルタ不合格ピクセルのアルファを 0 にして返す                            |

### `packages/vibrant-image/src/histogram.ts`

| シンボル                         | 種別       | 説明                                                            |
| -------------------------------- | ---------- | --------------------------------------------------------------- |
| `Histogram`                      | クラス     | ピクセル配列から5bitに量子化してヒストグラム配列を構築          |
| `Histogram#hist`                 | フィールド | `Uint32Array` – インデックス → ピクセル数                       |
| `Histogram#getColorIndex(r,g,b)` | メソッド   | 5bit RGB → 1次元インデックスへの変換 `(r << 10) + (g << 5) + b` |
| `Histogram#colorCount`           | getter     | ユニーク色数                                                    |
| `Histogram#{r,g,b}{min,max}`     | フィールド | 各チャンネルの最小・最大値（5bit空間）                          |

---

### `packages/vibrant-image-node/src/index.ts`

| シンボル                   | 種別     | 説明                                       |
| -------------------------- | -------- | ------------------------------------------ |
| `NodeImage`                | クラス   | `ImageBase` の Node.js 実装                |
| `NodeImage#load(image)`    | メソッド | パス・Buffer・URL から Jimp で画像をロード |
| `NodeImage#getImageData()` | メソッド | Jimp の `bitmap` をそのまま返す            |
| `NodeImage#resize()`       | メソッド | Jimp の `resize()` を呼ぶ                  |

### `packages/vibrant-image-browser/src/index.ts`

| シンボル                      | 種別     | 説明                                                    |
| ----------------------------- | -------- | ------------------------------------------------------- |
| `BrowserImage`                | クラス   | `ImageBase` のブラウザ実装                              |
| `BrowserImage#load(image)`    | メソッド | `<img>` 要素 or URL から Canvas に描画してロード        |
| `BrowserImage#getImageData()` | メソッド | `canvas.getContext('2d').getImageData()` でピクセル取得 |
| `BrowserImage#resize()`       | メソッド | Canvas のサイズ変更 + `scale()` + `drawImage()`         |
| `BrowserImage#remove()`       | メソッド | DOM から `<canvas>` を削除                              |

---

### `packages/vibrant-quantizer-mmcq/src/vbox.ts`

| シンボル             | 種別         | 説明                                                              |
| -------------------- | ------------ | ----------------------------------------------------------------- |
| `SIGBITS`            | 定数         | `5` – 量子化ビット数                                              |
| `RSHIFT`             | 定数         | `3` – 8bit → 5bit への右シフト量                                  |
| `VBox`               | クラス       | RGB 色空間内の3次元矩形領域（ボックス）                           |
| `VBox.build(pixels)` | 静的メソッド | ピクセル配列から初期 VBox を生成（Histogram も同時構築）          |
| `VBox#dimension`     | フィールド   | `{ r1,r2,g1,g2,b1,b2 }` – ボックスの境界                          |
| `VBox#histogram`     | フィールド   | 共有ヒストグラム参照                                              |
| `VBox#volume()`      | メソッド     | ボックスの体積 `(r2-r1+1)*(g2-g1+1)*(b2-b1+1)` （キャッシュ付き） |
| `VBox#count()`       | メソッド     | ボックス内のピクセル総数（キャッシュ付き）                        |
| `VBox#avg()`         | メソッド     | ボックス内ピクセルの加重平均色 RGB（キャッシュ付き）              |
| `VBox#contains(rgb)` | メソッド     | 指定色がボックス内に含まれるか判定                                |
| `VBox#split()`       | メソッド     | **最長次元の中央値** でボックスを2分割して `[VBox, VBox]` を返す  |
| `VBox#clone()`       | メソッド     | 同じ境界・Histogram を持つ新しい VBox を返す                      |
| `VBox#invalidate()`  | メソッド     | キャッシュ（volume/count/avg）を無効化                            |

### `packages/vibrant-quantizer-mmcq/src/pqueue.ts`

| シンボル              | 種別     | 説明                                                         |
| --------------------- | -------- | ------------------------------------------------------------ |
| `PQueue<T>`           | クラス   | ソート遅延優先度キュー（push 時にソートせず pop 時にソート） |
| `PQueue#push(item)`   | メソッド | 要素を追加。ソート済みフラグをリセット                       |
| `PQueue#pop()`        | メソッド | ソート後に末尾（最大値）を取り出す                           |
| `PQueue#peek(index?)` | メソッド | ソート後に指定インデックス（省略時: 末尾）を参照             |
| `PQueue#size()`       | メソッド | 要素数を返す                                                 |

### `packages/vibrant-quantizer-mmcq/src/index.ts`

| シンボル                  | 種別     | 説明                                                       |
| ------------------------- | -------- | ---------------------------------------------------------- |
| `MMCQ`                    | 関数     | MMCQ 量子化のメインエントリ。`Swatch[]` を返す             |
| `_splitBoxes(pq, target)` | 内部関数 | PQueue が target サイズになるまでボックスを分割し続ける    |
| `generateSwatches(pq)`    | 内部関数 | PQueue の全 VBox から `avg()` で代表色を取り出し Swatch 化 |
| `fractByPopulations`      | 定数     | `0.75` – Phase1 で使う色数の割合                           |

---

### `packages/vibrant-generator-default/src/index.ts`

| シンボル                         | 種別     | 説明                                                         |
| -------------------------------- | -------- | ------------------------------------------------------------ |
| `GeneratorOptions`               | 型       | スコアリング用の閾値・重みのオプション型                     |
| `DefaultOpts`                    | 定数     | デフォルトの閾値・重み値                                     |
| `DefaultGenerator`               | 関数     | `Swatch[]` → `Palette` のメインエントリ                      |
| `_findMaxPopulation(swatches)`   | 内部関数 | 最大 population 値を返す（スコア正規化に使用）               |
| `_isAlreadySelected(palette, s)` | 内部関数 | パレットにすでに選択済みか確認（同じ Swatch の重複選択防止） |
| `_createComparisonValue(...)`    | 内部関数 | HSL + population の加重平均スコアを計算                      |
| `_findColorVariation(...)`       | 内部関数 | HSL 範囲でフィルタし、最高スコアの Swatch を1つ返す          |
| `_generateVariationColors(...)`  | 内部関数 | 6スロット全てに `_findColorVariation` を実行                 |
| `_generateEmptySwatches(...)`    | 内部関数 | 空スロットを既存スロットの HSL 調整で補完                    |

---

### `packages/vibrant-core/src/index.ts`（`Vibrant` クラス）

| シンボル                        | 種別                 | 説明                                                            |
| ------------------------------- | -------------------- | --------------------------------------------------------------- |
| `Vibrant`                       | クラス               | ライブラリのメインクラス                                        |
| `Vibrant.from(src)`             | 静的メソッド         | `Builder` を返すファクトリ                                      |
| `Vibrant.use(pipeline)`         | 静的メソッド         | グローバルパイプラインを設定                                    |
| `Vibrant.DefaultOpts`           | 静的フィールド       | デフォルトオプション `{ colorCount:64, quality:5, filters:[] }` |
| `Vibrant#getPalette()`          | メソッド             | 画像を処理して `Palette`（6色）を返す                           |
| `Vibrant#getPalettes()`         | メソッド             | 登録された全 Generator の結果をまとめて返す                     |
| `Vibrant#_process(image, opts)` | プライベートメソッド | scaleDown → Pipeline.process の実行                             |

### `packages/vibrant-core/src/builder.ts`（`Builder` クラス）

| メソッド                    | 説明                                    |
| --------------------------- | --------------------------------------- |
| `maxColorCount(n)`          | `colorCount` を設定                     |
| `maxDimension(d)`           | `maxDimension` を設定                   |
| `quality(q)`                | `quality` を設定                        |
| `addFilter(name)`           | フィルタ名を追加                        |
| `removeFilter(name)`        | フィルタ名を削除                        |
| `clearFilters()`            | フィルタをクリア                        |
| `useImageClass(cls)`        | 画像クラスを指定                        |
| `useGenerator(name, opts?)` | Generator を追加                        |
| `useQuantizer(name, opts?)` | Quantizer を設定                        |
| `build()`                   | `Vibrant` インスタンスを返す            |
| `getPalette()`              | `build().getPalette()` のショートカット |

### `packages/vibrant-core/src/pipeline/index.ts`（`BasicPipeline`）

| シンボル                                 | 種別               | 説明                                |
| ---------------------------------------- | ------------------ | ----------------------------------- |
| `BasicPipeline`                          | クラス             | 同期的な3ステージパイプライン       |
| `BasicPipeline#filter`                   | `Stage<Filter>`    | フィルタ関数のレジストリ            |
| `BasicPipeline#quantizer`                | `Stage<Quantizer>` | 量子化器のレジストリ                |
| `BasicPipeline#generator`                | `Stage<Generator>` | 生成器のレジストリ                  |
| `BasicPipeline#process(imageData, opts)` | メソッド           | フィルタ → 量子化 → 生成 を順に実行 |
| `Stage<T>#register(name, fn)`            | メソッド           | 名前付きで関数を登録                |
| `Stage<T>#get(name)`                     | メソッド           | 名前で登録済み関数を取得            |

### `packages/vibrant-core/src/pipeline/worker/`

| ファイル    | クラス/関数             | 説明                                                                      |
| ----------- | ----------------------- | ------------------------------------------------------------------------- |
| `client.ts` | `WorkerPipeline`        | UIスレッド側。Worker に処理を委譲し、結果を `Swatch.clone()` で復元       |
| `host.ts`   | `runPipelineInWorker()` | Worker スレッド側。`onmessage` でパイプラインを実行して結果を postMessage |

---

### `packages/node-vibrant/src/`

| ファイル            | 説明                                                                                |
| ------------------- | ----------------------------------------------------------------------------------- |
| `node.ts`           | Node.js 向けエントリ。`NodeImage` と pipeline を注入して `Vibrant` を再エクスポート |
| `browser.ts`        | ブラウザ向けエントリ。`BrowserImage` と pipeline を注入                             |
| `worker.ts`         | Worker 版ブラウザエントリ。`WorkerPipeline` を使用                                  |
| `configs/config.ts` | 量子化器・生成器・フィルタのデフォルト名を `Vibrant.DefaultOpts` に設定             |
| `pipeline/index.ts` | フィルタ・MMCQ・DefaultGenerator を `BasicPipeline` に登録                          |
