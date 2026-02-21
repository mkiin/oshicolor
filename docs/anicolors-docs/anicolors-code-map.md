# AniColors 色抽出システム - コードガイドマップ

Claude Codeへの引き渡し用ドキュメント。色抽出に関連するファイルと、その役割・原理をまとめたもの。

---

## 全体アーキテクチャ

このプロジェクト（AniColors）は、アニメ画像からカラーパレットを抽出・生成するWebアプリ。色抽出には**2つの独立したアプローチ**が存在する。

1. **手動ピッカー方式** - ユーザーが画像上のポイントをドラッグして色を拾う
2. **自動量子化方式** - 画像全体をスキャンし、支配的な色を自動抽出する

---

## コアファイル一覧

### 1. 手動ピッカー系（Canvas + ピクセル読み取り）

#### `nextjs/src/components/palette/picker-colors.tsx`
- **役割**: メインの色ピッカーUIコンポーネント
- **原理**: 画像をCanvasに描画し、ユーザーがドラッグした座標のピクセル色を `getImageData` で取得
- **主要機能**:
  - `getPixelColor(x, y)` - Canvas上の任意座標からRGB値を読み取り
  - `updateCanvas()` - 画像をCanvasに描画（`naturalWidth/Height`で原寸描画）
  - `updateMagnifier(x, y)` - 10x10ピクセル領域を150x150に拡大表示する虫眼鏡
  - `getNormalizedPosition()` / `getDisplayPosition()` - 表示座標と正規化座標（384基準）の相互変換
  - マウスドラッグでポイント移動、リアルタイムで色を更新
- **型定義**: `ColorPoint` （id, x, y, color, name）がここで定義されている

#### `nextjs/src/components/palette/coordinate-utils.ts`
- **役割**: object-contain表示時の座標変換ユーティリティ
- **原理**: 画像のアスペクト比とコンテナサイズから、実際の描画領域（offset, renderSize）を計算
- **主要関数**:
  - `getImageContainRect()` - コンテナ内での画像の実描画領域を算出
  - `getNormalizedPosition()` - 表示座標→正規化座標（384基準）
  - `calculateColorPointPosition()` - Canvas座標→コンテナ表示座標→正規化座標

#### `nextjs/src/components/palette/color-extractor.ts`
- **役割**: 画像から自動的に主要色を抽出するアルゴリズム（手動ピッカーの「自動抽出」ボタン用）
- **原理**:
  1. 8px間隔でピクセルをサンプリング
  2. 透明度128未満、明度30未満/225超の色を除外
  3. RGB各チャンネルを24単位で量子化してグルーピング
  4. 出現頻度でソートし上位20色を候補に
  5. **貪欲法（Greedy Algorithm）**で色空間上の距離が最大になるよう色を選択
- **距離計算**: ユークリッド距離（RGB空間の `sqrt((r1-r2)^2 + (g1-g2)^2 + (b1-b2)^2)`）
- **出力**: `ColorPoint[]`（位置情報付き）

### 2. 自動量子化方式（Median Cut / quantize ライブラリ）

#### `nextjs/src/app/tools/[slug]/tools/create-cinematic-color-palettes-with-colorpalette-cinema/utils.ts`
- **役割**: Cinematic Palette生成ツール用の色抽出
- **原理**: `quantize` ライブラリ（Median Cut アルゴリズム）を使用
  1. Canvas上の全ピクセルを4px間隔でサンプリング
  2. 透明ピクセル（alpha < 125）を除外
  3. `quantize(pixels, colorCount + 1)` でMedian Cut量子化
  4. 各クラスタのピクセル数をカウントして占有率（%）を算出
  5. `sortColors()` で色をソートして返却
- **依存**: `quantize` パッケージ（npm）

#### `nextjs/src/app/tools/[slug]/tools/create-cinematic-color-palettes-with-colorpalette-cinema/index.tsx`
- **役割**: Cinematic Paletteツールの画面コンポーネント
- **機能**: 複数画像の一括処理、12色抽出、パレットカードの表示・保存

### 3. 色名前解決（Nearest Color）

#### `nextjs/src/lib/nearest.ts`
- **役割**: HEX値から最も近い色名を返すユーティリティ
- **原理**: `nearest-color` ライブラリ + `color-name-list`（30,000色以上の名前リスト）
- **主要関数**:
  - `getColorName(hex)` - HEX→最近傍の色名
  - `getHexByName(name)` - 色名→HEX（精密/模糊マッチ）
  - `getColorsByKeyword(keyword)` - キーワードで色を検索

#### `nextjs/src/lib/sort-colors/index.ts`
- **役割**: 色の配列を視覚的に自然な順序にソート
- **原理**: `nearest-color` で各色をCSS標準色に分類し、カテゴリ順（黒→赤→橙→黄→緑→青→紫→ピンク→茶）でソート。同カテゴリ内は距離順。

#### `nextjs/src/lib/sort-colors/color-name.ts`
- **役割**: CSS標準色名のHEX定義とソート順序定義
- **内容**: `colorNames`（140色のHEXマップ）と `colorNameOrder`（ソート優先度の数値マップ）

### 4. 髪色分類（特殊用途）

#### `nextjs/src/lib/hair-color/index.ts`
- **役割**: アニメキャラクターの髪色をカテゴリ分類する専用ライブラリ
- **原理**:
  1. 髪色定数（HSL範囲ベース）から代表色パレットを生成
  2. `nearest-color` で入力色を最寄りの髪色カテゴリにマッチ
  3. HSL範囲チェック + HSL/LAB距離のスコアリング（HSL 70% + LAB 30%の重み）
- **主要関数**:
  - `classifyHairColors(hexColors[])` - 複数色を髪色カテゴリに分類
  - `getHairColorName(hex)` - 単一色の髪色名を返す
  - `getMostCommonHairColor(hexColors[])` - 最頻出の髪色カテゴリを返す

#### `nextjs/src/lib/hair-color/constant.ts`
- **役割**: 髪色の定義データ（HSL範囲、HEX範囲）
- **内容**: `HAIR_COLORS` 配列（各髪色のname, hsl_hue_range, hsl_saturation_range, hsl_lightness_range, hex_range）

### 5. SVG色変更ツール

#### `nextjs/src/app/tools/[slug]/tools/change-svg-color/index.tsx`
- **役割**: SVGファイル内の色属性を検出・編集するツール
- **原理**: 正規表現でfill/stroke/stop-colorなどの属性値を抽出し、ユーザーが色を変更するとSVG文字列を直接置換
- **対応属性**: fill, stroke, stop-color, flood-color, lighting-color

### 6. 文字列→色変換ツール

#### `nextjs/src/app/tools/[slug]/tools/what-color-is-my-name/utils.ts`
- **役割**: 任意の文字列から一意な色を生成
- **原理**:
  1. まず `getHexByName()` で色名として検索
  2. 見つからなければ3種のハッシュ関数（djb2, sdbm, 位置加味）を合成
  3. 黄金比で色相を分散、飽和度65-95%、明度45-65%の範囲でHSL色を生成

### 7. 統合コンポーネント

#### `nextjs/src/components/palette/generator.tsx`
- **役割**: PickerColorsとChooseImageを統合するメインジェネレータ
- **機能**: 画像アップロード→自動色抽出→手動調整の一連のフローを管理

#### `nextjs/src/components/palette/picker-part.tsx`
- **役割**: キャラクターの部位別色ピッカー（目・髪・肌・服など）
- **原理**: ブラウザのEyeDropper APIを使用（`use-eye-dropper` ライブラリ経由）

#### `nextjs/src/components/palette/picker-palette.tsx`
- **役割**: PickerColorsのラッパー。色ポイントの追加・削除UIを含む

---

## 主要依存パッケージ（色関連）

| パッケージ | 用途 |
|---|---|
| `quantize` | Median Cutアルゴリズムによる色量子化 |
| `nearest-color` | HEX色から最近傍の名前付き色を検索 |
| `color-name-list` | 30,000色超の色名データベース |
| `color` | 色空間変換（RGB/HSL/LAB等） |
| `use-eye-dropper` | ブラウザEyeDropper APIのReactフック |

---

## データフロー概要

```
画像アップロード
  │
  ├─→ [Canvas描画] → picker-colors.tsx
  │     │
  │     ├─→ [自動抽出] → color-extractor.ts（量子化+貪欲法）
  │     │     └─→ ColorPoint[] (位置+色+名前)
  │     │
  │     └─→ [手動ピック] → getPixelColor() → getImageData()
  │           └─→ ColorPoint 更新
  │
  ├─→ [Cinematic Palette] → utils.ts（quantizeライブラリ）
  │     └─→ {hex, rgb, percent}[]
  │
  └─→ [色名解決] → nearest.ts → getColorName()
        └─→ 表示名付きColorPoint

色の後処理:
  ColorPoint[] → sort-colors/ でソート
               → hair-color/ で髪色分類
               → カードコンポーネントで表示・エクスポート
```

---

## 修正時の注意点

- `ColorPoint` の正規化座標は **384基準**（`x/384`, `y/384`で0-1に変換）。この定数がハードコードされている。
- `color-extractor.ts` の量子化ステップ（24単位）とサンプリング間隔（8px）はパフォーマンスと精度のトレードオフ。
- `quantize` ライブラリは `colorCount + 1` で呼ぶ設計になっている（最初の1色が背景色として除外される想定）。
- `nearest-color` は `{name: hex}` のフラットオブジェクトを受け取る。髪色分類では独自パレットを生成して渡している。
