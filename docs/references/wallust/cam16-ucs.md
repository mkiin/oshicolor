# CAM16-UCS 入門と wallust 実装の読み解き

wallust 4.0.0-alpha が知覚色空間を Lab/Lch から CAM16-UCS に置き換えた背景を理解するため、CAM16 と CAM16-UCS の中身を整理し、`library/wallust/src/histogram/` での扱われ方を読み解く。色彩科学の規格と Rust の `palette` クレート、wallust のラッパーという 3 層を順に押さえる。

---

## 1. CAM16 と CAM16-UCS の位置付け

CAM16 は CIE が 2016 年に提案した color appearance model で、CIECAM02 を置き換える形で標準化された。color appearance model とは「ある観察条件のもとで人がその色をどう感じるか」を 6 つの知覚属性に分解して表現する数理モデルのことを指し、Lab や Lch のような単純な色空間とは目的が異なる。

CAM16-UCS は CAM16 の派生で、CAM16 が出力する属性をそのまま使うと色差計算が知覚と一致しない問題を埋めるために作られた「均等色空間 (Uniform Color Space)」になる。UCS は均等色空間という意味で、2 点間のユークリッド距離が知覚的な色差にほぼ比例する性質を持つ。これは CAM02-UCS で先行して導入された発想を CAM16 に持ち込んだ位置付けで、Luo, Li, Wang らの 2017 年の論文系列が出典になる。

両者の使い分けは次のように整理できる。CAM16 は「色がどう見えるか」を分解して扱うときに使い、CAM16-UCS は「2 色がどれくらい違って見えるか」を距離として扱うときに使う。wallust はヒストグラム上の距離や顕著性スコアを 2 乗和の平方根で計算するため、UCS の方を採用している。

---

## 2. なぜ Lab/Lch ではなく CAM16-UCS なのか

Lab と Lch も知覚色空間と呼ばれてはいるが、暗い色や明るい色を扱うときに色相と明度が不自然に絡む弱点を持つ。CAM16 はこの弱点を観察条件のパラメータ化で取り除いており、wallust のように同じ画像から dark テーマと light テーマを作り分ける用途では恩恵が大きい。

`src/histogram/salience.rs` の冒頭コメントが採用理由を端的に書いている。要約すると次のとおり。

- Lab は明度と彩度を物理量にひもづけているため、明度を強制すると色相が知覚的に破綻することがある
- CAM16 の Jmh は lightness と colorfulness を知覚にひもづけて表現するため、片方を操作してももう片方が壊れにくい
- 顕著性の計算がコンポーネントのユークリッド距離として素直に書ける

つまり「色を操作してもユーザーが感じる色相がずれにくい」「距離が直感に合う」という 2 点が、wallust が CAM16-UCS を選んだ動機にあたる。

CAM16 にはコストもある。XYZ から CAM16 への変換は CAT02/CAT16 行列での色順応、Hunt-Pointer-Estévez 空間での非線形圧縮、対立色信号への展開といった多段処理を含むため、Lab への変換より計算量が多い。wallust が ansi モードでだけ HSV を選び、Salience モードでのみ CAM16-UCS を使うのはこのコスト差が理由になる。

---

## 3. 6 つの知覚属性

CAM16 が扱う属性は 6 種類で、それぞれ別の知覚側面に対応する。

| 属性 | 意味 | wallust での主な用途 |
|------|------|---------------------|
| J | lightness、白を基準とした相対的な明るさ感 | 背景の決定、明度ソート |
| Q | brightness、観察条件込みの絶対的な明るさ感 | wallust では未使用 |
| C | chroma、明るさ参照での色の濃さ | wallust では未使用 |
| M | colorfulness、絶対的な色の濃さ | 彩度フィルタ、強度補正 |
| s | saturation、その色の明るさに対する濃さ | wallust では未使用 |
| h | hue angle、0 から 360 度の色相 | バケット分類、距離計算 |

CAM16-UCS Jmh は J と M と h を選んだ表現で、ファイル冒頭の `pub type Spec = Cam16UcsJmh<f32>;` がそれに当たる。Q や C や s は wallust では使われない。これは「色を操作する」用途には J と M と h の組が直感的で、それ以外の属性は冗長になるからだ。

J と M の違いはとくに重要で、たとえば青色を暗くしたいときに「J を下げる」と純粋に明るさだけが変わるが、「C を下げる」と「明るさ参照を介して色濃さも変わる」ため意図が混ざる。Lab で `L` を動かすと chroma がついてくる挙動を、CAM16-UCS は J と M に明確に切り分けて避けている。

---

## 4. 観察条件のパラメータ化

CAM16 が Lab と最も異なる点は、観察条件を入力として受け取ることにある。同じ XYZ 値でも、暗い部屋で見るか明るい部屋で見るかで人が知覚する色は変わる。CAM16 はこの「文脈」を陽に扱う。

入力パラメータは大きく 3 つある。

| パラメータ | 意味 | 単位 |
|-----------|------|------|
| adapting luminance (`L_A`) | 視野全体の照度 | cd/m² |
| background luminance (`Y_b`) | 刺激の周辺領域の相対輝度 | 0 から 1 |
| surround | 周辺環境の種類 (Average / Dim / Dark) | enum |

加えて参照白色点 (`white_point`) を D65 などで指定する。これらから内部的に色順応度 (D)、色順応行列のスケーリング、非線形圧縮の係数などが導出される。

`palette` クレートではこの初期化を `Parameters::default_static_wp(L_A)` でまとめて行い、追加で `background_luminance` と `surround` を後付けで設定する流儀になっている。wallust ではこれを ColorOrder に応じて切り替えている。

```rust
let (wp, bg_lum) = match ord {
    ColorOrder::LightFirst => (140.0, 0.2),
    ColorOrder::DarkFirst  => (500.0, 0.8),
};
let mut view = Parameters::default_static_wp(wp);
view.background_luminance = bg_lum;
view.surround = Surround::Average;
```

LightFirst (dark テーマ) の `L_A = 140 cd/m²` は薄暗い室内のディスプレイ環境を想定し、`Y_b = 0.2` で背景が暗めの状態を表現している。DarkFirst (light テーマ) の `L_A = 500 cd/m²` は明るい室内、`Y_b = 0.8` で背景が明るい状態を表す。Surround は両者とも Average で、テレビ視聴のような特殊環境を想定しない。

この観察条件込みでパラメータを 1 回計算して使い回すための型が `BakedParameters` で、wallust では `BakedParameters<StaticWp<D65>, f32>` の形で `Histogram::view` フィールドに保持する。`Parameters` から `BakedParameters` への変換は `into()` で行われる。`palette` 側の説明にあるとおり、繰り返し変換時のコストを下げる仕組みになっている。

---

## 5. UCS が解く問題と Jab / Jmh の関係

CAM16 そのものの出力空間は知覚的に均等ではない。たとえば青と紫の間の距離 1 と、黄と緑の間の距離 1 が、人にとって同じくらいの違いに感じられるとは限らない。これでは色差を距離で測る用途には使いにくい。

CAM16-UCS は CAM16 の出力 (J, M, h) に対して非線形変換と直交対立軸への展開を行い、ユークリッド距離が知覚的色差にほぼ比例するように調整した空間にあたる。元の論文では J を圧縮した `J'`、対立軸 `a'` と `b'`、極形式に戻した `M'` と `h'` を導入する。

`palette` クレートはこの空間を 2 つの座標表現で提供している。

| 型 | 座標 | 用途 |
|----|------|------|
| `Cam16UcsJab` | (J', a', b') | デカルト座標。フィルタや単純な距離計算に適する |
| `Cam16UcsJmh` | (J', M', h') | 極座標。hue を直接扱う処理に適する |

wallust は `Cam16UcsJmh` を選んでいる。これは hue バケット (ANSI モード) や hue 距離 (Salience の `sal_delta_h`) の計算で、極座標表現の方が扱いやすいからだ。デカルト形式の Jab は debug 用の `print_table` で内部の `a` と `b` を覗くときだけ呼ばれている。

---

## 6. palette クレートでの主要 API

`palette` クレートの cam16 モジュールは次の構成になっている。

```text
palette::cam16
 ├─ Parameters           — 観察条件
 ├─ BakedParameters      — 観察条件の前計算済み形
 ├─ StaticWp<D65>        — 静的白色点 (型レベルで D65 を指定)
 ├─ Surround             — Average / Dim / Dark
 │
 ├─ Cam16                — 6 属性すべて (J, Q, C, M, s, h)
 ├─ Cam16Jch / Cam16Jmh  — 部分属性 (lightness × 色濃さ × hue)
 ├─ Cam16Qch / Cam16Qmh  — brightness 版
 │
 ├─ Cam16UcsJmh          — UCS 極座標 (J', M', h')
 └─ Cam16UcsJab          — UCS デカルト (J', a', b')
```

XYZ との変換は `Cam16::from_xyz(xyz, view)` と `cam16.into_xyz(view)` で行う。view には `BakedParameters` を渡す。部分属性型 (`Cam16Jmh` など) や UCS 型 (`Cam16UcsJmh`) は `From<Color>` と `Into<Color>` の関係で相互に変換できるため、`from_color` と `into_color` で型を行き来する。

トレイト境界が増えるが、典型的な変換チェーンは次の形になる。

```text
Srgb<u8> -> Srgb<f32> -> Xyz -> Cam16 -> Cam16UcsJmh
                                       └─> Cam16Jmh -> Xyz -> Srgb<f32>
```

UCS は色操作と距離計算に使い、ピクセルへ書き戻すときは UCS から CAM16 (Jmh) を経由して XYZ に戻し、最終的に sRGB へ落とす。これは UCS そのものは XYZ への直接変換を持たないからで、CAM16 (Jmh) を中継点として使う必要がある。

---

## 7. wallust の変換ラッパー実装

`src/histogram/salience.rs` には sRGB と CAM16-UCS の間の変換が 2 つの小さな関数として置かれている。

```rust
pub fn rgb_to_cam(a: Srgb, view: VIEW) -> Spec {
    let cam16 = Cam16::from_xyz(a.into_color(), view);
    Cam16UcsJmh::from_color(cam16)
}
```

`rgb_to_cam` は sRGB を XYZ に変換してから CAM16 を計算し、最後に Cam16UcsJmh に落とすという 3 段経路を取る。`a.into_color()` は palette クレートの汎用変換で、sRGB から XYZ への一般的な経路を辿る。`Cam16::from_xyz` がここで観察条件 `view` を消費して 6 属性の CAM16 値を生成し、それを UCS 表現にマップする。

`to_rgb` は逆方向の経路で、`Histogram` に impl される。

```rust
pub fn to_rgb(&self, a: Spec) -> Srgb {
    let cam16: Cam16Jmh<f32> = a.into_color();
    let xyz = cam16.into_xyz(self.view);
    Srgb::from_color(xyz)
}
```

UCS から直接 XYZ には戻れないため、まず `Cam16Jmh` に変換し、そこから `into_xyz(view)` で XYZ に展開し、最後に sRGB に変換する。`view` は構築時に決めた `BakedParameters` をそのまま使う。同じ観察条件で往復するため、変換が情報を失わずに済む。

これらの関数の存在は wallust 全体の設計をシンプルに保つ役割を果たす。Histogram 側のメソッドはすべて Spec (= Cam16UcsJmh) で計算を進め、結果を書き出す段階だけ `to_rgb` を呼んで sRGB に戻すという構造になっている。CAM16-UCS は内部表現として閉じ込められ、外側の `Colors` 構造体は Srgb で表現される。

---

## 8. CAM16-UCS で wallust が組み立てる演算

CAM16-UCS を採用したことで、wallust は次のような演算を直接ユークリッド計算として書けるようになった。

### バケット判定

`histogram/diff.rs` の `can_bucket` は J、M、h の差を normalize した重み付き 2 乗和の平方根で測る。

```rust
let (ml, mm, mh) = (100.0, 40.0, 180.0);
let (nl, nm, nh) = (1.0 / ml, 1.0 / mm, 1.0 / mh);
(dj, dm, dh) = (dj * nl * n_max, dm * nm * n_max, dh * nh * n_max);
let diff = (dj.powi(2) + dm.powi(2) + dh.powi(2)).sqrt();
diff <= threshold
```

J は最大 100、M は実用上 40 程度、h は 180 度を上限とした正規化を掛けてからユークリッド距離を取る。CAM16-UCS が「距離が知覚に比例する」性質を持つので、この素朴な式で人間の感覚に合った近接判定ができる。Lab/Lch で同じことをすると hue の重みが効きにくく、補正係数を当てる必要があった。

### 顕著性スコア

`salience` 関数 (`diff.rs`) は色 a と背景 b の差を、J と M と h の 3 軸の重み付き 2 乗和の平方根で計算する。

```rust
let mut dj = a.lightness - b.lightness;
let mut dm = sal_delta_m(a, b);
let mut dh = sal_delta_h(a, b);
let weights = normalize_to_sum(w, 3.0);
let (wj, wm, wh) = (weights[0], weights[1], weights[2]);
(dj.powi(2) * wj.powi(2) + dm.powi(2) * wm.powi(2) + dh.powi(2) * wh.powi(2)).sqrt()
```

ここで `sal_delta_m` と `sal_delta_h` は colorfulness と hue の差に `stretched_exp` 減衰を掛けたもので、低明度域で hue や colorfulness の寄与を弱める補正にあたる。CAM16-UCS は J が 0 に近い領域での色相弁別が原理的に難しいことを前提にしているため、それを wallust 側でも認めて補正している格好になる。

### 顕著性ソートと背景補正

`salience_palette` は最も非顕著な色を背景候補にし、`constrain_col_as_bg` で lightness と colorfulness を Soft-min / Soft-max の範囲に押し込む。

```rust
bg.lightness = least_sal.lightness.max(bg.lightness).clamp(BG_DARK_L_SOFTMIN, BG_DARK_L_SOFTMAX);
bg.colorfulness = least_sal.colorfulness.min(bg.colorfulness).clamp(BG_COLORFULNESS_MIN, BG_COLORFULNESS_MAX);
bg.clamp()
```

CAM16-UCS の J と M は独立に扱えるため、`bg.lightness` だけを動かしても色相が破綻しない。Lab で同じことをやると同時に chroma が動いてしまい、ターゲットの hue がくすむ問題があった。

---

## 9. 直接読むべきファイルと資料

CAM16-UCS と wallust の実装を理解するための優先順位は次のようになる。

1. `library/wallust/src/histogram/salience.rs` 1-30 行のコメントは、wallust がなぜ CAM16-UCS を選んだかを 3 段落で説明している
2. `library/wallust/src/histogram/mod.rs` の `Histogram::new_empty` (208-222 行) は viewing conditions の組み立てが集約されており、CAM16 の文脈を最も短く読める
3. `library/wallust/src/histogram/salience.rs` の `rgb_to_cam` と `Histogram::to_rgb` (391-394 行と 217-221 行) は sRGB と CAM16-UCS の相互変換の最小例にあたる
4. `library/wallust/src/histogram/diff.rs` 全体は CAM16-UCS 上での距離計算と重みの設計が集約されている
5. `palette` クレート公式ドキュメント `docs.rs/palette/0.7.6/palette/cam16/` は CAM16 系の型階層と API シグネチャの参照源
6. CAM16 仕様の論文 Li, Li, Wang, Zu, Luo, Pointer, Melgosa "Comprehensive color solutions: CAM16, CAT16, and CAM16-UCS" (2017) は CAM16-UCS の数式の出典
7. CAM16-UCS ベースのカラーピッカー <https://apps.colorjs.io/picker/cam16-jmh> は J、M、h を実際に動かしながら挙動を確認できる

---

## 10. まとめ

CAM16-UCS は CAM16 が出力する 6 つの知覚属性を、距離が知覚色差にほぼ比例するように再パラメータ化した均等色空間で、J' / M' / h' という 3 つの軸で色を扱う Jmh 表現と J' / a' / b' のデカルト表現の 2 つで使われる。Lab/Lch との最大の違いは、観察条件 (適応輝度、背景輝度、Surround、白色点) をモデルが陽に扱う点と、明度と色濃さが知覚的に独立して操作できる点にある。

wallust 4.0.0-alpha は Cam16UcsJmh を `Spec` 型として中核に据え、dark テーマと light テーマで観察条件を切り替えて知覚的にもっともらしい色を作り分ける。バケット判定、顕著性スコア、背景補正のいずれも単純なユークリッド計算で書けており、Lab/Lch 時代に必要だったヒューリスティックな補正が大幅に減らせた。一方で XYZ との変換コストが大きいため、ansi のように hue 分類しか必要ない経路では HSV を使うという使い分けが残っている。
