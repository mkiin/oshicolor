# extract-colors ライブラリの実装

**ディレクトリ**: `sample-repo/extract-colors/`

npm パッケージとして公開されている汎用ライブラリ。anicolors 実装より設計が洗練されており、
RGB 空間での量子化に加えて HSL 空間での類似色マージという2段階のクラスタリングを行う。

---

## 処理フロー

```
入力（ImageData / HTMLImageElement / src）
  └─ 画像リサイズ（pixels オプションで総ピクセル数を制限）
      └─ ピクセル走査（reducer で間引き）
          └─ colorValidator でフィルタリング
              └─ RootGroup / LeafGroup による色集約
                  └─ 距離ベースの近似色マージ
                      └─ HSL 空間での再グルーピング（AverageManager）
                          └─ intensity × area で最終ソート
                              └─ FinalColor として出力
```

---

## ステップ詳細

### 1. オプションのデフォルト値（cleanInputs）

```ts
pixels = 64000; // 処理対象の最大ピクセル数
distance = 0.22; // 近似色マージの距離閾値（0〜1）
colorValidator = (r, g, b, a) => a > 250; // 完全不透明のみ
hueDistance = 1 / 12; // ≈ 0.083（30度相当）
saturationDistance = 1 / 5; // 0.2
lightnessDistance = 1 / 5; // 0.2
```

---

### 2. 画像リサイズ（extractImageData）

```ts
const currentPixels = image.width * image.height;
const width = Math.round(image.width * Math.sqrt(pixels / currentPixels));
const height = Math.round(image.height * Math.sqrt(pixels / currentPixels));
```

元画像の総ピクセル数が `pixels` を超える場合、アスペクト比を保ちながら縮小する。
`√(target/current)` を掛けることで面積比が `target/current` になる。

Canvas に描画して `getImageData()` を呼ぶ。Web Worker の場合は `OffscreenCanvas` を使う。

---

### 3. ピクセル走査（extractor）

```ts
const reducer = Math.floor((width * height) / pixels) || 1;

for (let i = 0; i < data.length; i += 4 * reducer) {
    if (colorValidator(r, g, b, a)) {
        colorGroup.addColor(r, g, b);
    }
}
```

`reducer` = 「何ピクセルおきにサンプリングするか」の係数。
リサイズ後も目標ピクセル数に合わせて均一にサンプリングする。

`colorValidator` はデフォルトでアルファ > 250（ほぼ完全不透明）のみを通す。
ユーザーが独自バリデータを渡せるため、「特定の明度・彩度範囲のみ抽出」なども可能。

---

### 4. 色の集約（RootGroup / LeafGroup）

2階層のバケット構造で色を整理する。

#### RootGroup — 近似色のグルーピング

```ts
addColor(r, g, b) {
  const full = (r << 16) | (g << 8) | b;  // 24bit の完全な色
  const loss = (((r >> 4) & 0xf) << 8)   // 上位4ビットのみの12bit 値
             | (((g >> 4) & 0xf) << 4)
             | ((b >> 4) & 0xf);
  return this.getLeafGroup(loss).addColor(full, r, g, b);
}
```

`loss` は各チャンネルの上位 4 ビットだけを取り出した 12 ビット値。
これは `16 × 16 × 16 = 4096` 通りのバケットになる。
つまり **16刻みで丸めた色が同じピクセルは同じ LeafGroup に入る**。

#### LeafGroup — 完全一致の色のカウント

```ts
addColor(hex, r, g, b) {
  if (this._children[hex]) {
    this._children[hex]._count++;  // 同じ色なら加算
  } else {
    this._children[hex] = new Color(r, g, b, hex);  // 新規登録
  }
}
```

24bit の `hex` 値で完全一致を管理する。
LeafGroup には「ほぼ同じ色（上位4ビットが一致）」のピクセルが集まる。

#### createMainColor — LeafGroup の代表色

```ts
createMainColor() {
  const biggest = list.reduce((a, b) => a._count >= b._count ? a : b);
  const main = biggest.clone();
  main._count = this._count;  // グループ全体の出現数をセット
  return main;
}
```

LeafGroup の中で最も出現頻度が高い色を代表として選ぶ。
ただし `_count` にはグループ全体（近似色も含む）の出現数を入れる。

---

### 5. 近似色マージ（RootGroup.getColors）

```ts
list.sort((a, b) => b._count - a._count);

const newList: Color[] = [];
while (list.length) {
    const current = list.shift();

    // distance 未満の色を全て current に吸収する
    list.filter((color) => Color.distance(current, color) < _distance).forEach(
        (near) => {
            current._count += near._count;
            list.splice(
                list.findIndex((c) => c === near),
                1,
            );
        },
    );

    newList.push(current);
}
```

最頻色から順番に処理し、「近い色」を全て吸収する貪欲マージ。
吸収された色はリストから除去され、残った色だけが次ステップに進む。

**距離計算（Color.distance）** は MAE（平均絶対誤差）ベース：

```ts
static distance(colorA, colorB) {
  return (|r1-r2| + |g1-g2| + |b1-b2|) / (3 × 255);
}
```

0〜1 の正規化された値。白と黒の距離が 1.0 になるよう設計されている。
`distance = 0.22` のデフォルトでは、かなり似た色まで同一視する。

---

### 6. HSL 空間での再グルーピング（AverageManager）

RGB マージだけでは取り除けない「知覚的に似た色」をさらに統合する。

```ts
// AverageGroup.isSamePalette — HSL 距離が全て閾値以内か判定
isSamePalette(color, hue, saturation, lightness) {
  for (const currentColor of this.colors) {
    const isSame =
      hueDistance(currentColor._hue, color._hue) < hue &&
      distance(currentColor._saturation, color._saturation) < saturation &&
      distance(currentColor._lightness, color._lightness) < lightness;
    if (!isSame) return false;
  }
  return true;
}
```

**Hue 距離の特殊処理**（円環を考慮）：

```ts
const hueDistance = (a, b) =>
    Math.min(Math.abs(a - b), Math.abs(((a + 0.5) % 1) - ((b + 0.5) % 1)));
```

Hue は 0〜1 の円環（0 と 1 は同じ赤）なので、通常の絶対値差では
`0.01`（赤）と `0.99`（赤に近い）の距離が 0.98 と誤って大きくなる。
0.5 ずらしてから差を取り、小さい方を選ぶことで正しく `0.02` になる。

グループの代表色は RGB 平均（AverageGroup.average）：

```ts
get average() {
  const { r, g, b } = this.colors.reduce((total, color) => {
    total.r += color._red;
    total.g += color._green;
    total.b += color._blue;
    return total;
  }, { r: 0, g: 0, b: 0 });

  return new Color(
    Math.round(r / this.colors.length),
    Math.round(g / this.colors.length),
    Math.round(b / this.colors.length),
  );
}
```

---

### 7. 最終ソート（sortColors）

```ts
sorted.sort((a, b) => {
    const bPower = (b._intensity + 0.1) * (0.9 - b._count / _pixels);
    const aPower = (a._intensity + 0.1) * (0.9 - a._count / _pixels);
    return bPower - aPower;
});
```

`power = (intensity + 0.1) × (0.9 - count / totalPixels)`

この式のポイント：

- **intensity が高い（鮮やかな）色を優先** → 灰色や無彩色より特徴的な色が上位に来る
- **count が小さい（面積が少ない）色を優先** → 背景の大きな単色より、少量のアクセントカラーが上位に来る
- `+ 0.1` と `0.9 -` は intensity や count が 0 のときのゼロ割れ・負値を防ぐオフセット

つまり「目立つが面積は小さい特徴的な色」が先頭に来るよう設計されている。

---

### 8. FinalColor への変換

```ts
export const createFinalColor = (color: Color, pixels: number): FinalColor => {
    return {
        hex: `#${color._hex.toString(16).padStart(6, "0")}`,
        red: color._red,
        green: color._green,
        blue: color._blue,
        area: color._count / pixels, // 画像に占める面積割合
        hue: color._hue, // 0〜1
        saturation: color._saturation, // 0〜1
        lightness: color._lightness, // 0〜1
        intensity: color._intensity, // 0〜1
    };
};
```

`area` は抽出された色が画像全体の何割を占めるかの推定値。

**intensity** は `Color.updateHSL()` で計算される：

```ts
this.__intensity =
    this.__saturation * ((0.5 - Math.abs(0.5 - this.__lightness)) * 2);
```

彩度（saturation）に明度の中心性（0 や 1 に近いほど 0、0.5 が最大）を掛けた値。
純粋に鮮やかで、かつ極端に明暗でない色ほど intensity が高くなる。

---

## HSL 変換（Color.updateHSL）

```ts
updateHSL() {
  const r = this._red / 255, g = this._green / 255, b = this._blue / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);

  // Lightness
  this.__lightness = (max + min) / 2;

  if (max === min) {
    // 無彩色（白・黒・グレー）
    this.__hue = this.__saturation = this.__intensity = 0;
  } else {
    const d = max - min;
    // Saturation
    this.__saturation = this.__lightness > 0.5
      ? d / (2 - max - min)
      : d / (max + min);

    // Hue（どのチャンネルが最大かで場合分け）
    switch (max) {
      case r: this.__hue = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: this.__hue = ((b - r) / d + 2) / 6; break;
      case b: this.__hue = ((r - g) / d + 4) / 6; break;
    }
  }
}
```

標準的な RGB → HSL 変換。Hue は 0〜1（0 = 赤、1/3 = 緑、2/3 = 青）。
遅延評価（lazy evaluation）で最初にアクセスされたときだけ計算される。

---

## パラメータまとめ

| オプション           | デフォルト   | 意味                                                       |
| -------------------- | ------------ | ---------------------------------------------------------- |
| `pixels`             | 64000        | 処理対象の最大ピクセル数                                   |
| `distance`           | 0.22         | RGB 空間での近似色マージ閾値（0=マージなし、1=白黒の距離） |
| `colorValidator`     | alpha > 250  | 処理対象ピクセルの条件                                     |
| `hueDistance`        | 1/12 ≈ 0.083 | HSL グルーピングの Hue 閾値（30度相当）                    |
| `saturationDistance` | 0.2          | HSL グルーピングの彩度閾値                                 |
| `lightnessDistance`  | 0.2          | HSL グルーピングの明度閾値                                 |
