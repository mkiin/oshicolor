# color-extractor 実装比較

anicolors（参照実装）と oshicolor（本実装）の `color-extractor` の差分まとめ。

| 項目               | anicolors                              | oshicolor             |
| ------------------ | -------------------------------------- | --------------------- |
| 入力               | `HTMLCanvasElement + HTMLImageElement` | `ImageData`（Pure）   |
| 明度計算           | 算術平均                               | Rec.601 輝度加重平均  |
| 色距離             | RGB ユークリッド                       | OKLab 知覚距離        |
| 代表座標           | 位置配列の中央インデックス             | 重心（平均座標）      |
| 座標正規化         | 384 基準                               | 0–1                   |
| 色名解決           | `nearest-color` + RGB 距離             | `culori` + OKLab 距離 |
| 選択済みチェック   | `Array.some`（O(n)）                   | `Set`（O(1)）         |
| 出力色形式         | `rgb(r, g, b)`                         | `#RRGGBB`             |
| 色名フォールバック | `"unknown"` 固定                       | `undefined`（省略可） |

---

## 1. 入力インターフェース

### anicolors

```typescript
export const extractMainColors = (
  canvas: HTMLCanvasElement,
  imageElement: HTMLImageElement,
  count = 5,
): ColorPoint[]
```

- `canvas.getContext("2d").getImageData()` を関数内部で呼び出す
- `imageElement.parentElement` にも依存しており、DOM に密結合

### oshicolor

```typescript
export const extractColors = (
  imageData: ImageData,
  imageWidth: number,
  imageHeight: number,
  count = 5,
): ColorPoint[]
```

- `ImageData` を外部から受け取る
- DOM・Canvas への依存がなくテストしやすい

---

## 2. 明度計算

### anicolors

```typescript
const brightness = (r + g + b) / 3;
```

RGB の算術平均。人間の色覚特性（緑に敏感・青に鈍感）が考慮されていない。

### oshicolor

```typescript
const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
```

Rec.601 輝度加重平均。人間の知覚に合わせた係数で、知覚的な明るさをより正確に反映する。

---

## 3. 色距離・色名解決

### anicolors

```typescript
// 距離計算: RGB ユークリッド
const colorDistance = (color1: number[], color2: number[]) =>
  Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);

// 色名解決: nearest-color ライブラリ（RGB 距離）
const nearest = nearestColor.from(colors); // {name: hex} のフラットオブジェクト
```

RGB 空間は知覚的に均一ではない（例: 同じ距離でも青系より緑系の違いのほうが人間には大きく見える）。

### oshicolor

```typescript
// 距離計算: OKLab 知覚距離（culori）
const diffOklab = differenceEuclidean("oklab");

// 色名解決: culori の nearest + OKLab 距離
_finder = nearest(parsedColors, differenceEuclidean("oklab"));
```

OKLab は知覚的に均一な色空間。距離 1 の色差が常に同程度の「見た目の差」に対応し、貪欲法の多様性選択・色名マッチングともに精度が上がる。

---

## 4. 代表座標の決定

### anicolors

```typescript
colorInfo.positions.push({ x, y }); // グループの全ピクセル位置を蓄積

// 変換時: 配列の中央インデックスの位置を使用
const centerPos = positions[Math.floor(positions.length / 2)] ?? { x: 0, y: 0 };
```

位置配列をソートせずに中央インデックスを使っているため、走査順に依存した擬似的な中央値になる。

### oshicolor

```typescript
existing.xSum += px;
existing.ySum += py;

// 変換時: 重心を計算
x: c.xSum / c.count / imageWidth,
y: c.ySum / c.count / imageHeight,
```

グループ内全ピクセルの平均座標（重心）を使用するため、色の分布を正確に反映した位置になる。

---

## 5. 選択済みチェック

### anicolors

```typescript
// キー文字列の same-key チェックを some で線形探索
if (selectedColors.some((selected) => selected[0] === candidate[0])) continue;
```

### oshicolor

```typescript
// インデックスを Set で管理し O(1) でチェック
const selectedIndices = new Set<number>([0]);
if (selectedIndices.has(i)) continue;
selectedIndices.add(bestIdx);
```

---

## 6. 出力形式と色名フォールバック

### anicolors

```typescript
{
  color: `rgb(${r}, ${g}, ${b})`,
  name: getColorName(...)?.name ?? "unknown",  // 見つからなくても "unknown" を返す
}
```

### oshicolor

```typescript
{
  color: c.hex,            // "#RRGGBB" 形式
  name: findColorName(c.hex),  // 見つからなければ undefined（型: string | undefined）
}
```

色形式を HEX に統一することで、CSS・Tailwind・他ライブラリとの互換性が高い。
`"unknown"` の代わりに `undefined` を使うことで、呼び出し側が「名前なし」を明示的に判定できる。

---

## 7. 色名解決の内部実装

### anicolors

```typescript
// モジュールトップレベルで即時初期化
const colors = colornames.reduce((o, { name, hex }) => Object.assign(o, { [name]: hex }), {});
const nearest = nearestColor.from(colors);
```

- モジュール読み込み時に全色名をパースして初期化（起動コストがかかる）

### oshicolor

```typescript
// 初回呼び出し時にのみ初期化（lazy init）
let _finder: ... | null = null;
const _nameByHex = new Map<string, string>();

const getNameFinder = () => {
  if (_finder) return _finder;
  // ...初期化処理
};
```

- 遅延初期化で起動時の処理を回避
- `Map<hex, name>` でキー検索するため、`indexOf` のような参照同一性への依存がない
