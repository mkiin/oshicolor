# Color.js コントラスト計算 解析レポート

> 解析対象: [color.js](https://github.com/LeaVerou/color.js) `sample-repo/color.js/`
> 解析日: 2026-04-06

## 1. APCA 実装の全貌

### ソースファイル

`src/contrast/APCA.js` — APCA 0.0.98G ([Myndex/apca-w3](https://github.com/Myndex/apca-w3))

### 関数シグネチャ

```typescript
contrastAPCA(background: ColorTypes, foreground: ColorTypes): number
```

- **引数の順序が意味を持つ**（非対称）。第1引数=背景、第2引数=前景（テキスト）
- 戻り値: Lc 値 (Lightness Contrast)。範囲はおよそ -110 ~ +110

### 入力の色空間

内部で `to(color, "srgb")` により **sRGB** に変換してから計算する。
任意の色空間の入力を受け付けるが、最終的に sRGB 座標 (0-1) を使う。

### 計算ステップ（擬似コード）

```
定数:
  normBG  = 0.56    // 背景べき乗指数 (BoW)
  normTXT = 0.57    // テキストべき乗指数 (BoW)
  revTXT  = 0.62    // テキストべき乗指数 (WoB)
  revBG   = 0.65    // 背景べき乗指数 (WoB)
  blkThrs = 0.022   // 黒レベル閾値
  blkClmp = 1.414   // 黒クランプ指数
  loClip  = 0.1     // 低コントラスト切り捨て閾値
  deltaYmin = 0.0005 // ノイズゲート
  scaleBoW = 1.14   // BoW スケーラー
  scaleWoB = 1.14   // WoB スケーラー
  loBoWoffset = 0.027
  loWoBoffset = 0.027

STEP 1: sRGB → リニア変換（非標準ガンマ）
  linearize(val) = sign(val) * |val|^2.4
  ※ sRGB 標準の piece-wise 変換ではなく、単純なべき乗 2.4 を使用

STEP 2: 輝度 (Y) の計算
  Y = linearize(R) * 0.2126729
    + linearize(G) * 0.7151522
    + linearize(B) * 0.0721750
  ※ 係数は BT.709 ベースだが Myndex 独自の微調整値
  ※ コメントに「CSS Color 4 の係数を使うべき」との注記あり

STEP 3: 黒レベルのトークランプ (fclamp)
  if Y >= blkThrs (0.022):
    Yclamp = Y
  else:
    Yclamp = Y + (blkThrs - Y)^blkClmp
  ※ フレア（環境光の反射）を考慮した暗部の底上げ

STEP 4: ノイズゲート
  if |Ybg - Ytxt| < deltaYmin (0.0005):
    C = 0  // ほぼ同色 → コントラストなし
    → STEP 6 へ

STEP 5: Polarity 判定 & スコア計算
  if Ybg > Ytxt:  // BoW（暗文字 on 明背景）
    S = Ybg^normBG - Ytxt^normTXT    // 0.56, 0.57
    C = S * scaleBoW                  // * 1.14
  else:           // WoB（明文字 on 暗背景）
    S = Ybg^revBG - Ytxt^revTXT      // 0.65, 0.62
    C = S * scaleWoB                  // * 1.14

STEP 6: 低コントラスト切り捨て & オフセット
  if |C| < loClip (0.1):
    Sapc = 0
  else if C > 0:
    Sapc = C - loBoWoffset (0.027)
  else:
    Sapc = C + loWoBoffset (0.027)

STEP 7: スケーリング
  return Sapc * 100   // → Lc 値
```

### 重要な設計上の特徴

1. **非標準ガンマ**: sRGB の piece-wise 変換ではなく `|val|^2.4` を使う。これは APCA 仕様による意図的な選択
2. **非対称**: 背景と前景で異なるべき乗指数を使い、BoW/WoB で別の係数セットを適用
3. **黒レベル補正**: `fclamp` で極暗色を底上げし、ディスプレイのフレア（環境光反射）をモデル化
4. **ノイズゲート**: ΔY < 0.0005 の極小差をゼロにカット

---

## 2. WCAG 2.1 実装との比較

### WCAG 2.1 の実装

`src/contrast/WCAG21.js`:

```
contrastWCAG21(color1, color2):
  Y1 = max(getLuminance(color1), 0)   // XYZ-D65 の Y 座標
  Y2 = max(getLuminance(color2), 0)
  if Y2 > Y1: swap(Y1, Y2)           // 自動で明るい方を分子に
  return (Y1 + 0.05) / (Y2 + 0.05)   // +0.05 はフレア補正
```

`getLuminance` は `src/luminance.js` にあり、色を XYZ-D65 に変換して Y 座標を返すだけ。
sRGB → XYZ 変換時に sRGB 標準の piece-wise ガンマ補正が適用される。

### 構造的な違い

| 特性 | WCAG 2.1 | APCA |
|------|----------|------|
| 対称性 | 対称（引数順不問） | **非対称**（背景/前景の区別必須） |
| 輝度変換 | sRGB piece-wise → XYZ Y | 単純べき乗 2.4 → 独自重み付き Y |
| フレア補正 | 固定 +0.05 | `fclamp` による非線形クランプ |
| コントラスト式 | 比率 `(L1+0.05)/(L2+0.05)` | べき乗差 `Ybg^a - Ytxt^b` |
| 戻り値の範囲 | 1 ~ 21 | -110 ~ +110 |
| ダーク/ライト区別 | なし | あり（異なる指数） |
| 知覚的均一性 | 低い | より高い |

### 「ダークテーマで WCAG が過大評価する」メカニズム

WCAG 2.1 の式 `(Y1+0.05)/(Y2+0.05)` は:

1. **対称性の問題**: `#000 bg + #555 text` と `#fff bg + #aaa text` が同じコントラスト比を返す。
   しかし人間の知覚では、暗い背景上の暗めの文字は明るい背景上の明るめの文字より**はるかに読みにくい**
2. **固定フレア**: `+0.05` は暗部で相対的に大きな影響を与え、暗い色ペアのコントラストを実際より高く見積もる
3. **線形比率**: 知覚は対数的・べき乗的なのに、単純な比率を使うため暗部の差を過大評価する

APCA はこれを解決するために:
- BoW (normBG=0.56, normTXT=0.57) と WoB (revBG=0.65, revTXT=0.62) で**異なるべき乗指数**を使う
- WoB の指数が大きい → 暗い背景では知覚コントラストが**下がる方向**に補正される
- `fclamp` で暗部のフレアをより正確にモデル化

---

## 3. Polarity（極性）処理

### 正負の仕組み

テストコード (`test/contrast.js`) から確認:

```
#888 on #fff → Lc = +63.06   (BoW: 暗文字 on 明背景)
#fff on #888 → Lc = -68.54   (WoB: 明文字 on 暗背景)
```

- **正の Lc**: BoW（暗い前景、明るい背景）→ ライトテーマ向き
- **負の Lc**: WoB（明るい前景、暗い背景）→ ダークテーマ向き
- 絶対値が同じでないのは、BoW/WoB でべき乗指数が異なるため

### 異なる係数の箇所

```javascript
if (BoW) {  // Ybg > Ytxt
  S = Ybg ** 0.56 - Ytxt ** 0.57;   // normBG, normTXT
} else {
  S = Ybg ** 0.65 - Ytxt ** 0.62;   // revBG, revTXT
}
```

WoB の指数 (0.65, 0.62) が BoW (0.56, 0.57) より大きい。
これにより WoB 方向のコントラストは「圧縮」され、同じ輝度差でも BoW より低いスコアになる。
これは暗い背景上のテキストの可読性が知覚的に低いことを反映している。

### ハレーション防止ロジック

APCA 0.0.98G の実装には、**明示的なハレーション防止のクランプは存在しない**。

ただし、以下の機構がハレーション関連の問題を間接的に緩和する:

1. **WoB の高いべき乗指数**: 暗い背景上の明るい文字のスコアが抑制される → 「十分なコントラスト」に到達するために、より大きな輝度差が必要になる
2. **loClip (0.1) + offset (0.027)**: 低コントラスト領域をゼロにクランプ
3. **fclamp**: 極暗色の輝度を底上げし、純黒との見かけ上の差を縮小

純白テキスト (#fff) on 純黒背景 (#000) のケースでは、APCA は最大級の負の Lc を返すが、
ハレーション自体を「検出」して警告する仕組みはコードには存在しなかった。
ハレーション防止は、Lc 値に基づくフォントサイズ・太さの推奨テーブル（APCA 仕様の別文書）で対応する設計と推測される。

---

## 4. oshicolor への移植に必要な情報

### 最小実装に必要な関数・定数

APCA を TypeScript に移植するために必要な要素:

```
定数 (12個):
  normBG, normTXT, revTXT, revBG,
  blkThrs, blkClmp, loClip, deltaYmin,
  scaleBoW, loBoWoffset, scaleWoB, loWoBoffset

関数 (3個):
  fclamp(Y)       — 黒レベルクランプ
  linearize(val)  — sRGB → リニア (単純 2.4 べき乗)
  contrastAPCA(bg, fg) — メイン関数

輝度係数 (3個):
  R: 0.2126729, G: 0.7151522, B: 0.0721750
```

### Color.js への依存

`APCA.js` が依存するのは:

1. `getColor()` — Color オブジェクトの正規化
2. `to()` — 色空間変換 (sRGB へ変換)
3. `isNone()` — `none` 値のチェック

**これらは移植不要**。oshicolor では入力を sRGB の [0-1] 座標として受け取れば、
`contrastAPCA` 関数は **完全に自己完結** する。

### 移植時の最小コード（概算 40 行）

```typescript
// 入力: sRGB [0-1] の R, G, B
function contrastAPCA(
  bgR: number, bgG: number, bgB: number,
  fgR: number, fgG: number, fgB: number,
): number { ... }
```

Color.js の色空間変換・Color クラス等への依存は**一切不要**。
コントラスト計算だけを完全に切り出せる。

### Lc 値の実用的な閾値目安

Color.js のコードおよびテスト内には、具体的な推奨 Lc 閾値の記述は**確認できなかった**。
テストコードから読み取れる値の範囲:

| テストケース | Lc 値 | 備考 |
|---|---|---|
| `#888` on `#fff` | +63.06 | 中グレー文字 on 白 |
| `#fff` on `#888` | -68.54 | 白文字 on 中グレー |
| `#000` on `#aaa` | +58.15 | 黒文字 on ライトグレー |
| `#aaa` on `#000` | -60.40 | ライトグレー文字 on 黒 |
| `#123` on `#def` | +93.06 | 高コントラスト |
| `#234` on `#567` | +7.53 | 低コントラスト境界付近 |

APCA 公式仕様（[APCA Readability Criterion](https://readtech.org/ARC/)）では以下の目安が示されている（コード外の情報）:

| 用途 | 推奨 |Lc| |
|------|----------|
| 本文テキスト (16px) | >= 90 |
| 本文テキスト (18px bold) | >= 75 |
| 大見出し (24px+) | >= 60 |
| UI 部品（ボーダー等） | >= 30-45 |
| 装飾・非テキスト | >= 15 |

---

## 5. deltaE 実装（副次）

### deltaE OK (Oklab ベース) — 存在確認: あり

`src/deltaE/deltaEOK.js`:

```
deltaEOK(color, sample):
  [L1, a1, b1] = oklab.from(color)
  [L2, a2, b2] = oklab.from(sample)
  return sqrt((L1-L2)^2 + (a1-a2)^2 + (b1-b2)^2)
```

Oklab 空間でのユークリッド距離。シンプルかつ知覚的に均一。

### deltaEOK2 — 改良版も存在

`src/deltaE/deltaEOK2.js`:
- `a`, `b` 軸を `L` 軸に対してスケール係数 2 で拡大
- Björn Ottosson の推奨に基づき、知覚的均一性をさらに改善

### oshicolor の弁別性チェックとの互換性

現状 oshicolor では `minDeltaE = 0.08` を Oklab ユークリッド距離で使用。

Color.js の `deltaEOK` は**同じ計算**（Oklab 空間でのユークリッド距離）であるため、
**完全に互換性がある**。閾値 0.08 もそのまま適用可能。

`deltaEOK2` を使う場合、`a`, `b` に 2 倍のスケールがかかるため、
同じ閾値では**より厳しい判定**になる。閾値の再調整が必要。

---

## まとめ: oshicolor への推奨事項

1. **APCA 移植は容易**: 約 40 行の TypeScript で自己完結的に実装可能。外部依存なし
2. **入力は sRGB [0-1]**: oshicolor が既に持つ色データから直接計算できる
3. **Lc 値による判定**: 正負で BoW/WoB を区別でき、ダークテーマの品質評価が改善される
4. **ハレーション防止**: APCA 自体にはクランプはないが、Lc 値 + フォントサイズテーブルで対応する設計。oshicolor ではフォントサイズ別の閾値テーブルを併用すべき
5. **deltaE OK**: 現行の弁別性チェックと完全互換
