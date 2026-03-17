# データフロー・処理の流れ

## API の使い方（ユーザー視点）

```typescript
import Vibrant from "node-vibrant";

const palette = await Vibrant.from("image.jpg")
    .quality(5) // 1/5 にダウンサンプル
    .maxColorCount(64) // 最大64色抽出
    .getPalette();

palette.Vibrant; // → Swatch | null
palette.DarkVibrant; // → Swatch | null
// ...
```

---

## 処理フロー全体図

```
[ユーザーコード]
     │
     │ Vibrant.from(src).getPalette()
     ▼
┌─────────────────────────────────────┐
│  Vibrant#getPalette()               │
│  (packages/vibrant-core/src/index)  │
└──────────────────┬──────────────────┘
                   │ new ImageClass() → load(src)
                   ▼
┌─────────────────────────────────────┐
│  Image#load()                       │
│  (NodeImage or BrowserImage)        │
│                                     │
│  Node.js:  Jimp.read()             │
│  Browser:  <img>.onload + canvas   │
└──────────────────┬──────────────────┘
                   │ 画像ロード完了
                   │
                   │ image.scaleDown(opts)
                   ▼
┌─────────────────────────────────────┐
│  ImageBase#scaleDown()              │
│                                     │
│  quality=5 → ratio = 1/5           │
│  maxDimension設定時 → 長辺に合わせ  │
│  ratio < 1 なら resize() を呼ぶ     │
└──────────────────┬──────────────────┘
                   │ 縮小済み画像
                   │
                   │ image.getImageData()
                   ▼
┌─────────────────────────────────────┐
│  ImageData { data: Uint8ClampedArray, width, height }
│  data = [R,G,B,A, R,G,B,A, ...]    │
│  （ピクセル数 = width × height）    │
└──────────────────┬──────────────────┘
                   │
                   │ pipeline.process(imageData, opts)
                   ▼
┌════════════════════════════════════════════════════════╗
║  BasicPipeline#process()                               ║
║  (packages/vibrant-core/src/pipeline/index)            ║
╠════════════════════════════════════════════════════════╣
║                                                        ║
║  Step 1: フィルタリング                                 ║
║  ┌────────────────────────────────────────────────┐    ║
║  │ applyFilters(imageData, [defaultFilter])       │    ║
║  │                                                │    ║
║  │ 全ピクセルをスキャン:                           │    ║
║  │   a < 125          → alpha を 0 にマーク       │    ║
║  │   R>250&G>250&B>250 → alpha を 0 にマーク      │    ║
║  └────────────────────────────────────────────────┘    ║
║                   │                                    ║
║                   ▼                                    ║
║  Step 2: 量子化（MMCQ）                                ║
║  ┌────────────────────────────────────────────────┐    ║
║  │ MMCQ(pixels, { colorCount: 64 })               │    ║
║  │                                                │    ║
║  │ 2-1. Histogram 構築                            │    ║
║  │      各ピクセルを 5bit 量子化                   │    ║
║  │      hist[index]++ でカウント                  │    ║
║  │      alpha=0 のピクセルはスキップ              │    ║
║  │                                                │    ║
║  │ 2-2. 初期 VBox = 全色を包む矩形               │    ║
║  │                                                │    ║
║  │ 2-3. Phase1（population ソート）               │    ║
║  │      PQueue<VBox> comparator = (a,b) => a.count()-b.count()
║  │      target = floor(0.75 × 64) = 48 ボックスまで分割
║  │                                                │    ║
║  │ 2-4. Phase2（count×volume ソート）             │    ║
║  │      PQueue を再ソート                         │    ║
║  │      comparator = (a,b) => a.count()*a.volume()-b.count()*b.volume()
║  │      target = 残り 16 ボックスまで分割         │    ║
║  │                                                │    ║
║  │ 2-5. 各 VBox.avg() で代表色を計算              │    ║
║  │      → Swatch[] (64個)                         │    ║
║  └────────────────────────────────────────────────┘    ║
║                   │                                    ║
║                   ▼                                    ║
║  Step 3: パレット生成（DefaultGenerator）              ║
║  ┌────────────────────────────────────────────────┐    ║
║  │ DefaultGenerator(swatches)                     │    ║
║  │                                                │    ║
║  │ 3-1. maxPopulation を取得                      │    ║
║  │                                                │    ║
║  │ 3-2. 6スロットを順番に埋める                   │    ║
║  │      各スロット: HSL 範囲フィルタ              │    ║
║  │                 + スコア最大の Swatch を選択   │    ║
║  │                                                │    ║
║  │ 3-3. 空スロットを補完（HSL L調整で合成）       │    ║
║  │      → Palette { Vibrant, DarkVibrant, ... }   │    ║
║  └────────────────────────────────────────────────┘    ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
                   │
                   │ ProcessResult { colors: Swatch[], palettes: {...} }
                   ▼
┌─────────────────────────────────────┐
│  Vibrant#getPalette()               │
│  result1.palettes["default"] を返す │
└──────────────────┬──────────────────┘
                   │
                   ▼
     [ユーザーコード: palette.Vibrant など]
```

---

## VBox.split() の内部フロー

```
VBox { r:[r1..r2], g:[g1..g2], b:[b1..b2] }
          │
          │ rw = r2-r1+1, gw = g2-g1+1, bw = b2-b1+1
          │ maxw = max(rw, gw, bw)
          ▼
  最長次元を選択（例: rw が最大なら r 軸）
          │
          │ 選択軸の累積ピクセル数 accSum[] を計算
          │   accSum[r] = r1 から r までの全ピクセル数の累積
          ▼
  total/2 を超える最初の点 → splitPoint
          │
          │ doCut(axis):
          │   vbox1.dimension.r2 = splitPoint 付近
          │   vbox2.dimension.r1 = splitPoint + 1
          ▼
  [vbox1, vbox2] を返す
```

---

## Worker パイプラインのフロー（ブラウザ）

ブラウザでは Web Worker を使って UI スレッドをブロックしない選択肢がある。

```
[UI スレッド]                    [Worker スレッド]
     │
     │ WorkerPipeline#process(imageData, opts)
     │
     │ WorkerManager#invokeWorker("pipeline", [imageData, opts], [imageData.data.buffer])
     │ ← SharedArrayBuffer で転送（コピー不要）
     │─────────────────────────────────────────→
     │                              onmessage({ id, payload })
     │                              pipeline.process(imageData, opts)
     │                              ← BasicPipeline で同期処理 →
     │                              postMessage({ id, type:"return", payload: result })
     │←─────────────────────────────────────────
     │
     │ _rehydrate(result)
     │   → Swatch.clone() で plain object を Swatch インスタンスに復元
     │
     ▼
  ProcessResult
```

---

## Swatch のデータ構造

```
Swatch {
  _rgb: [r, g, b]          // 0-255
  _population: number      // このボックス内のピクセル数

  // 遅延計算（初回アクセス時に計算してキャッシュ）
  _hsl: [h, s, l]          // h:0-1, s:0-1, l:0-1
  _hex: "#rrggbb"
  _yiq: number             // (r*299 + g*587 + b*114) / 1000
  _titleTextColor: string  // "#fff" or "#000"
  _bodyTextColor: string   // "#fff" or "#000"
}
```

---

## 出力（Palette）のデータ構造

```
Palette {
  Vibrant:      Swatch | null   // 中輝度 × 高彩度
  DarkVibrant:  Swatch | null   // 暗い × 高彩度
  LightVibrant: Swatch | null   // 明るい × 高彩度
  Muted:        Swatch | null   // 中輝度 × 低彩度
  DarkMuted:    Swatch | null   // 暗い × 低彩度
  LightMuted:   Swatch | null   // 明るい × 低彩度
}
```

スロットが `null` になるのは:

- 実際の画像にその特性の色がない場合
- フォールバック合成も不可能だった場合（ごくまれ）
