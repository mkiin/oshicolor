# color-thief vs node-vibrant — 設計・アルゴリズム比較

> 比較対象: `colorthief` v3+ / `node-vibrant` v4+
> ソース: `sample-repo/color-extractors/`

---

## 1. アーキテクチャの違い

| 観点 | color-thief | node-vibrant |
|---|---|---|
| パッケージ構成 | シングルパッケージ | モノレポ（12パッケージ） |
| Node.js 画像デコード | **sharp** | **Jimp** |
| ブラウザ画像デコード | Canvas API | Canvas API |
| 言語 | TypeScript（zero runtime deps） | TypeScript |
| WASM 対応 | あり（`WasmQuantizer`） | なし |
| Web Worker 対応 | あり（`worker: true`） | あり（`WorkerPipeline`） |
| CLI | あり（`colorthief-cli`） | なし |

### パイプライン構造

**node-vibrant**: プラグイン可能な 3 ステージ構成

```
Filter（ピクセル除外） → Quantizer（量子化） → Generator（スウォッチ生成）
各ステージは name で登録・差し替え可能
```

**color-thief**: 関数型の直線パイプライン

```
サンプリング → [OKLCH変換] → MMCQ量子化 → [OKLCH逆変換] → Color[] / SwatchMap
```

---

## 2. MMCQ アルゴリズムの実装差異

両ライブラリとも MMCQ（Modified Median Cut Quantization）を採用しているが、
細部に違いがある。

### 共通の基本フロー

```
1. ピクセルを 5bit 量子化 → ヒストグラム構築（32^3 = 32,768 エントリ）
2. 全ピクセルを包む初期 VBox を生成
3. Phase 1: count ソートで VBox を 0.75N 個まで分割
4. Phase 2: count × volume ソートで N 個まで分割
5. 各 VBox の加重平均色を返す
```

### 差異

| 観点 | color-thief | node-vibrant |
|---|---|---|
| ループ制御 | `MAX_ITERATIONS = 1000`（反復上限） | 収束チェック（`pq.size() === lastSize` で break） |
| ショートカット | ユニーク色数 ≤ maxColors のとき直接返す | なし |
| Phase 2 の目標 | `maxColors - currentSize` 追加分 | ソースを読むと同様 |

**color-thief の収束チェックなし問題:**
node-vibrant は `lastSize` を監視して分割が進まなければ強制終了するが、
color-thief はイテレーション上限（1000回）のみで制御する。
実用的な画像では差は出ないが、理論上 color-thief の方がループが長くなりうる。

---

## 3. 量子化色空間（最大の差異）

### node-vibrant: RGB 空間で量子化

```
ピクセル（RGB）
  → MMCQ（RGB 空間）
  → Swatch[]（RGB/HSL のみ）
```

RGB 空間での量子化は計算が単純だが、知覚的に不均等。
青緑と赤の中間を "等距離" で扱うが、人間の目にはそう見えない。

### color-thief: OKLCH 空間で量子化（デフォルト）

```
ピクセル（RGB）
  → RGB → OKLab → OKLCH
  → スケーリング（L/C/H それぞれ 0-255 に正規化）
  → MMCQ（OKLCH 空間）
  → 逆スケール → OKLCH → RGB
  → Color[]
```

OKLCH（Oklab の円筒座標系）は知覚的均等色空間。
同じ「距離」が人間の目にも均等に見える差として現れるため、
**パレットがより多様に、かつ知覚的に意味のある色になる**。

スケーリング係数:

```typescript
// L (0-1) → 0-255
Math.round(l * 255)
// C (0-0.4) → 0-255
Math.round((c / 0.4) * 255)
// H (0-360) → 0-255
Math.round((h / 360) * 255)
```

---

## 4. スウォッチ分類の違い

MMCQ で得た代表色群から 6 スロットへの割り当ては **2段階**で行われる。

```
① 絞り込み（範囲フィルター）
   輝度・彩度が各スロットの許容範囲内にある色だけを候補とする

② スコアリング（最良選択）
   候補の中から「目標値に最も近い色」をスコアで選ぶ
```

### 6スロットの意味

各スロットは「明るさ（Dark / Normal / Light）」×「鮮やかさ（Vibrant / Muted）」の組み合わせ。

| スロット | 明るさ | 鮮やかさ | 色のイメージ |
|---|---|---|---|
| Vibrant | 中間 | 鮮やか | キャラの代表色・メインカラー |
| DarkVibrant | 暗い | 鮮やか | 影・アクセント |
| LightVibrant | 明るい | 鮮やか | ハイライト・発光色 |
| Muted | 中間 | くすんだ | 背景・落ち着いたトーン |
| DarkMuted | 暗い | くすんだ | 暗部・深み |
| LightMuted | 明るい | くすんだ | 明るい背景・淡色 |

---

### node-vibrant の分類基準（HSL 空間）

**① 範囲フィルター**（HSL の L と S で絞り込む）

| スロット | 輝度(L)の許容範囲 | 彩度(S)の許容範囲 |
|---|---|---|
| Vibrant | 0.30–0.70 | 0.35–1.0 |
| DarkVibrant | 0.00–0.45 | 0.35–1.0 |
| LightVibrant | 0.55–1.00 | 0.35–1.0 |
| Muted | 0.30–0.70 | 0.00–0.4 |
| DarkMuted | 0.00–0.45 | 0.00–0.4 |
| LightMuted | 0.55–1.00 | 0.00–0.4 |

**② スコアリング**（範囲内の候補から目標値に最も近いものを選ぶ）

```
score = 輝度の近さ × 6.5
      + 彩度の近さ × 3.0
      + 画像内の占有率 × 0.5
```

重みの意図：**輝度 > 彩度 >> 占有率** の優先度。
占有率（その色が画像中に多く出現するか）はほぼ影響しない。
「正しい明暗・彩度の色」を選ぶことを最優先にした設計。

---

### color-thief の分類基準（OKLCH 空間）

**① 範囲フィルター**（OKLCH の L と C で絞り込む）

範囲外の色は即座に失格（スコア `-Infinity`）。

| スロット | 明度(L)の許容範囲 | 彩度(C)の最小値 |
|---|---|---|
| Vibrant | 0.40–0.85 | 0.08（くすみすぎを除外） |
| DarkVibrant | 0.00–0.45 | 0.08 |
| LightVibrant | 0.70–1.00 | 0.08 |
| Muted | 0.40–0.85 | 0.00（くすんだ色も許容） |
| DarkMuted | 0.00–0.45 | 0.00 |
| LightMuted | 0.70–1.00 | 0.00 |

**② スコアリング**（範囲内の候補から目標値に最も近いものを選ぶ）

```
score = 明度の近さ × 6
      + 彩度の近さ × 3
      + 画像内の占有率 × 1
```

重みの構造は node-vibrant と同じ設計思想（明度優先）だが、
OKLCH は知覚的均等色空間なので「明度の近さ」が人間の感覚とより一致する。

---

### 競合解決（同じ色が複数スロットで最高スコアになった場合）

**node-vibrant**: スロットを固定順（Vibrant → LightVibrant → DarkVibrant → Muted → LightMuted → DarkMuted）に処理し、先に選ばれたスロットが優先。同じ色は2度使えない。

**color-thief**: 全スロット × 全色のスコアをまとめて計算し、スコア降順で 1 対 1 に割り当て。競合時は次点の色を探す。順番に依存せず、常に最高スコアのペアが確定する。

---

### 空スロットへの対応

**node-vibrant**: 条件を満たす色がなくスロットが空になった場合、**合成色を生成して補完する**。

```
例: Vibrant が空で DarkVibrant がある場合
  → DarkVibrant の 色相(H)・彩度(S) はそのまま
  → 明度(L) だけ中間値（0.5）に変えた合成色を Vibrant に入れる
```

実画像で必ずすべてのスロットが埋まることを保証する設計。

**color-thief**: 補完なし。条件を満たす色がなければそのスロットは **`null`**。

---

## 5. テキスト色判定の違い

| 観点 | color-thief | node-vibrant |
|---|---|---|
| 計算式 | WCAG 相対輝度（sRGB 線形化） | YIQ 公式 |
| 閾値 | `luminance <= 0.179` → 黒背景に白文字 | `YIQ < 200` → 白文字 / `YIQ < 150` → 白文字（body） |
| title / body 区別 | なし（`.textColor` 1つ） | あり（`titleTextColor` / `bodyTextColor`） |
| 準拠規格 | WCAG 2.x | — |

**node-vibrant の YIQ 公式:**

```
YIQ = (R×299 + G×587 + B×114) / 1000
```

**color-thief の WCAG 相対輝度:**

```
luminance = 0.2126×linearR + 0.7152×linearG + 0.0722×linearB
isDark = luminance <= 0.179
```

---

## 6. 出力型の比較

### node-vibrant: `Swatch` クラス

```typescript
class Swatch {
  rgb: Vec3                  // [r, g, b]
  hsl: Vec3                  // [h, s, l]
  hex: string                // '#rrggbb'
  population: number         // ピクセル数
  titleTextColor: string     // '#fff' or '#000'（YIQ, 閾値200）
  bodyTextColor: string      // '#fff' or '#000'（YIQ, 閾値150）
}
```

### color-thief: `Color` インターフェース

```typescript
interface Color {
  rgb(): { r, g, b }
  hex(): string
  hsl(): { h, s, l }
  oklch(): { l, c, h }        // ← node-vibrant にない
  css(format?): string        // 'rgb' / 'hsl' / 'oklch'
  array(): [r, g, b]
  textColor: string           // WCAG 基準
  isDark: boolean
  isLight: boolean
  contrast: {                 // ← node-vibrant にない
    white: number             // WCAG コントラスト比
    black: number
    foreground: Color
  }
  population: number
  proportion: number          // ← node-vibrant にない（0-1の相対比率）
}
```

---

## 7. 機能比較

| 機能 | color-thief | node-vibrant |
|---|---|---|
| 同期 API（ブラウザ） | あり（`getColorSync` 等） | なし（常に非同期） |
| プログレッシブ抽出 | あり（`getPaletteProgressive`、3パス） | なし |
| リアルタイム監視 | あり（`observe`） | なし |
| AbortSignal | あり | なし |
| WASM 量子化器 | あり（オプション） | なし |
| 空スロット補完 | なし | あり |
| colorCount デフォルト | `10`（最終パレット数） | `64`（中間生成数） |
| quality デフォルト | `10`（10ピクセルごとにサンプリング） | `5`（1/5 にリサイズ） |

---

## 8. oshicolor における選択の観点

### node-vibrant を採用した理由

1. **空スロット補完**: node-vibrant はモノクロ・低彩度画像でも 6 スロットを埋める合成ロジックを持つ。
   カラースキーム生成には全スロットが必要なため重要。

2. **HSL ベース分類の実績**: Vibrant.js 互換の分類システムは多くのプロジェクトで使われており、
   直感的な Hue/Saturation/Lightness による理解がしやすい。

3. **colorCount=64**: より多くの中間色から 6 スロットを選ぶため、適合度が高い色が見つかりやすい。

### color-thief が優れている点

1. **OKLCH 量子化**: 知覚的均等色空間での量子化により、多様で視覚的に意味のあるパレットが得られる。

2. **Color オブジェクトの豊富な情報**: OKLCH 値・WCAG コントラスト比・proportion が直接取得できる。
   oshicolor の R2（カラーマッピング）では OKLCH の L/C/H 値による Hue ゾーンスコアリングを使うため、
   この情報は有用。

3. **プログレッシブ抽出・observe**: UX 向上に直結する機能。

### 将来的な移行検討

color-thief の OKLCH ベースの Color オブジェクトは oshicolor の設計（R2 の OKLCH スコアリング）と
親和性が高い。ただし補完ロジックが必要な場合は自前実装が必要になる。
