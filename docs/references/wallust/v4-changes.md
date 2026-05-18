# wallust 4.0.0-alpha 差分レポート

3.x 系の挙動を前提に書かれた `overview.md` を更新するため、`library/wallust/` に取り込まれている 4.0.0-alpha のソースを読み、3.5.2 からの破壊的変更とアルゴリズム刷新を整理した。oshicolor への展開判断は別途行うことを前提に、ここでは 4.0.0 の差分そのものに集中する。

---

## 1. 全体像

4.0.0-alpha は wallust の中核を「色空間 × パレット」の組み合わせ設計から「ヒストグラム生成と 3 モードのパレット」設計へ作り直したメジャーリリースで、知覚色空間も Lab/Lch から CAM16-UCS に置き換わった。設定ファイルも実態に合わせて再設計されており、`wallust migrate` を通さなければ 3.x の設定はそのまま読めない。

旧 `src/colorspaces/` と `src/palettes/` の 2 ディレクトリが完全に削除され、代わりに `src/histogram/` 配下にすべての色処理が集約された。差分の規模は src/ だけで `+4193 / -3418` 行に達する。

| 区分 | 3.5.2 | 4.0.0-alpha |
|------|-------|-------------|
| 色処理モジュール | `colorspaces/` (lab, lch, lchansi, lchsalience, fallback_generator) | `histogram/` (mod, salience, ansi, kmeans, diff, util) |
| パレット | `palettes/` (dark, harddark, softdark, light, softlight, ansidark, salience) | `histogram::Palette` enum (Salience, Ansi, Kmeans) |
| 知覚色空間 | Lab と Lch (palette クレート 0.7) | CAM16-UCS Jmh (palette クレート 0.7 の cam16 モジュール) |
| Kmeans の位置 | `backends/kmeans.rs` | `histogram/kmeans.rs` |
| デフォルトパレット | `lch` 系 | `salience` |
| リポジトリ | GitHub | Codeberg (`codeberg.org/explosion-mental/wallust`) |

リポジトリも GitHub から Codeberg に移転している。これは README のバッジと `Cargo.toml` の `repository` フィールドから確認できる。badge の登録先と CI も Codeberg CI に切り替わっており、ホスト移動はソフトな破壊的変更として扱う必要がある。

---

## 2. モジュール再編と新規パイプライン

旧 v3 の「Backend → ColorSpace → Palette → 後処理」という 4 段は、v4 で「Backend → Palette mode (3 種)」の 2 段に圧縮された。Backend は依然として画素取得だけを担うが、色抽出と 16 色割り当てが `Palette` enum の各分岐に統合されている。

`src/lib.rs` の `gen_colors` は次のような形になっている。

```rust
let histop = HistoParams::from_config(&c);
let mut run = |bytes: &[u8]| -> Colors {
    match histop.palette {
        Palette::Salience => {
            let mut histo = Histogram::from_params_empty(&histop);
            *histo
                .use_dynamic_lookup(bytes, c.dynamic, cache_opt)
                .dedup()
                .post_dedup()
                .with_intensity(&histop.salience)
                .salience_palette(&histop.salience.sampling)
                .use16col(histop.use16cols)
        },
        Palette::Ansi   => *ansi(bytes, histop.ord).use16col(histop.use16cols),
        Palette::Kmeans => *kmeans(bytes, histop.kmeans).use16col(histop.use16cols),
    }
};
```

各 Palette が `Colors` を直接返すため、旧 v3 のように ColorSpace 側でソート済み Vec を作って Palette 側で再解釈する 2 段構成は消えた。Salience だけが Histogram を経由する一方、Ansi と Kmeans は内部処理を持つことで、計算量とアルゴリズムの相性に応じて経路が分けられている。

Backend は 5 種類に減った。3.x で存在した `Kmeans` Backend は削除され、`Kmeans` は Palette 側に移っている。コミット `9d053ae` の "move kmeans into it's own palette, rather than being a backend" がこの再分類の主旨で、kmeans は実体としては画素を読んで色を選ぶ処理であり、Backend ではなく抽出器であるという解釈の整理にあたる。

| Backend | 3.5.2 | 4.0.0 |
|---------|-------|-------|
| Full | あり | あり |
| Resized | あり | あり |
| Wal | あり (ImageMagick) | あり |
| Thumb | あり | あり |
| FastResize | あり (default) | あり (default) |
| Kmeans | あり | 削除 |

JXL 形式のサポートも `image::open_with_imagers` に追加されており、拡張子 `.jxl` のファイルは `jxl-oxide` クレートでデコードされる。

---

## 3. `histogram/` の構成と各ファイルの責務

`histogram/` は 6 ファイルで構成され、依存方向は次のようになっている。`mod.rs` が共通型と `gather` パイプラインを公開し、Palette ごとの実装ファイルがそこに impl ブロックで肉付けする形をとる。

```text
mod.rs       (型と pipeline の入口)
 │
 ├─ pub mod salience  →  diff, util, palette::cam16
 ├─ pub mod kmeans    →  kmeans_colors, palette::Lab  (CAM16 を経由しない独立経路)
 ├─ pub mod ansi      →  util::avg, palette::Hsv      (CAM16 を経由しない独立経路)
 │
 ├─ mod diff          →  mod.rs::{Spec, ColorOrder}, util::{normalize_to_sum, stretched_exp}
 └─ mod util          →  純粋な算術ヘルパー (色依存なし)
```

`salience` だけが `Histogram` 型と `diff` の重み体系を使う「フル経路」で、`ansi` と `kmeans` は `Histogram` を経由せずに `bytes` から直接 `Colors` を作る独立経路として並列に置かれている。この配置は「Salience が複雑な多段処理を必要とし、ansi と kmeans は短絡できる」という処理量の非対称さに合わせた設計上の選択になっている。

各ファイルの役割を順にまとめる。

### `mod.rs` — 型と gather pipeline の入口

このファイルが `histogram` モジュールの公開面を一手に引き受ける。`Palette` enum (Salience / Ansi / Kmeans)、共通型 `Spec = Cam16UcsJmh<f32>`、ヒストグラム表現 `Histo` と `Histogram`、設定束ね型 `HistoParams`、ソート方向 `ColorOrder`、サンプリングモード `SamplingMode` と強度 `SalienceIntensity` がここに定義されている。

加えて Salience の前段で使う共通関数 `gather` と `read_bytes` を持ち、`Histogram::new_empty`, `from_params`, `with_th`, `fill_histo`, `fill_histo_mut` といったコンストラクタとビルダーもここに集めてある。これは Salience 専用の処理を `salience.rs` の impl ブロックに分けつつ、その手前の bytes 読み込みと素朴な histogram 構築を Palette 共通の準備として独立させたい意図による。

依存先は `palette` クレートの `cam16` モジュールと `serde`、`crate::colors`, `crate::config` で、内部的に `diff::Bucketing`, `util::avg`, `salience::rgb_to_cam` を呼ぶ。

### `salience.rs` — Histogram に「育てる」処理を生やす

このファイルは「型は `mod.rs` にあるが振る舞いはここに置く」という分業で、`impl Histogram { ... }` ブロックを通じて pipeline の中盤以降をまとめて追加する。`dedup`, `post_dedup`, `with_intensity`, `salience_palette`, `use_dynamic_lookup`, `auto_threshold`, `constrain_col_as_bg`, `to_rgb`, `to_rgbs`, `from_rgb` といったメソッド群がここで生える。

加えて Histogram に紐づかない自由関数として `score_histogram` (multithread 探索のスコア計算)、`constrain_col_against_cols` (背景補正)、`rgb_to_cam` (sRGB から CAM16 への変換) をエクスポートする。これらは Salience だけでなく `mod.rs` の `read_bytes` からも呼ばれるため、自由関数として独立させてある。

依存先は `palette::cam16`, `palette::{Clamp, FromColor, IntoColor}`, `itertools::Itertools`, `super::diff::{Bucketing, Difference}`, `super::*` (`Spec`, `Histogram`, `ColorOrder`, 各種定数)。

### `ansi.rs` — HSV ベースの ANSI 抽出

`ansi` Palette モード専用の独立経路で、`Histogram` 型を使わない。`Cam16UcsJmh` への変換コストを払うのは hue を 6 分類するだけの ansi では割が合わないため、`palette::Hsv` で直接処理する設計を取っている。これは src のドキュメントコメントとコミット履歴 (`3238cca`) で明示されている。

公開関数は `pub fn ansi(bytes: &[u8], ord: ColorOrder) -> Colors` 1 つで、内部に hue 範囲を表す `Range` 構造体と 6 つの定数 `RED, YELLOW, GREEN, CYAN, BLUE, MAGENTA` を持つ。`get_color` がバケット単位で pixel を drain しながら hue・saturation・value の重み付き平均を取り、欠損バケットは既定値で合成する。

依存先は `palette::{Darken, Hsv, IntoColor, Lighten, Srgb}`, `super::ColorOrder` (型だけ借りる)、`super::util::avg`, `crate::colors::{Colors, ColorsSrgb}`。

### `kmeans.rs` — Lab ベースの Hamerly Kmeans 抽出

`kmeans` Palette モード専用の独立経路で、こちらも `Histogram` 型を使わず CAM16 にも触らない。`kmeans_colors::get_kmeans_hamerly` を 1 回だけ呼んで Lab 空間で重心を求め、Lab の lightness でソートしてから DeltaE で近すぎる重心を落とし、8 個を等間隔サンプルして 16 色に展開する。

公開関数は `pub fn kmeans(bytes: &[u8], config: KmeansConfig) -> Colors` 1 つで、内部の `bytes_to_lab` が sRGB バイト列を Lab に変換するヘルパーになっている。`fastrand::seed(0xBEEF)` でシードを固定するため、同じ画像と config なら結果が一意になる。

依存先は `kmeans_colors`, `palette::{cast::ComponentsAs, color_difference::DeltaE, FromColor, IntoColor, Lab, Srgb, white_point::D65}`, `crate::colors::{Colors, ColorsSrgb}`, `crate::config::KmeansConfig`。

### `diff.rs` — 色差と顕著性の定義

CAM16-UCS 上の色差計算を 1 ファイルに集約しており、Salience pipeline の判定基準はすべてここに収まる。トレイト `Difference` が 8 種類の距離関数 (`de`, `de_i`, `de_naive`, `de_naive_i`, `sal`, `sal_i`, `sal_naive`, `sal_naive_i`) を、トレイト `Bucketing` が `can_bucket` を `Spec` に対して実装する。

重みは enum `Weights` の 3 バリアント (`Bucketing`, `Salience`, `SalienceNaive`) で切り替える形になっており、これにより呼び出し側が用途 (近接判定なのか顕著性ソートなのか) ごとに使い分けられる。自由関数の `sal_delta_m` と `sal_delta_h` は colorfulness と hue の差に明度減衰をかける補助で、`util::stretched_exp` を介して低明度域での寄与を抑える役を担う。

依存先は `palette::{GetHue, color_difference::{DeltaE, ImprovedDeltaE}}`, `crate::histogram::ColorOrder`, `super::Spec`, `super::util::{normalize_to_sum, stretched_exp}`。`#![allow(unused)]` が頭に付いており、未使用の距離関数も将来切り替え用に残されている。

### `util.rs` — 色に依存しない算術ヘルパー

このファイルだけは色も `palette` クレートも使わず、純粋な算術関数だけが並ぶ。`avg`, `stretched_exp` (距離減衰用)、`normalize_to_sum` (重みの正規化)、`sample_distributed` (両端寄りサンプリング)、`sample_center` と `sample_center_idxs` (中央付近サンプリング) を提供する。

`avg` と `stretched_exp` と `normalize_to_sum` は `diff.rs` から、`sample_*` 系は `salience.rs` の `salience_palette` から、`avg` は `ansi.rs` からと、複数の Palette 経路にまたがって使われる。色に依存させていないのは、将来的に別の色空間や別 Palette を増やしてもここを差し替える必要がない作りにしておくため。

---

## 4. CAM16-UCS への移行

色の代表点と差分を扱う型は `Lab` と `Lch` から `Cam16UcsJmh<f32>` に置き換わった。これは Salience パイプラインの中核となる型変更で、`src/histogram/mod.rs` の冒頭で `pub type Spec = Cam16UcsJmh<f32>;` と定義されている。

CAM16-UCS を採用した理由は `src/histogram/salience.rs` の冒頭コメントに明記されている。Lab や Lch は明度と彩度を物理量にひもづけて表す一方、CAM16 の Jmh は lightness と colorfulness を知覚にひもづけて表現するため、明度を強制しても色相が破綻しない。Salience 計算がコンポーネントのユークリッド距離として素直に書ける利点もある。

CAM16 は観察条件をパラメータに取れる色モデルなので、Histogram は dark テーマと light テーマで異なる `BakedParameters` を生成している。

```rust
let (wp, bg_lum) = match ord {
    ColorOrder::LightFirst => (140.0, 0.2),
    ColorOrder::DarkFirst  => (500.0, 0.8),
};
let mut view = Parameters::default_static_wp(wp);
view.background_luminance = bg_lum;
view.surround = Surround::Average;
```

LightFirst (dark テーマ) は薄暗い室内 (140 cd/m²、bg 20%) を想定し、DarkFirst (light テーマ) は明るい室内 (500 cd/m²、bg 80%) を想定する。同じ画像でも閲覧環境を切り替えると見え方が変わるため、テーマ側の前提に合わせて CAM16 のパラメータを動かす設計になっている。

色差・近接判定も再設計された。`histogram/diff.rs` には `Difference` と `Bucketing` の 2 トレイトが定義され、6 種類の距離関数 (de, de_i, de_naive, de_naive_i, sal, sal_i, sal_naive, sal_naive_i) が並ぶ。重みは 3 種類のプリセットで切り替えられる。

| 用途 | 重み (J, M, h) |
|------|---------------|
| Bucketing | [1.0, 1.0, 1.5] |
| Salience | [1.0, 1.0, 1.0] |
| SalienceNaive | [1.0, 5.0, 0.0] |

Bucketing は同種の色をまとめる用途で hue を強めに重み付けし、SalienceNaive は背景未確定段階での暫定スコアとして hue を切り捨て colorfulness を強めるという役割分担になっている。`can_bucket` は内部で `[100, 40, 180]` で正規化してから重み付き 2 乗和の平方根を取り、threshold と比較する。これによりユーザーから見た threshold のスケールが 3.x と互換になるよう調整されている。

---

## 5. Palette enum の整理

3.x のパレット (`dark`, `harddark`, `softdark`, `light`, `softlight`, `ansidark`, `ansilight`, `saliencedark`, `saliencelight`, それぞれの 16cols/comp 派生) は 4.0.0 でわずか 3 種類に統合された。

| 4.0.0 の Palette | 役割 | 3.x での対応 |
|------------------|------|-------------|
| `Salience` (default) | 知覚顕著性ベースのヒストグラム抽出 | `dark`, `harddark`, `softdark`, `saliencedark*`, `light`, `softlight`, `saliencelight*` |
| `Ansi` | HSV ベースの ANSI 順割り当て | `ansidark`, `ansilight` |
| `Kmeans` | Lab 空間 Kmeans (Hamerly) | `Kmeans` backend |

`dark` か `light` かは `Palette` ではなく独立した `Style` enum で指定する設計に変わった。

```toml
palette   = "salience"
style     = "dark"     # or "light"
use16cols = true       # optional, dims the upper half of the palette
```

`harddark` や `softdark` の差は廃止されている。代わりに `salience` モードに 2 軸の微調整パラメータが用意されており、`sampling` と `intensity` で挙動を選ぶ。

```toml
salience = { sampling = "balanced", intensity = "normal" }
```

`sampling` は `salience_palette` 内部で 6 色を選ぶときの取り方を決める。

| sampling | 挙動 |
|----------|------|
| `balanced` (default) | 中心からの偶数間隔抽出 |
| `distributed` | 分布の端寄りを多く取る |
| `high` | 顕著性スコアの高い側に偏らせる |
| `low` | 顕著性スコアの低い側 (cols.len() - 6 から) を使う |

`intensity` は `with_intensity` 内部で histogram の並び順を softness か vibrant に再ソートする。Pastel は colorfulness のボーナスで柔らかい色を前に出し、Vibrant は colorfulness から lightness/2.5 を引いた式で派手な色を前に出す。Normal は何もしない。background は常に先頭 (`histo[0]`) として固定し、insert で復帰させるため、background が並べ替えに巻き込まれない。

補色 (`comp`) パレットは v3 でこの組み合わせとして存在したが、4.0.0 では削除された。Migration ドキュメントには「complementary mode is no longer a palette variant」と明記されている。

---

## 6. Ansi モードと Kmeans モード

Ansi モードは v3 の `LchAnsi` をベースにしつつ、内部表現は CAM16 ではなく HSV になった。これはコミット `3238cca` の "up ansi taking too long because of convertion to CAM" の指摘どおり、ansi では hue 分類しか必要ないため CAM16 変換のコストが無駄になるからだ。`src/histogram/ansi.rs` 冒頭のコメントにこの理由が明記されている。

hue バケットは 6 種で v3 の `LchAnsi` と同じ境界だが、各バケットに `(saturation_default, value_default)` の対が付き、信頼率 `T = 0.5` で画像から得た平均と既定値を内分する。

```rust
const RED:     Range = Range { hue_start:   0.0, hue_end:  60.0, sat_def: 0.90, val_def: 0.65 };
const YELLOW:  Range = Range { hue_start:  60.0, hue_end: 120.0, sat_def: 0.90, val_def: 0.75 };
const GREEN:   Range = Range { hue_start: 120.0, hue_end: 180.0, sat_def: 0.80, val_def: 0.65 };
const CYAN:    Range = Range { hue_start: 180.0, hue_end: 210.0, sat_def: 0.80, val_def: 0.75 };
const BLUE:    Range = Range { hue_start: 210.0, hue_end: 280.0, sat_def: 0.90, val_def: 0.55 };
const MAGENTA: Range = Range { hue_start: 280.0, hue_end: 360.0, sat_def: 0.80, val_def: 0.70 };
```

このバケットは v3 の `LchAnsi` と同じ範囲だが、v3 にあった「`unreachable!()` で書かれた `color_generator`」のような特殊ルートはなくなり、欠損 hue は単に既定の `(sat_def, val_def)` で合成される。black と gray は画像の最暗・最明画素から合成し、見つからなければ平均から擬似的に作る。Light スタイルでは各バケットの `val_def` が個別に下げられる別ルートが用意されている。

Kmeans モードは Backend から Palette に移ったうえで、いくつか実装が簡略化された。`get_kmeans_hamerly` を 1 回だけ呼ぶように変わっており (v3 は 5 回回して最良を取る)、デフォルト `k = 16` (v3 は 6)、`min_dist = 10.0` の dedup ステップが追加された。

```rust
fastrand::seed(0xBEEF);
let result = get_kmeans_hamerly(k.into(), 100, 1e-3, false, &pixels, fastrand::u64(..));
// sort by Lab lightness
// drop too-close centroids by DeltaE
// sample 8 evenly across the deduped range
```

シードを `0xBEEF` で固定する慣習は v3 から維持されている。色重心は Lab で扱うため、CAM16 への置き換えは Salience だけに留まっている。`min_dist` という新しいノブで、知覚的に近すぎる重心を 1 つの色として落とすステップが加わったのが実装上のポイントになる。

---

## 7. Config スキーマと CLI の変更

`Config` 構造体には `style`, `palette`, `salience`, `kmeans`, `use16cols`, `templated_hooks`, `no_templated_hooks`, `dynamic` といったフィールドが新たに加わり、`colorspace` は完全に削除された。

```toml
# v4 wallust.toml
backend        = "fastresize"
threshold      = 0           # 0 means dynamic auto-threshold
palette        = "salience"
style          = "dark"
use16cols      = false
check_contrast = false

[salience]
sampling  = "balanced"
intensity = "normal"

[kmeans]
k        = 16
min_dist = 10.0

[hooks]
notify = "notify-send 'wallust' 'done'"

[templated_hooks]
inform = "notify-send 'wallust' 'Generated from {{wallpaper | basename}}'"
```

`threshold = 0` のときに dynamic lookup を有効にする内部フラグが立つ仕組みで、`config.dynamic` は serde スキップされ実行時に決まる。明示的に `--dynamic-threshold` CLI フラグでも有効にできる。

`templated_hooks` は v4 で追加された新セクションで、各 value は実行前に jinja2 でレンダリングされ、`{{colors}}`, `{{wallpaper}}`, `{{backend}}`, `{{palette}}`, `{{alpha}}` を参照できる。コミット `119bbcb` "feat: add [templated_hooks]" がこの導入で、テンプレート機能と hook 機能の境界をなくしたい意図が見える。

旧設定との互換性は維持しない方針が明確で、`config.rs` 内のエラーメッセージは `wallust migrate` と v4 docs (`https://explosion-mental.codeberg.page/wallust/v4.html`) を案内する文面に変わっている。v3 の `[[entry]]` 配列は `Config` 上に `#[deprecated]` 付きで残されているが、これは migrate 専用で、通常実行では `[templates]` テーブルを使う前提になっている。

CLI には新サブコマンドが追加された。`wallust pick` は wal-theme-picker から移植された機能で、画像に最も合う組み込みテーマを選ぶ用途で、コミット `3c2dd00` "Implement wallust pick, from wal-theme-picker" で導入された。`wallust theme list-fzf` は fzf ベースのテーマ検索で、コミット `c3bda11` で追加されている。`wallust pick` は `themes` フィーチャーが必要で、`lib.rs` でも `#[cfg(feature = "themes")] pub mod pick;` とゲートされている。

---

## 8. 動的しきい値探索の刷新

`auto_threshold` はマルチスレッド並列の探索になり、v3 の二分探索風アプローチから「スコア最大化探索 + 早期打ち切り」の形に変わった。`src/histogram/salience.rs` の `auto_threshold` が実体で、探索順は次のように `14` を起点に上下に広げる固定列を持つ。

```rust
let idx = [14, 16, 13, 17, 12, 18, 11, 19, 10, 20, 9, 21,
            8, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33,
           34, 35, 36, 37, 7, 6, 5, 4, 3, 2,
           38, 39, 40, 41, 42, 43, 44];
```

このインデックス列を `available_parallelism()` でチャンク分割し、各 threshold を別スレッドで `Histogram::with_th(th).fill_histo(bytes)` させる。各候補のスコアは `score_histogram` 関数で求めて、スコアが直前より連続 2 回下がった時点で探索を打ち切る。

スコア式は色同士の salience を count に基づくサブ重みで加重平均したもので、コミット `e86c87b` "First working version of score_histogram multithreaded lookup" の段階で導入された。

```rust
for i in 0..histo.len() {
    for j in (i + 1)..histo.len() {
        let sal = histo[i].color.sal_i(&histo[j].color, Weights::Salience.value());
        let wi = (histo[i].count as f32).powf(1.0 / cnt_sclr);
        let wj = (histo[j].count as f32).powf(1.0 / cnt_sclr);
        let w = wi * wj;
        total += sal * w;
        weight += w;
    }
}
total / weight
```

v3 では「threshold を 14 から伸ばし、色数が 6 から 16 に収まるしきい値を採用」というロジックだったが、v4 では「色数」ではなく「色同士の知覚的離れ具合の平均」を最大化する。これにより、ヒストグラムが過度に細かくも荒くもならないバランス点が選ばれる。

dynamic threshold の結果はキャッシュ層で再利用される。`use_dynamic_lookup` は `Cache::read_auto` で前回値を取り出して再利用し、無ければ `auto_threshold` を回して `Cache::write_auto` で永続化する。これにより同一画像の 2 回目以降は探索コストがゼロになる。

---

## 9. キャッシュとポストプロセス

`Cache` は 3 状態 (`None`, `Backend`, `BackendnPalette`) を返す `is_cached_all` を中心に作り直されている。Backend cache は `Full` Backend では書き込まれない最適化が入った。`Full` は元画像をそのまま使うため Backend キャッシュとファイル本体が同サイズになり、キャッシュする意味がないからだ。

`postcolor` は `lib.rs` 末尾に独立した関数として残っており、3 つのフェーズを順に実行する。

```rust
pub fn postcolor(c: &Config, colors: &mut Colors) {
    if c.use16cols { colors.set_16col(); }
    if c.check_contrast { colors.check_contrast_all(); }
    if let Some(s) = c.saturation { colors.saturate_colors(f32::from(s) / 100.0); }
}
```

`use16cols` の処理が postcolor に組み込まれた点と、`saturation` が `Option<u8>` で 100 で割って小数として渡される点が v3 からの変更にあたる。`check_contrast_all` 自体のロジック (背景と前景や各色の WCAG 21 コントラスト比を 10 回まで補正) は v3 から大きく変わっていないが、postcolor の前段が `Colors` をパレットモードごとに直接組み立てる構造に変わっているため、コントラスト補正の入力品質も Salience の場合は CAM16 経由になる。

---

## 10. 依存とビルド面

クレートの依存も大きく更新されている。Cargo.toml の主要な変化を抜き出すと次のとおり。

| クレート | 3.5.2 想定 | 4.0.0-alpha |
|----------|-----------|-------------|
| image | 0.24 系 | 0.25 |
| palette | 0.7 (Lab/Lch 中心) | 0.7 (cam16 モジュールを使用) |
| minijinja | 1.x | 2.19 |
| toml | 0.7 系 | 1.1 |
| toml_edit | 0.20 系 | 0.25 |
| kmeans_colors | 0.6 系 | 0.7.0 (`palette_color` feature) |
| jxl-oxide | 未使用 | 0.12.5 (新規追加) |
| dunce | 未使用 | 1.0 (新規追加、Windows パス対策) |
| walkdir | 未使用 | 2.5 (新規追加) |
| thiserror | 1.0 | 2.0 |
| dirs | 5.0 系 | 6.0 |
| spinners | 4.x | 4.2 |
| itertools | 0.12 系 | 0.14 |
| fastrand | 必須 | optional (`themes` feature 依存) |
| wallust_themes | 必須 | optional (`themes` feature 依存) |

`wallust_themes` と `fastrand` が `default = ["themes"]` のフィーチャー扱いになり、theme サブコマンドや pick サブコマンドを使わない場合は外せるようになった。これによりライブラリ利用時のバイナリサイズや依存グラフを縮められる。

`buildgen` フィーチャーは man ページや completions、JSON schema の生成に使われる開発時専用で、`documented`, `strum`, `schemars`, `clap_complete`, `clap_mangen` をまとめてオンにする。`schemars` は `1.2` まで上がっており、`PrettyConfig` や `SalienceConfig` などの構造体に `JsonSchema` derive が振られて wallust.toml の自動補完用 JSON schema が出力できる。

ライセンスは引き続き MIT で、3.x からの変化はない。

---

## 11. ライセンスと配布の注意

`library/wallust/LICENSE` は MIT で、3.x と同じく商用利用や派生利用に制約はない。ただし `default = ["themes"]` で取り込まれる `wallust_themes = "1.1"` は別パッケージで、こちらも MIT だが、用途が「組み込みカラーテーマの bundle」のためコンテンツ部分には注意して取り扱う必要がある。oshicolor が wallust ロジックの一部を Rust ライブラリとしてリンクするケースを想定するなら、`themes` フィーチャーを外して依存グラフを最小化すると license review が楽になる。

リポジトリの移転に伴い crates.io のメタデータも `repository = "https://codeberg.org/explosion-mental/wallust"` に変わっている。pre-release 版なので `cargo install wallust` では 3.5.2 が入る点に注意する。`wallust = "=4.0.0-alpha"` か `git = "https://codeberg.org/explosion-mental/wallust"` 経由でのみ 4.0.0-alpha が取れる。

---

## 12. 直接読むべきファイル

v4 の挙動を理解するために、ソースを読む順序は次のようにすると無駄が少ない。

1. `library/wallust/docs/v4.md` は migration guide で、ユーザー視点での破壊的変更を 1 ページで掴める
2. `library/wallust/src/lib.rs` の `gen_colors` (lib.rs:118-195) はパイプライン全体の入り口で、Palette 分岐とキャッシュの組み合わせを 80 行で読める
3. `library/wallust/src/histogram/mod.rs` は `Palette`, `HistoParams`, `Histogram`, `ColorOrder`, `SamplingMode`, `SalienceIntensity` の型定義と CAM16 観察条件の初期化が並ぶ
4. `library/wallust/src/histogram/salience.rs` は salience pipeline の核で、`use_dynamic_lookup`, `dedup`, `post_dedup`, `with_intensity`, `salience_palette`, `auto_threshold`, `score_histogram` が一通り入っている
5. `library/wallust/src/histogram/diff.rs` は `Bucketing` と `Difference` の重み定義で、CAM16 ベースの色距離をどう実装したかが分かる
6. `library/wallust/src/histogram/ansi.rs` は HSV ベースの ANSI 抽出で、CAM16 を使わない選択の理由がコメントに書かれている
7. `library/wallust/src/histogram/kmeans.rs` は Hamerly Kmeans の 1 回回しと min_dist dedup の最小実装
8. `library/wallust/src/config.rs` の `Config` と `PrettyConfig` で v4 の設定スキーマが確認できる。`From<PrettyConfig> for Config` の実装が default 値の単一の出所になる
9. `library/wallust/docs/parameters/palette.md` と `library/wallust/docs/parameters/threshold.md` は CLI と config 両面からの使い分けの公式記述

---

## 13. まとめ

wallust 4.0.0-alpha は「色空間 × パレット」の組み合わせ展開を捨て、Salience を中心に据えた単一パイプラインに収斂させた点が最大の変更で、Lab/Lch から CAM16-UCS への移行と、`Palette` の 3 モード化、`style` と `salience` 設定の分離が表裏一体で連動している。Kmeans は palette 側に移り、Backend は純粋に画素取得のみを担うようになった。

設定スキーマと CLI には破壊的変更が並ぶ。`wallust migrate` を通さない限り 3.x の wallust.toml はそのまま読めず、`colorspace` キーは無視される。pre-release タグ付けと crates.io 上の挙動から、リリース管理上はまだ 3.5.2 が stable で、4.0.0 系は git/codeberg 経由でのみ取得できる状態にある。
