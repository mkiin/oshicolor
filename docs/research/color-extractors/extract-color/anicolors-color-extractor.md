# anicolors の色抽出実装

**ファイル**: `sample-repo/color-extractors/anicolors/nextjs/src/components/palette/color-extractor.ts`

シンプルな独自実装。Canvas API でピクセルデータを取得し、量子化 → 頻度集計 → 貪欲法による多様性選択という3ステップで代表色を決定する。

---

## 処理フロー

```
Canvas から ImageData 取得
  └─ ピクセルサンプリング（8px飛ばし）
      └─ フィルタリング（透明・極端な明度を除外）
          └─ 色量子化（24刻み丸め）
              └─ 出現頻度マップ構築
                  └─ 候補絞り込み（10回以上 & 上位20色）
                      └─ 貪欲法で多様な色を N 色選択
                          └─ 座標・色名を付与して返却
```

---

## ステップ詳細

### 1. ピクセルサンプリング

```ts
for (let y = 0; y < canvas.height; y += 8) {
  for (let x = 0; x < canvas.width; x += 8) {
```

X・Y ともに 8px 飛ばしで走査する。サンプリング数は全ピクセルの 1/64。
処理速度とカバレッジのバランスを取ったヒューリスティックな値。

---

### 2. フィルタリング

```ts
// 透明ピクセルを除外
if (a < 128) continue;

// 暗すぎ・明るすぎを除外
const brightness = (r + g + b) / 3;
if (brightness < 30 || brightness > 225) continue;
```

**透明除外**: キャラクターイラストは PNG で背景透過されていることが多い。
アルファ値が 128（50%）未満のピクセルは捨てる。

**明度フィルタ**: 輝度を `(R + G + B) / 3` で近似計算し、ほぼ黒（< 30）と
ほぼ白（> 225）を除外する。エディタのカラーテーマで使いにくい極端な色を
最初から排除するための設計判断。

---

### 3. 色量子化

```ts
const quantizedR = Math.round(r / 24) * 24;
const quantizedG = Math.round(g / 24) * 24;
const quantizedB = Math.round(b / 24) * 24;
```

各チャンネル（0〜255）を 24 刻みで丸める。これにより 256 段階が
`256 / 24 ≈ 11` 段階に圧縮される。

量子化の目的：近似した色を同一キーとして集約し、後の頻度カウントを
意味のある単位で行えるようにする。量子化なしでは完全一致するピクセルの
頻度しかカウントできず、実際のカラーパレットの把握が困難になる。

---

### 4. 出現頻度マップ構築

```ts
const colorMap = new Map<
  string,
  { count: number; positions: { x: number; y: number }[]; rgb: number[] }
>();
```

量子化した色を `"R,G,B"` の文字列キーとして Map に蓄積する。
各エントリに出現回数と出現位置の一覧を保持する。

位置情報は後で「その色が画像のどこにあるか」を表すピンの座標に使う。

---

### 5. 候補色の絞り込み

```ts
const candidateColors = Array.from(colorMap.entries())
  .filter(([, info]) => info.count > 10)   // ノイズ除去
  .sort((a, b) => b[1].count - a[1].count) // 頻度降順
  .slice(0, Math.min(20, colorMap.size));  // 上位20色
```

出現 10 回以下の色はノイズとして捨てる。上位 20 色を次のステップに渡す。

---

### 6. 貪欲法（Farthest Point Sampling）による N 色選択

最も重要なステップ。「頻度が高くて視覚的に多様な色のセット」を選ぶ。

```ts
// 最頻色を最初に選択
selectedColors.push(candidateColors[0]!);

while (selectedColors.length < count) {
  let maxMinDistance = 0;
  let bestColorIndex = -1;

  for (let i = 0; i < candidateColors.length; i++) {
    // 既選択色群との「最小距離」を求める
    let minDistance = Infinity;
    for (const selected of selectedColors) {
      const distance = colorDistance(candidate[1].rgb, selected[1].rgb);
      minDistance = Math.min(minDistance, distance);
    }

    // 最小距離が最も大きい候補を選ぶ
    if (minDistance > maxMinDistance) {
      maxMinDistance = minDistance;
      bestColorIndex = i;
    }
  }

  selectedColors.push(candidateColors[bestColorIndex]!);
}
```

**アルゴリズムの直感**: 「既に選んだ色群から最も遠い色を次々と選ぶ」。
これにより赤・青・緑のように色相が分散した多様なパレットが得られる。
単純に頻度上位 N 色を取ると、似た色が連続して選ばれがちなため。

**距離計算**はユークリッド距離（RGB 3次元空間）：

```ts
const colorDistance = (color1: number[], color2: number[]) => {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
};
```

---

### 7. 座標・色名の付与

```ts
// 出現位置リストの中央値インデックスの座標を使う
const centerPos = positions[Math.floor(positions.length / 2)] ?? { x: 0, y: 0 };

// 正規化された座標に変換
const normalizedPos = calculateColorPointPosition(imageElement, centerPos.x, centerPos.y, container);

return {
  id: index + 1,
  x: normalizedPos.x,
  y: normalizedPos.y,
  color: `rgb(${r}, ${g}, ${b})`,
  name: getColorName(Color(`rgb(...)`).hex())?.name ?? "unknown",
};
```

「位置リストの中央値」を代表座標として使う。これは最頻出位置の中間点であり、
その色が画像中でよく出てくる領域のおおよその中心になる。

色名は CSS 名前色の中から最近傍を探す `getColorName()` で解決する。

---

## パラメータまとめ

| パラメータ | 値 | 意味 |
|---|---|---|
| サンプリング間隔 | 8px | X・Y 両方向 |
| アルファ閾値 | 128 | 50% 透明未満は除外 |
| 明度フィルタ | 30 〜 225 | 輝度の有効範囲 |
| 量子化ステップ | 24 | 各チャンネル 11 段階に圧縮 |
| 最小出現回数 | 10 | ノイズ除去の閾値 |
| 候補数上限 | 20 | 貪欲法の入力候補数 |
