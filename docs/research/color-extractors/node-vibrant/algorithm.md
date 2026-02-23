# アルゴリズム解説

## 全体像

node-vibrant は2つの主要アルゴリズムで動いている。

1. **MMCQ（Modified Median Cut Quantization）** – 画像から N 個の代表色を抽出する
2. **DefaultGenerator（スコアリング分類）** – N 個の代表色を 6 つの名前付きスロットへ割り当てる

---

## 1. MMCQ（Modified Median Cut Quantization）

ソース: `packages/vibrant-quantizer-mmcq/src/`

### 概念

RGB 色空間（3次元）を再帰的に矩形領域（VBox）に分割し、
最終的に N 個のボックスができたとき、各ボックスの加重平均色を代表色とする。

> アンドリュー・ジャービスが 1982 年に発表した "Median Cut" の改良版。
> 分割の優先度を2段階に分けて、多様性と重要度のバランスを取る。

### ステップ詳細

#### Step 0: 前処理（Histogram 構築）
```
ピクセル配列（RGBA 4バイト×N個）
  ↓
各ピクセルを 8bit → 5bit に量子化（右シフト3ビット）
  RGB の取りうる値: 0～31（32段階）
  ↓
3次元配列を1次元インデックスに変換
  index = (r << 10) + (g << 5) + b
  配列サイズ = 2^(5×3) = 32768
  ↓
各インデックスの出現回数を Uint32Array hist[] に記録
  ↓
R/G/B 各チャンネルの min/max を記録
```

量子化を 5bit にする理由:
- 8bit のままだと 256^3 = 16,777,216 通りで処理が重い
- 5bit なら 32^3 = 32,768 通りに削減でき、高速かつ十分な精度

#### Step 1: 初期 VBox 生成
```
Histogram の rmin/rmax, gmin/gmax, bmin/bmax から
全色を内包する1つの VBox を作る

例: r[2..28], g[5..25], b[0..30]
```

#### Step 2: Phase 1 – 人口ベース分割（75%分）
```
目標色数 N = 64（デフォルト）
Phase1 目標 = floor(0.75 × 64) = 48 ボックス

PQueue（ソート基準: count の降順）に初期 VBox をプッシュ

ループ:
  1. PQueue から最も count の多い VBox を取り出す
  2. VBox を split()（後述）で2つに分割
  3. 2つの VBox を PQueue に戻す
  4. PQueue のサイズが 48 になったら終了
```

分割の優先度が count のみなのは、まず「色が多い領域を優先的に分割」するため。
これにより主要色が多いエリアから代表色が多く選ばれる。

#### Step 3: Phase 2 – count × volume ベース分割（残り25%分）
```
Phase2 目標 = 64 - 48 = 16 ボックス追加

PQueue を新しい比較関数で再ソート
  ソート基準: count × volume の降順

ループ:
  1. count × volume が最大の VBox を取り出す
  2. split() で分割
  3. PQueue に戻す
  4. 合計サイズが 64 になったら終了
```

count × volume の意味:
- count だけ高くてもボックスが小さければ分割価値が低い
- volume だけ大きくても色が少なければ分割しても意味がない
- 両方大きいボックス（重要かつ多様性が高い）を優先して分割

#### Step 4: VBox.split()
```
1. r幅・g幅・b幅を計算 → 最も広い次元を選択

2. 選択した次元で累積ピクセル数 accSum[] を計算
   例: r軸を選んだ場合
     for r = r1 to r2:
       accSum[r] = そこまでの合計ピクセル数

3. 累積ピクセル数が total/2 を超える点 → splitPoint

4. doCut(): splitPoint 前後でボックスを2分割
   - vbox1: dimension.r2 = splitPoint 付近
   - vbox2: dimension.r1 = splitPoint + 1

   ※ 左右どちらが広いかで分割位置を微調整（片方が極端に薄くならないように）
```

#### Step 5: VBox.avg() – 代表色の計算
```
ボックス内の全色について:
  加重平均 = Σ(ピクセル数 × 色値) / Σ(ピクセル数)

  rsum += hist[index] × (r + 0.5) × mult
  ※ (r + 0.5) はビン中央値, mult = 2^(8-5) = 8 で8bit空間に戻す

結果: [rAvg, gAvg, bAvg] を返す
```

#### Step 6: Swatch 化
```
各 VBox について:
  new Swatch(vbox.avg(), vbox.count())
```

これで N 個の `Swatch` 配列が得られる。

### 計算量

| ステップ | 計算量 |
|---|---|
| Histogram 構築 | O(P)  P=ピクセル数 |
| Phase1 分割ループ | O(N × B)  N=色数, B=ヒストグラムサイズ/ボックス |
| Phase2 分割ループ | O(N × B) |
| avg() 計算 | O(B) per box |

スケールダウン（quality=5 → 1/5 サイズ）があるため、P は実質的に元画像の 1/25 程度。

---

## 2. DefaultGenerator（スコアリング分類）

ソース: `packages/vibrant-generator-default/src/index.ts`

### 概念

MMCQ が返した N 個の Swatch を HSL（色相・彩度・輝度）空間で評価し、
6つの名前付きパレットスロットに最も適した色を1つずつ選ぶ。

```
Vibrant      = 中輝度 × 高彩度
DarkVibrant  = 暗い   × 高彩度
LightVibrant = 明るい × 高彩度
Muted        = 中輝度 × 低彩度
DarkMuted    = 暗い   × 低彩度
LightMuted   = 明るい × 低彩度
```

### スロット定義

| スロット | 輝度(L)範囲 | 目標輝度 | 彩度(S)範囲 | 目標彩度 |
|---|---|---|---|---|
| Vibrant | 0.3 ～ 0.7 | 0.5 | 0.35 ～ 1.0 | 1.0 |
| DarkVibrant | 0 ～ 0.45 | 0.26 | 0.35 ～ 1.0 | 1.0 |
| LightVibrant | 0.55 ～ 1.0 | 0.74 | 0.35 ～ 1.0 | 1.0 |
| Muted | 0.3 ～ 0.7 | 0.5 | 0 ～ 0.4 | 0.3 |
| DarkMuted | 0 ～ 0.45 | 0.26 | 0 ～ 0.4 | 0.3 |
| LightMuted | 0.55 ～ 1.0 | 0.74 | 0 ～ 0.4 | 0.3 |

### スコアリング式

各候補 Swatch のスコア = 加重平均（Weighted Mean）で計算。

```
score = weightedMean(
  (1 - |S - targetS|),  weightSaturation,    // 彩度の近さ × 3
  (1 - |L - targetL|),  weightLuma,          // 輝度の近さ × 6.5
  population / maxPopulation, weightPopulation  // 人口比 × 0.5
)
```

**重みのバランスから読み取れる設計意図:**
- 輝度（6.5）> 彩度（3）> 人口（0.5） の優先度
- 人口はほぼ無視に近い → 多い色より適切な色を優先する
- 人口が大きければわずかにボーナスが付く程度

#### 加重平均の計算式

```
weightedMean(v1, w1, v2, w2, v3, w3)
  = (v1×w1 + v2×w2 + v3×w3) / (w1 + w2 + w3)
```

各 v（0～1 の値）に重み w を掛けた正規化平均。

### 選択プロセス

```
1. swatches の中から最大 population を取得（正規化用）

2. 6スロットを順番に埋める（Vibrant → LightVibrant → DarkVibrant → Muted → LightMuted → DarkMuted）

3. 各スロットで _findColorVariation() を呼ぶ:
   - HSL 範囲を満たす候補を絞り込む
   - すでに他スロットで選ばれた Swatch は除外
   - スコアが最高の Swatch を選ぶ

4. 空スロットの補完（_generateEmptySwatches）:
   Vibrant が空 && DarkVibrant が選ばれている場合:
     DarkVibrant の H/S を保持し L を targetNormalLuma に変更
     → 合成 Swatch として Vibrant を埋める（population=0）
```

### 補完ロジック（フォールバック）

実際の画像によってはスロットが埋まらない場合がある（例: モノクロ画像では高彩度色がない）。
その場合は既存の近いスロットから HSL の L 値だけを変えて合成色を作る。

```
補完優先度:
Vibrant ← DarkVibrant の L を targetNormalLuma に変更
DarkVibrant ← Vibrant の L を targetDarkLuma に変更
LightVibrant ← Vibrant の L を targetLightLuma に変更
Muted ← Vibrant の S を targetMutesSaturation に変更（※ L を使っているが変数名が混乱している）
DarkMuted ← DarkVibrant の L を targetMutesSaturation に変更
LightMuted ← LightVibrant の L を targetMutesSaturation に変更
```

---

## テキスト色判定（YIQ 公式）

`Swatch#titleTextColor` / `Swatch#bodyTextColor` で使われる YIQ は
人間の視覚特性に基づいた輝度計算。

```
YIQ = (R × 299 + G × 587 + B × 114) / 1000

YIQ < 200 → "#fff"（白文字）  titleTextColor
YIQ < 150 → "#fff"（白文字）  bodyTextColor
それ以外 → "#000"（黒文字）
```

RGB の重みが `0.299 : 0.587 : 0.114` と緑が最大なのは、
人間の目が緑に最も感度が高いため。

---

## 色差計算（Delta E 94）

テスト時に「抽出した色が期待値に近いか」を確認するために使われる。

```
RGB → XYZ（ガンマ補正含む線形化）→ CIE L*a*b*（知覚的に均等な空間）

ΔE94 = √( (ΔL/kL)² + (ΔC/(kC × SC))² + (ΔH/(kH × SH))² )

SC = 1 + 0.045 × C1
SH = 1 + 0.015 × C1
```

| ΔE94 値 | 知覚 |
|---|---|
| ≤ 1.0 | 肉眼では区別できない（Perfect） |
| 1 ～ 2 | 注意深く見れば分かる（Close） |
| 2 ～ 10 | 一見で分かる（Good） |
| 11 ～ 49 | 似ているが違う（Similar） |
| ≥ 50 | 明確に異なる（Wrong） |

---

## デフォルトフィルタ

```typescript
// node-vibrant/packages/node-vibrant/src/pipeline/index.ts
(r, g, b, a) => a >= 125 && !(r > 250 && g > 250 && b > 250)
```

| 条件 | 理由 |
|---|---|
| `a >= 125` | 半透明以下のピクセルを除外（透過部分が色に影響しないように） |
| `!(r > 250 && g > 250 && b > 250)` | ほぼ白色を除外（背景の白が支配的な色として選ばれないように） |
