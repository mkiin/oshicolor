# 髪色抽出アルゴリズム 詳細ドキュメント

anicolors における髪色抽出・分類の仕組みを詳しく解説する。
上位ドキュメントは [anicolors-code-map.md](./anicolors-code-map.md) を参照。

---

## 処理フロー全体像

```
ユーザー画像入力（react-dropzone）
    ↓
[Canvas 描画 + ピクセル走査]
    ↓ 8px サンプリング、透明・極端明度を除外
[RGB 量子化] ─ 24 単位でグルーピング
    ↓
[候補色選別] ─ 出現頻度 > 10 の上位 20 色
    ↓
[貪欲法で 5 色選択]（最大色差を維持）
    ↓ ColorPoint[]
[色名解決] getColorName() ─ nearest-color + color-name-list
    ↓
[髪色分類] getHairColorName() ─ HSL 範囲 + LAB 距離ハイブリッド評価
    ↓
Palette.extend.parts.hair へ保存
```

---

## ステップ 1: メインカラー抽出（color-extractor.ts）

**ファイル**: `nextjs/src/components/palette/color-extractor.ts`

### ピクセルサンプリングと量子化

```
全ピクセル走査（8px 間隔）
  ├─ alpha < 128 → スキップ（透明ピクセル）
  ├─ 明度 < 30   → スキップ（極端に暗い色）
  └─ 明度 > 225  → スキップ（極端に明るい色）

量子化: Math.round(value / 24) * 24
  ─ 256³ の RGB 空間を約 11³ に圧縮
  ─ 類似色をひとつのバケツにまとめる
```

> **なぜ 24 単位か**: 精度とパフォーマンスのバランス。8 単位にすると 32³ ≈ 32,000 バケツで精度は上がるが速度が低下する。

### 貪欲法による 5 色選択

1. 候補: 出現頻度 > 10 の上位 20 色
2. 最初に最頻色を選択
3. 以降、**既選色との最小距離が最大**になる色を順次追加
4. 合計 5 色になるまで繰り返す

距離計算（RGB ユークリッド距離）:
```
distance = sqrt((r1-r2)² + (g1-g2)² + (b1-b2)²)
```

---

## ステップ 2: 髪色分類（hair-color/index.ts）

**ファイル**: `nextjs/src/lib/hair-color/index.ts`
**定数**: `nextjs/src/lib/hair-color/constant.ts`

### 定義済み髪色テンプレート（36 種類）

各エントリは HSL 範囲で定義されている。

```typescript
type HairColor = {
  name: string;
  hex_range: [string, string];
  hsl_hue_range: [number, number];        // 色相 0-360°
  hsl_saturation_range: [number, number]; // 彩度 0-100%
  hsl_lightness_range: [number, number];  // 明度 0-100%
};
```

**カテゴリ一覧**:

| カテゴリ | 色名（英語）|
|---|---|
| 中性色 | Black, Ash Brown, Grey/White, Silver Grey, Granny Grey |
| ブラウン系 | Dark Brown, Medium Brown, Light Brown, Chocolate Brown, Caramel Brown |
| ブロンド系 | Golden Blonde, Sandy Blonde, Ash Blonde, Platinum Blonde, Honey Blonde |
| 赤系 | Bright Red, Auburn, Copper Red, Wine Red / Burgundy, Cherry Red |
| 特殊色 | Ocean Blue, Hazy Blue, Dark Green, Lavender Purple, Grape Purple, Barbie Pink, …（計 36 種） |

### スコアリングアルゴリズム（2 段階評価）

#### 段階 1: HSL 範囲チェック

```
入力色を HSL に変換
  ↓
各テンプレートの hsl_*_range と比較
  ↓ 範囲内ならスコア = 1.0（完全一致）
```

#### 段階 2: HSL 距離スコア（範囲外の場合）

```
hue_dist    = 環状最短距離 / 180   (重み 40%)
sat_dist    = |sat - 中心値| / 100  (重み 30%)
light_dist  = |lgt - 中心値| / 100  (重み 30%)

hsl_score = max(0, 1 - (hue_dist×0.4 + sat_dist×0.3 + light_dist×0.3))
```

#### 最終スコア（ハイブリッド評価）

```
nearest-color（KD 木）で最近接候補を複数取得
  ↓
各候補に対して:
  LAB 色差: ΔE = sqrt(ΔL² + Δa² + Δb²)
  lab_score = max(0, 1 - ΔE / 100)

final_score = hsl_score × 0.7 + lab_score × 0.3
  ↓
最大スコアの髪色カテゴリを採用
```

---

## データ構造

### ColorPoint（色点）

```typescript
type ColorPoint = {
  id: number;       // 1-5（表示順）
  x: number;        // 正規化 X 座標（0-384 基準）
  y: number;        // 正規化 Y 座標（0-384 基準）
  color: string;    // "rgb(255, 0, 0)" 形式
  name?: string;    // 色名（"Red" など）
  percent?: number; // パレット内占有率
};
```

### 髪色分類結果

```typescript
type ClassifiedHairColors = Record<
  string, // 髪色カテゴリ名
  {
    name: string;
    colors: string[];  // 該当 Hex 色リスト
    count: number;
  }
>;

type HairColorMatch = {
  name: string;   // "Golden Blonde" など
  score: number;  // 0-1
  hex: string;
};
```

### パーツカラー（Palette.extend.parts）

```typescript
type PartColors = Record<
  // "eye" | "hair" | "skin" | "shirt" | "pants" | "shoes" | "socks" など
  string,
  {
    color: string; // "#FF0000" 形式
    name: string;  // "Red" など
  }
>;
```

---

## 主要な公開関数一覧

| 関数名 | ファイル | シグネチャ | 説明 |
|---|---|---|---|
| `extractMainColors` | color-extractor.ts | `(canvas, img) → ColorPoint[]` | 5 色を自動抽出 |
| `colorDistance` | color-extractor.ts | `([r,g,b], [r,g,b]) → number` | RGB ユークリッド距離 |
| `getColorName` | lib/nearest.ts | `(hex) → {name, hex}` | 最近傍色名を返す |
| `getColorsByKeyword` | lib/nearest.ts | `(keyword) → Color[]` | キーワード検索 |
| `classifyHairColors` | hair-color/index.ts | `(string[]) → ClassifiedHairColors` | 複数色を分類 |
| `getHairColorName` | hair-color/index.ts | `(hex) → string \| null` | 単一色を髪色名に変換 |
| `getMostCommonHairColor` | hair-color/index.ts | `(string[]) → HairColorMatch \| null` | 最頻出髪色を推定 |
| `sortColors` | lib/sort-colors/index.ts | `(string[]) → string[]` | 視覚的自然順にソート |

---

## 座標変換（coordinate-utils.ts）

画像は `object-contain` で表示されるため、4 種の座標系が存在する。

```
Display 座標（マウスイベント）
    ↓ getBoundingClientRect + オフセット計算
ImageContain 座標（object-contain の描画領域内）
    ↓ natural サイズ比でスケール
Canvas 座標（画像の実ピクセル）
    ↓ 384 で除算して正規化
正規化座標（0-384 基準、DB 保存値）
```

> **注意**: 正規化の基準値 `384` はハードコードされている。座標を扱う際は必ず `coordinate-utils.ts` の関数を経由すること。

---

## 使用ライブラリ

| ライブラリ | バージョン | 役割 |
|---|---|---|
| `color` | ^5.0.0 | RGB / HSL / LAB 色空間変換 |
| `nearest-color` | ^0.4.4 | KD 木による最近傍色検索 |
| `color-name-list` | ^11.24.0 | 30,000 色超の色名 DB |
| `quantize` | ^1.0.2 | Median Cut による量子化（Cinematic Palette 用） |
| `use-eye-dropper` | ^1.7.1 | ブラウザ EyeDropper API の React フック |

---

## カスタマイズポイント

| 変更したい内容 | 該当箇所 |
|---|---|
| 髪色カテゴリを追加・変更 | `hair-color/constant.ts` の `HAIR_COLORS` 配列 |
| HSL / LAB スコアの重みを変更 | `hair-color/index.ts` の `calculateMatchScore` 内の係数（現在 0.7 / 0.3） |
| 色抽出の量子化精度を上げる | `color-extractor.ts` の量子化ユニット（現在 24 → 小さくすると精度↑速度↓） |
| サンプリング間隔を変更 | `color-extractor.ts` のサンプリング間隔（現在 8px） |
| パーツ種類を追加 | コンポーネント内の `partsConstant` 配列 |
