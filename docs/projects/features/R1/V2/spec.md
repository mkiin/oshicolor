# R2 色抽出 V2: colorthief + K-means Color Axes

## 概要

V1（`extract-colors`）から `colorthief` ライブラリに移行し、色抽出パイプラインを刷新した。
単一パレット出力から **4種類の色情報を並列抽出** する構成に変更し、さらに **K-means クラスタリング** でキャラクターの色軸（main/sub/accent）を導出する機能を追加した。

---

## V1 → V2 変更対照表

| 項目               | V1（extract-colors）                        | V2（colorthief + K-means）                                       |
| ------------------ | ------------------------------------------- | ---------------------------------------------------------------- |
| 色抽出ライブラリ   | `extract-colors` v4.2.1                     | `colorthief` v3.3.1                                              |
| 出力               | パレット 12色（area 降順）                  | ドミナント(1) + パレット(16) + スウォッチ(6) + 色軸(3クラスタ)   |
| サンプリング       | `pixels: 40_000`（ライブラリ自動計算）      | `quality: 10`（10px 間隔サンプリング）                           |
| クラスタリング     | RGB 距離マージ → HSL 距離マージの2段階      | colorthief 内部 MMCQ → K-means(OkLch 色相)                       |
| 色選択             | area 降順スライス                           | colorthief の prominence 順 + K-means role 割り当て              |
| 色名解決           | culori + color-name-list（OKLab 距離）      | なし（V2 では削除）                                              |
| 座標情報           | `x: 0, y: 0` 固定（ライブラリ非対応）      | 型から削除                                                       |
| 色空間変換         | extract-colors 内部（RGB/HSL）              | culori（OkLch）で彩度・明度フィルタ                              |
| 状態管理           | ―                                           | Jotai atoms（非同期 atom + Suspense）                            |

---

## アーキテクチャ

### Atom 依存グラフ

```
fileAtom (File | null)
    │
    ├─→ previewUrlAtom ─→ プレビュー画像URL
    │
    ├─→ colorAtom ──────→ ドミナントカラー (1色)
    │
    ├─→ colorPaletteAtom ─→ パレット (16色)
    │       │
    │       └─→ colorAxesAtom ─→ 色軸 (main/sub/accent)
    │
    └─→ colorSwatchesAtom ─→ スウォッチ (6色)
```

各 async atom は独立して `createImageBitmap` → colorthief を実行する。`colorAxesAtom` のみ `colorPaletteAtom` に依存する。

---

## 抽出パイプライン

### Phase 1: 画像入力

```typescript
const bitmap = await createImageBitmap(file);
```

Web API の `createImageBitmap` でデコード。Canvas は使わない。

### Phase 2: colorthief による3種の抽出（並列）

| 出力           | API                          | オプション                          | 結果           |
| -------------- | ---------------------------- | ----------------------------------- | -------------- |
| ドミナント     | `getColor(bitmap, opts)`     | `OPTIONS_BASE`（colorCount なし）   | `Color` 1色    |
| パレット       | `getPalette(bitmap, opts)`   | `OPTIONS`（colorCount: 16）         | `Color[]` 16色 |
| スウォッチ     | `getSwatches(bitmap, opts)`  | `OPTIONS`（colorCount: 16）         | `SwatchMap` 6色 |

#### OPTIONS の構成

```typescript
const OPTIONS_BASE = {
  quality: 10,        // 10px間隔サンプリング
  colorSpace: "rgb",
  ignoreWhite: true,  // 白を無視
  minSaturation: 0.05,
};
const OPTIONS = { ...OPTIONS_BASE, colorCount: 16 };
```

**注意**: `getColor` は内部で `colorCount: 5` を使う。`OPTIONS_BASE` を渡すこと（`OPTIONS` を渡すと 5 が上書きされる）。

### Phase 3: Color Axes 導出（K-means クラスタリング）

パレット 16色から **キャラクターの色の軸** を導出する。

#### Step 1: OkLch フィルタ

パレットの各色を `culori` で OkLch に変換し、無彩色・暗色を除外。

```
除外条件:
  - 彩度 (chroma) < 0.02  → 無彩色（グレー系）
  - 明度 (lightness) < 0.2 → 極暗色
```

#### Step 2: 色相の2D座標化

色相は円環値（0°〜360°）であり、ユークリッド距離では正しく計算できない。
`cos(H)` / `sin(H)` で2次元ベクトルに変換し、K-means に入力する。

```
H = 30° → (cos30°, sin30°) = (0.87, 0.50)
H = 350° → (cos350°, sin350°) = (0.98, -0.17)
```

#### Step 3: K-means 実行

```typescript
kmeans(huePoints, 3, {
  initialization: "kmeans++",
  seed: 42,           // 再現性のための固定シード
});
```

3つの色相グループにクラスタリングする。

#### Step 4: Role 割り当て

各クラスタに **支配度スコア** を計算し、降順で main / sub / accent を割り当てる。

```
スコア = Σ(colorCount - idx)

例: パレット16色、クラスタに idx=0, idx=3 の2色が含まれる場合
  スコア = (16 - 0) + (16 - 3) = 16 + 13 = 29
```

パレット上位（面積が大きい色）ほどウェイトが高くなり、色数が多いクラスタほどスコアが大きくなる。

---

## 型定義

### ColorAxis

```typescript
type ColorAxis = {
  colors: Color[];                     // クラスタに属する Color オブジェクト
  role: "main" | "sub" | "accent";    // 支配度スコア降順で割り当て
};
```

### Color（colorthief 提供）

```typescript
// colorthief の Color オブジェクト
color.hex()        // "#a3c4f2"
color.rgb()        // { r: 163, g: 196, b: 242 }
color.textColor    // 背景色に対する適切なテキスト色
color.proportion   // 画像全体に対する面積比
color.isDark       // ダーク判定
```

### SwatchMap（colorthief 提供）

6つの定義済みロールを持つスウォッチマップ。

| ロール         | 説明               |
| -------------- | ------------------ |
| Vibrant        | 鮮やかな色         |
| Muted          | 落ち着いた色       |
| DarkVibrant    | 暗い鮮やかな色     |
| DarkMuted      | 暗い落ち着いた色   |
| LightVibrant   | 明るい鮮やかな色   |
| LightMuted     | 明るい落ち着いた色 |

---

## 定数一覧

| 定数             | 値      | ファイル                    | 理由                                        |
| ---------------- | ------- | --------------------------- | ------------------------------------------- |
| `quality`        | 10      | `color-extractor.atoms.ts`  | 10px 間隔サンプリング。精度と速度のバランス |
| `colorCount`     | 16      | `color-extractor.atoms.ts`  | パレットの抽出色数                          |
| `ignoreWhite`    | true    | `color-extractor.atoms.ts`  | 白色ピクセルを除外                          |
| `minSaturation`  | 0.05    | `color-extractor.atoms.ts`  | 低彩度ピクセルの除外閾値                    |
| `CLUSTER_COUNT`  | 3       | `color-axes.ts`             | K-means のクラスタ数（main/sub/accent）     |
| `MIN_CHROMA`     | 0.02    | `color-axes.ts`             | OkLch 彩度の下限値                          |
| `MIN_LIGHTNESS`  | 0.2     | `color-axes.ts`             | OkLch 明度の下限値                          |
| `seed`           | 42      | `color-axes.ts`             | K-means の再現性用固定シード                |

---

## 依存パッケージ

| パッケージ     | バージョン | 用途                                             |
| -------------- | ---------- | ------------------------------------------------ |
| `colorthief`   | ^3.3.1     | 色抽出（ドミナント・パレット・スウォッチ）       |
| `culori`       | ^4.0.2     | OkLch 色空間変換（Color Axes フィルタ）          |
| `ml-kmeans`    | ^7.0.0     | K-means クラスタリング                           |
| `jotai`        | ^2.17.1    | Atom ベース状態管理                              |

---

## ファイル構成

```
src/features/color-extractor/
├── color-extractor.types.ts     # ColorAxis 型定義
├── color-extractor.atoms.ts     # Jotai atoms + colorthief 呼び出し
├── color-axes.ts                # deriveColorAxes（K-means クラスタリング）
└── components/
    ├── color-results.tsx        # 4セクション統合コンポーネント
    ├── dominant-color-view.tsx   # ドミナントカラー表示
    ├── palette-view.tsx         # パレット 16色グリッド
    ├── swatches-view.tsx        # スウォッチ 6色グリッド
    └── color-axes-view.tsx      # 色軸（main/sub/accent）表示
```

---

## V1 からの廃止・変更事項

### 廃止

- `extract-colors` ライブラリ → `colorthief` に完全移行
- `color-name-list` による色名解決 → 削除
- `ColorPoint` 型（id, x, y, color, name, percent） → `Color`（colorthief 提供）に置き換え
- ピクセルレベルの `colorValidator`（輝度フィルタ） → colorthief の `ignoreWhite` + `minSaturation`
- HSL lightness フィルタ → OkLch chroma/lightness フィルタ

### V1 残課題の解消状況

| V1 課題                          | V2 の状況                                              |
| -------------------------------- | ------------------------------------------------------ |
| `x` / `y` 座標が常に 0          | 座標フィールド自体を廃止。位置情報は不要と判断         |
| 色数が 12 色を下回る             | colorthief は `colorCount` で直接指定可能。16色固定返却 |
