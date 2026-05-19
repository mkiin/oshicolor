---
feature: color-extract
status: planned
last-updated: 2026-05-19
---

# color-extract 仕様

## 概要

`color-extract` feature は、画像から 16 色のカラーパレットを取り出して `Colors` 構造体として返すレイヤにあたる。wallust v4 の Salience pipeline を CAM16-UCS Jmh 上で再現する形で実装し、後段の `palette-design` feature が semantic ロールを派生させる前提の中間出力を担う。

色空間として CAM16-UCS Jmh を選ぶ理由は、観察条件 (`L_A` と `Y_b` と surround) をパラメータで切り替えられるためで、dark テーマと light テーマで別の `BakedParameters` を焼いて顕著性計算を組むという wallust の中核機能をそのまま TS に持ち込める。OKLch ではこの観察条件切替を再現できないため、PoC (#040) の採用判定を経て CAM16-UCS Jmh の自前実装に踏み切ることが決まった。

## 入出力

入力は画像データと style 指定で、出力は 16 色 + 背景・前景・カーソル色を含む `Colors` 構造体になる。

- 入力: `HTMLImageElement` / `ImageBitmap` / `Blob` (PNG / JPEG / WebP) と `Style`
- 出力: `Colors`

```ts
type Style = "dark" | "light";

type Cam16UcsJmh = { j: number; m: number; h: number };

type Colors = {
  background: Cam16UcsJmh;
  foreground: Cam16UcsJmh;
  cursor: Cam16UcsJmh;
  color0: Cam16UcsJmh; color1: Cam16UcsJmh; color2: Cam16UcsJmh; color3: Cam16UcsJmh;
  color4: Cam16UcsJmh; color5: Cam16UcsJmh; color6: Cam16UcsJmh; color7: Cam16UcsJmh;
  color8: Cam16UcsJmh; color9: Cam16UcsJmh; color10: Cam16UcsJmh; color11: Cam16UcsJmh;
  color12: Cam16UcsJmh; color13: Cam16UcsJmh; color14: Cam16UcsJmh; color15: Cam16UcsJmh;
  source: { width: number; height: number; hash: string };
  meta: { threshold: number; style: Style; extractedAt: string };
};

const extractColors = (
  image: HTMLImageElement | ImageBitmap | Blob,
  style: Style,
): Promise<Colors> => {
  /* ... */
};
```

公開 API は `extractColors(image, style)` 1 本にする。`style` は CAM16 の観察条件選択に直結する引数なので、palette-design 側がテーマ種別を判定した上で渡す前提になる。

## アルゴリズムの全体像

wallust v4 (Rust) の `src/histogram/` と `src/lib.rs::gen_colors` の `Palette::Salience` 経路を 6 段の TypeScript パイプラインに移植する。色空間の変換は CAM16-UCS Jmh への置換で、それ以外の dedup / 顕著性スコア / 16 色割り当ては wallust と同じ重み構造を踏襲する。

### 1. 画像読み込みとリサイズ

入力画像を `OffscreenCanvas` 上で長辺 512px に揃え、アスペクト比を保ったままリサイズする。1920x1080 なら 512x288 になり、800x800 なら 512x512 のままで、1080x1920 なら 288x512 になる。`ImageData.data` から sRGB バイト列の `Uint8ClampedArray` を取り出して次段に渡す。

アスペクト比を保つのは、画像中の色面の相対面積を維持して顕著性スコアに偏りが入らないようにするためで、歪めると同じ色面でも縦横比が変わる場所で画素数の重みが変わる。

### 2. BakedParameters の焼き込みと CAM16-UCS Jmh への並列変換

`style` 引数から `Parameters` を組み立てて 1 度だけ `bake` する。dark なら `L_A = 140 cd/m²`, `Y_b = 0.2`, surround `Average`、light なら `L_A = 500 cd/m²`, `Y_b = 0.8`, surround `Average` で、これは wallust の `Histogram::new_empty` と同じ値になる。

`BakedParameters` は画像非依存で `style` のみに依存するため、メインスレッドで 1 度作って Web Worker に渡せばすべての画素変換で使い回せる。Worker 1 つに 1 個ずつ送り、Worker 内では画素単位で `srgbToCam16UcsJmh` を呼び出して `Float32Array` の `[J, M, h, J, M, h, ...]` を返す形にする。

並列化の判断は画像サイズで切り替える。総画素数が 256k 以下のときはメインスレッドで同期実行し、Worker の起動と Transferable 転送のオーバーヘッドが利得を上回る区間を避ける。256k より大きいときは `navigator.hardwareConcurrency - 1` 個の Worker を立ち上げて RGBA バイト列を chunk に分割し、`postMessage(req, [chunk.buffer])` で transfer する。

chunk 分割の段で元 `Uint8ClampedArray` から各 Worker 用 `ArrayBuffer` への 1 回のコピーが発生する。これは `ArrayBuffer` 単位でしか transfer できない制約から来る最小コストで、本 feature ではこの形で運用する。将来 SharedArrayBuffer を導入する場合は COOP / COEP ヘッダの設定が前提になるので、専用の issue を立てて検討する。

### 3. threshold histogram

`gather` 関数で画素を「色バケット」に集計する。

```ts
function gather(pixels: Cam16UcsJmh[], threshold: number): Histo[] {
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

`canBucket` は CAM16-UCS Jmh 上の重み付きユークリッド距離が threshold 以下なら true を返す。重みは `WEIGHTS_BUCKETING = [1.0, 1.0, 1.5]` を `[J, M, h]` の順で適用し、各軸を `[100, 40, 180]` で正規化してから距離を取る。正規化定数は wallust と同じ値で、これによりユーザーから見た threshold のスケールが Rust 版と互換になる。

### 4. auto_threshold

固定列 `[14, 16, 13, 17, 12, 18, ..., 2, 38..44]` の各 threshold で並列に `gather` から `scoreHistogram` まで走らせ、スコアが最大になる histogram を採用する。固定列は wallust の `salience.rs::auto_threshold` と同じ 42 要素を使う。

スコア式は色対の顕著性を count 重み平均で集計する形で、wallust の `score_histogram` の式と一致させる。

```text
score = Σ_{i<j} salience(c_i, c_j) × w_ij / Σ_{i<j} w_ij
w_ij = (count_i × count_j) ^ (1/4)
```

並列実行は段 2 と同じ Web Worker pool を使い回し、`navigator.hardwareConcurrency` を上限 8 にキャップする。連続 2 回スコアが下がったら探索を打ち切る打ち切り条件も wallust に揃える。

### 5. dedup と post_dedup

dedup は `gather` と同じ閾値で隣接バケットを再統合し、post_dedup は最低顕著色を背景仮置きに選んで各バケットの salience スコアを計算し直してソートする。

salience スコアは「背景仮置きに対する full salience」で、重み `WEIGHTS_FULL = [1.0, 1.0, 1.0]` を使う。背景候補の選定にだけ `WEIGHTS_NAIVE = [1.0, 5.0, 0.0]` を使い、hue を無視して colorfulness を重視する形で「画面で目立たない暗めの色」を当てる。この使い分けは wallust の `Weights` プリセットの定義そのままになる。

### 6. salience_palette

ソート済みヒストグラムから 16 色を作る。本 spec では wallust の `salience_palette` を balanced sampling と Normal intensity の組み合わせで移植し、その他のサンプリングモードや intensity は別 issue (`#036` `#037`) で扱う。

- `background`: 背景仮置きを `constrainColAsBg` で範囲補正
- `color0`: 背景に最も近い色
- `color1` から `color6`: 中央付近からサンプリング (balanced)
- `color7`: 最顕著色の lightness を 25% 上げる
- `color8`: `color7` の lightness を 30% 下げる
- `color9` から `color14`: `color1` から `color6` と同色 (`use16cols` off の挙動)
- `color15`: 最顕著色と白の blend
- `cursor`: foreground と `color5` の中間色

## 主要な型と定数

`Cam16UcsJmh`, `Histo`, `Colors` を中心とした型と、wallust と互換な数値定数を 1 箇所にまとめて保持する。

- `Cam16UcsJmh`: `{ j: number; m: number; h: number }`
- `Histo`: `{ color: Cam16UcsJmh; count: number; score: number }`
- `Colors`: 16 色 + bg/fg/cursor + source/meta
- `Style`: `"dark" | "light"`
- `Parameters`: `{ lA: number; yB: number; surround: "average" | "dim" | "dark" }`
- `BakedParameters`: `Parameters` から導出した CAM16 計算用の係数群
- `RESIZE_LONG_EDGE = 512`
- `PARALLEL_PIXEL_THRESHOLD = 256_000` (これ以下は同期実行)
- `THRESHOLD_SEQUENCE`: wallust と同じ 42 要素の固定列
- `WEIGHTS_NAIVE = [1.0, 5.0, 0.0] as const`
- `WEIGHTS_FULL = [1.0, 1.0, 1.0] as const`
- `WEIGHTS_BUCKETING = [1.0, 1.0, 1.5] as const`
- `J_MAX = 100`, `M_MAX = 40`, `H_MAX = 180`
- dark 用パラメータ: `{ lA: 140, yB: 0.2, surround: "average" }`
- light 用パラメータ: `{ lA: 500, yB: 0.8, surround: "average" }`

## 依存

CAM16-UCS Jmh の TS 実装を提供する既存ライブラリは無いので、変換は本 feature 内の純粋関数として持つ。

- パッケージ: `culori` (Srgb の取り扱いと sRGB ↔ linearRGB 変換のみ。CAM16 変換は自前)
- 他 feature: なし

## 設計の前提と制約

メモリキャッシュは `Map<hash, Colors>` の LRU で持ち、永続化は対象外にする。`hash` は画像バイト列の FNV-1a で取り、`style` 違いは別エントリとして扱う。

intensity 補正 (Pastel / Vibrant) と sampling mode (high / distributed / low) は別 issue で実装するため、本 spec では balanced + Normal の組み合わせ 1 種類に固定する。WCAG コントラスト補正と背景マスキングも本 feature の責務外で、palette-design feature 側で行う。

`style` (dark / light) は本 feature の入力として受け取るが、どちらを採用するかの判定そのものは palette-design の責務になる。color-extract は与えられた style に対して観察条件を組み立てて 1 セットの `Colors` を返すことに専念する。

auto_threshold の Web Worker 並列実行は探索順とスコア計算の独立性により再現性を保てるが、ベンチマークで揺らぎが出る場合は固定シードや決定的な順序で結果を集約する追加対応を入れる。

## 関連

- PoC: docs/issue/done/040-cam16-ucs-ts-poc.md
- PoC の採用判定レポート: docs/references/cam16/ts-port-feasibility.md
- 移植元: library/wallust/src/histogram/{mod,salience,diff}.rs
- 後続 issue: #036 intensity (Pastel / Vibrant)、#037 sampling mode、#038 WCAG コントラスト、#039 idea 3 系統割り当て
