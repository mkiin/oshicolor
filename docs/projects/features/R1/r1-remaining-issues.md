# R1 残課題と解決方針

---

## 課題1: `x` / `y` 座標が常に 0

### 概要

`extract-colors` ライブラリは代表色の HEX・面積比は返すが、そのクラスタが画像上のどの位置に分布していたかを返さない。そのため現在 `ColorPoint.x` / `y` は常に 0 固定。

### 影響

- カラースキームの色ロール自動割り当て（髪色 → アクセント、背景 → `Normal.bg` など）の根拠として位置情報が使えない
- 画像上で抽出色の出所を可視化する UI（スウォッチをクリックすると画像上の分布をハイライト等）が実装不可
- `ColorPoint.x` / `y` フィールドは型に残っているが実質的に意味をなしていない

### 解決方針: セントロイド計算パスの追加

`extractColorsFromImageData` でパレットを確定させた後、同じ `imageData` をもう1回走査して各パレット色の重心（セントロイド）を求める。

#### フロー

```
① extract-colors でパレット確定（12色）
② 同じ imageData を再スキャン（ダウンサンプリング済み）
   各ピクセル → RGB 距離で最近傍パレット色に分類
③ 各クラスタの x, y を累積 → 平均を取る
④ 0〜1 正規化して ColorPoint.x / y に反映
```

#### パフォーマンス試算

```
pixels     = 40,000（ダウンサンプリング後）
palette    = 12色

比較回数   = 40,000 × 12 = 480,000 回
→ 数ミリ秒以内。体感できる遅延なし
```

#### 実装イメージ

```typescript
// color-extractor.ts 内部に追加
const computeCentroids = (
  imageData: ImageData,
  palette: FinalColor[],
): { x: number; y: number }[] => {
  const { data, width, height } = imageData;
  const reducer = Math.floor((width * height) / PIXELS) || 1;
  const paletteRGB = palette.map((c) => ({ r: c.red, g: c.green, b: c.blue }));
  const sums = paletteRGB.map(() => ({ x: 0, y: 0, count: 0 }));

  for (let i = 0; i < width * height; i += reducer) {
    const idx = i * 4;
    const r = data[idx] ?? 0;
    const g = data[idx + 1] ?? 0;
    const b = data[idx + 2] ?? 0;
    const a = data[idx + 3] ?? 0;
    if (a < MIN_ALPHA) continue;

    // 最近傍パレット色を RGB 距離で探す
    let minDist = Infinity;
    let nearest = 0;
    for (let j = 0; j < paletteRGB.length; j++) {
      const p = paletteRGB[j];
      if (!p) continue;
      const dist = (r - p.r) ** 2 + (g - p.g) ** 2 + (b - p.b) ** 2;
      if (dist < minDist) {
        minDist = dist;
        nearest = j;
      }
    }

    const sum = sums[nearest];
    if (sum) {
      sum.x += (i % width) / width;
      sum.y += Math.floor(i / width) / height;
      sum.count++;
    }
  }

  return sums.map((s) => ({
    x: s.count > 0 ? Math.round((s.x / s.count) * 100) / 100 : 0,
    y: s.count > 0 ? Math.round((s.y / s.count) * 100) / 100 : 0,
  }));
};
```

#### 解決状態

- [ ] 未着手

---

## 課題2: 返却色数が 12 色を下回る場合がある

### 概要

`extract-colors` は `distance` パラメータで間接的に色数を制御する設計であり、「必ず N 色返す」という保証ができない。

### 影響

- Neovim カラースキームは多くの色ロールへの割り当てを前提とする。色が不足すると同じ色を複数ロールに使い回すことになり、テーマのコントラストや識別性が低下する
- 色数が少ない画像（背景単色・夜景など）や、フィルタで多く除外される画像で発生しやすい

### 解決方針: 不足分を補間で生成

既存パレットから HSL 操作で派生色を生成し、不足分を補う。

#### フロー

```
① 抽出結果が count 未満
② 既存パレット色の中から「明度・彩度を変化させやすい色」を選ぶ
③ HSL の L 値をシフトして派生色を生成（例: +15%, -15%）
④ 既存色と重複しない色のみ追加し count に到達させる
```

#### 実装イメージ（概略）

```typescript
// 不足分を補間で埋める（culori の hsl 変換を使用）
if (result.length < count) {
  const shortage = count - result.length;
  const derived = generateDerivedColors(result, shortage);
  result.push(...derived);
}
```

#### 解決状態

- [ ] 未着手（カラースキーム生成（R3）の実装段階で優先度を再評価する）
