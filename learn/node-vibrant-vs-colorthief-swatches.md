# node-vibrant vs colorthief: swatch 選定の比較

## 概要

両ライブラリとも画像から 6 つの swatch ロール（Vibrant / Muted / DarkVibrant / DarkMuted / LightVibrant / LightMuted）を選定するが、**null の扱い**が根本的に異なる。

- **node-vibrant**: null が出たらフォールバック合成で埋める → ほぼ必ず値を返す
- **colorthief**: null はそのまま返す → 画像によっては複数スロットが null

## 色空間

|              | node-vibrant             | colorthief                     |
| ------------ | ------------------------ | ------------------------------ |
| スコアリング | HSL (Saturation / Luma)  | OkLch (Lightness / Chroma)     |
| 知覚均一性   | 低い（HSL は知覚と乖離） | 高い（OkLch は知覚均一色空間） |

## target 定義

### node-vibrant（HSL ベース）

| Role         | Target L (Luma) | L 範囲    | Target S (Saturation) | S 範囲    |
| ------------ | --------------- | --------- | --------------------- | --------- |
| Vibrant      | 0.50            | 0.30–0.70 | 1.00                  | 0.35–1.00 |
| DarkVibrant  | 0.26            | 0.00–0.45 | 1.00                  | 0.35–1.00 |
| LightVibrant | 0.74            | 0.55–1.00 | 1.00                  | 0.35–1.00 |
| Muted        | 0.50            | 0.30–0.70 | 0.30                  | 0.00–0.40 |
| DarkMuted    | 0.26            | 0.00–0.45 | 0.30                  | 0.00–0.40 |
| LightMuted   | 0.74            | 0.55–1.00 | 0.30                  | 0.00–0.40 |

### colorthief（OkLch ベース）

| Role         | Target L | L 範囲    | Target C | Min C |
| ------------ | -------- | --------- | -------- | ----- |
| Vibrant      | 0.65     | 0.40–0.85 | 0.20     | 0.08  |
| DarkVibrant  | 0.30     | 0.00–0.45 | 0.20     | 0.08  |
| LightVibrant | 0.85     | 0.70–1.00 | 0.20     | 0.08  |
| Muted        | 0.65     | 0.40–0.85 | 0.04     | 0.00  |
| DarkMuted    | 0.30     | 0.00–0.45 | 0.04     | 0.00  |
| LightMuted   | 0.85     | 0.70–1.00 | 0.04     | 0.00  |

## スコアリング関数

### node-vibrant

```
score = weightedMean(
  (1 - |saturation - targetS|),  weight = 3.0,
  (1 - |luma - targetL|),        weight = 6.5,
  (population / maxPopulation),  weight = 0.5,
)
```

重み: **Luma(6.5) > Saturation(3.0) >> Population(0.5)**

### colorthief

```
score = lDist * 6 + cDist * 3 + popNorm * 1

lDist = 1 - |color.l - target.targetL|
cDist = 1 - min(|color.c - target.targetC| / 0.2, 1)
popNorm = color.population / maxPopulation
```

重み: **Lightness(6) > Chroma(3) >> Population(1)**

両者とも **明度の一致を最重視、彩度が次点、面積はほぼ無視** という同じ思想。colorthief は chroma distance を 0.2 で正規化している点が異なる。

## フィルタリング（失格条件）

### node-vibrant

L/S が範囲外の色は候補から除外される。ただし、除外後に候補がゼロでもフォールバック合成で救済される。

### colorthief

L が `[minL, maxL]` 外、または C が `minC` 未満の色は `score = -Infinity` で即失格。救済なし。

## 重複排除

両者とも同じ色が複数ロールに選ばれることを防ぐ:

- **node-vibrant**: 選定順に `_isAlreadySelected()` でチェック。先に選ばれたロールが優先。
- **colorthief**: 全ロールのベストをスコア降順でソートし、高スコアのロールが色を確保。低スコアのロールは次善の色を探し、見つからなければ null。

## null が出る条件と対処

### node-vibrant: フォールバック合成で null を回避

`_generateEmptySwatches()` が空スロットを埋める:

1. **Vibrant が null** → DarkVibrant の L を 0.50 に変更して合成 / LightVibrant から合成
2. **DarkVibrant が null** → Vibrant の L を 0.26 に変更して合成
3. **LightVibrant が null** → Vibrant の L を 0.74 に変更して合成
4. **Muted 系が null** → Vibrant 系から彩度を変更して合成

合成された swatch は `population = 0`（画像由来ではない人工色）。

理論上は全スロットが null になる可能性があるが、実画像では極めて稀。

### colorthief: null はそのまま返す

フォールバック合成の仕組みがない。以下の場合に null が出る:

1. **全色が L 範囲外** — 極端に暗い/明るい画像で LightVibrant / DarkVibrant が null
2. **全色が C < minC (0.08)** — モノクロ/低彩度画像で Vibrant 系 3 スロットが全 null
3. **色数不足** — 16色パレットから6ロールに配る際、重複排除で次善が見つからない
4. **そもそも未割り当て** — スコアリングで一度も候補にならなかったロール

## 選定順序

|      | node-vibrant                  | colorthief                                  |
| ---- | ----------------------------- | ------------------------------------------- |
| 方式 | 固定順で逐次選定              | 全ロール一括スコアリング → スコア降順で確定 |
| 順序 | V → LtV → DkV → M → LtM → DkM | スコアが高いロールから順に色を確保          |

node-vibrant は Vibrant を最優先で確定し、残りを順番に埋める。colorthief はスコアが最も高い（= target に最もマッチした）組み合わせから確定するため、理論的にはより最適な割り当てになる。

## oshicolor への影響

colorthief の swatch は null が出る前提で設計する必要がある。V10 で Vibrant 系（V / DkV / LtV）をアクセント色として導入する際:

- **Vibrant 系 3 スロットが全 null のキャラが存在しうる** → dominant からの代用フォールバックが必須
- **null でない Vibrant は「画像に実在する鮮やかな色」であることが保証されている** → node-vibrant の合成色と違い、population > 0 の実在色
- colorthief の Vibrant は minC ≥ 0.08 を通過しているため、**一定の彩度が保証されている**
