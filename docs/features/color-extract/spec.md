---
feature: color-extract
status: planned
last-updated: 2026-05-18
---

# color-extract 仕様

## 概要

画像から 16 色のカラーパレットを抽出する feature。wallust v4 の Salience pipeline を OKLch 上に移植した実装で、ANSI 16 色 (color0 から color15) と背景・前景・カーソル色を含む `Colors` 構造体を返す。後段 palette-design feature で semantic ロールを派生させる前提の中間出力にあたる。

## 入出力

- 入力: `HTMLImageElement` / `ImageBitmap` / `Blob` (PNG / JPEG / WebP)
- 出力: `Colors`

```ts
type OKLch = { l: number; c: number; h: number };

type Colors = {
  background: OKLch;
  foreground: OKLch;
  cursor: OKLch;
  color0: OKLch; color1: OKLch; color2: OKLch; color3: OKLch;
  color4: OKLch; color5: OKLch; color6: OKLch; color7: OKLch;
  color8: OKLch; color9: OKLch; color10: OKLch; color11: OKLch;
  color12: OKLch; color13: OKLch; color14: OKLch; color15: OKLch;
  source: { width: number; height: number; hash: string };
  meta: { threshold: number; extractedAt: string };
};
```

## アルゴリズム / 処理フロー

wallust v4 (Rust) の `src/histogram/` と `src/lib.rs::gen_colors` の `Palette::Salience` 経路を TypeScript に移植する。次の 6 段で構成する。

### 1. 画像読み込みとリサイズ

入力画像を `OffscreenCanvas` 上で長辺 512px に揃え、アスペクト比を保ったままリサイズする。たとえば 1920x1080 なら 512x288、800x800 なら 512x512、1080x1920 なら 288x512 になる。`ImageData.data` から sRGB バイト列を取り出す。

アスペクト比を保つ理由は、画像中の色面の相対面積を維持して salience スコア計算に偏りが入らないようにするため。アスペクト比を歪めると同じ色面でも縦横比が変わる場所で画素数の重みが変わる。

### 2. OKLch への変換

各画素を `culori` の `converter('oklch')` で OKLch に変換する。`{ l, c, h }` の 3 軸で `l: 0..1`、`c: 0..0.4`、`h: 0..360` の範囲を持つ。

### 3. threshold histogram (gather)

`gather` 関数で画素を「色バケット」に集計する。

```ts
function gather(pixels: OKLch[], threshold: number): Histo[] {
  const histo: Histo[] = [];
  for (const p of pixels) {
    let merged = false;
    for (const h of histo) {
      if (canBucket(p, h.color, threshold)) {
        h.count += 1;
        merged = true;
        break;
      }
    }
    if (!merged) histo.push({ color: p, count: 1, score: 0 });
  }
  return histo;
}
```

`canBucket` は OKLch 上の重み付きユークリッド距離 (重み `WEIGHTS_BUCKETING = [1.0, 1.0, 1.5]`) が threshold 以下なら true。各軸は `[L_MAX, C_MAX, H_MAX] = [1.0, 0.4, 180]` で正規化する。

### 4. auto_threshold

固定列 `[14, 16, 13, 17, 12, 18, ..., 2, 38..44]` の各 threshold で並列に `gather` → `scoreHistogram` を走らせ、スコア最大の histogram を採用する。

スコア式 (`scoreHistogram`):

```text
score = Σ_{i<j} salience(c_i, c_j) × w_ij / Σ_{i<j} w_ij
w_ij = (count_i × count_j) ^ (1/4)
```

並列実行は `navigator.hardwareConcurrency` を上限 8 にキャップした Web Worker pool で行う。連続 2 回スコアが下がったら探索を打ち切る (wallust と同じ条件)。

### 5. dedup と post_dedup

1. `dedup`: `gather` と同じ threshold で隣接バケットを再統合
2. `postDedup`: 最低顕著色を背景仮置きに選び、各バケットの salience スコアを計算してソート

salience スコアは「背景仮置き bg に対する full salience」で、重み `WEIGHTS_FULL = [1.0, 1.0, 1.0]` を使う。背景候補の選定には `WEIGHTS_NAIVE = [1.0, 5.0, 0.0]` (hue 無視) を使う。

### 6. salience_palette (16 色割り当て)

ソート済みヒストグラムから 16 色を作る。wallust v4 の `salience_palette` を balanced sampling + Normal intensity で移植する。

- `background`: 背景仮置きを `constrainColAsBg` で範囲補正
- `color0`: bg に最も近い色
- `color1` から `color6`: 中央付近からサンプリング (balanced)
- `color7`: 最顕著色を明度 25% 上げる
- `color8`: color7 を明度 30% 下げる
- `color9` から `color14`: color1 から color6 と同色 (use16cols off)
- `color15`: 最顕著色と白の blend
- `cursor`: foreground と color5 の中間色

## 主要な型・定数

- `OKLch`: `{ l: number; c: number; h: number }`
- `Histo`: `{ color: OKLch; count: number; score: number }`
- `Colors`: 16 色 + bg/fg/cursor + source/meta
- `RESIZE_LONG_EDGE = 512`
- `THRESHOLD_SEQUENCE`: wallust と同じ 42 要素の固定列
- `WEIGHTS_NAIVE = [1.0, 5.0, 0.0] as const`
- `WEIGHTS_FULL = [1.0, 1.0, 1.0] as const`
- `WEIGHTS_BUCKETING = [1.0, 1.0, 1.5] as const`
- `L_MAX = 1.0`、`C_MAX = 0.4`、`H_MAX = 180`

## 依存

- パッケージ: `culori`
- 他 feature: なし

## 設計の前提と制約

- メモリキャッシュは `Map<hash, Colors>` の LRU で持つ。永続化は対象外
- intensity 補正 (Pastel/Vibrant)、sampling mode (high/distributed/low)、WCAG コントラスト補正、背景マスキングは本 spec では実装しない (別 issue)
- dark/light style の派生は本 feature では扱わない (palette-design feature の責務)
- auto_threshold の並列処理が再現性に影響する可能性があり、必要なら結果の決定性を確保する追加対応を入れる
