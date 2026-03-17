# R2/V5 調査: material-color-utilities / xeno.nvim

## 調査対象

| リポジトリ | 配置場所 | 概要 |
|---|---|---|
| material-color-utilities | `sample-repo/nvim-generators/material-color-utilities/` | Google の Material Design 3 カラーシステム |
| xeno.nvim | `sample-repo/nvim-generators/xeno.nvim/` | 2色から Neovim テーマを生成するミニマリストジェネレータ |

---

## material-color-utilities（MCU）

### HCT 色空間

CAM16（色の見え方モデル）+ L*（Lab の明度）を組み合わせた色空間:
- **Hue** (0-360°): 色相（CAM16 由来、知覚的に正確）
- **Chroma** (0-120): 彩度（CAM16 由来）
- **Tone** (0-100): 明度（L* 由来、contrast と直結）

**OkLch との違い**: HCT は Tone が L* ベースなので Tone 差で WCAG コントラスト比を直接保証できる。Tone 差 ≥ 50 で 4.5:1（AA）、≥ 40 で 3.0:1。

### seed → 6 パレット

```
seed 1色（HCT に変換）→
  primary:         hue同じ, chroma=48    ← メインアクセント
  secondary:       hue同じ, chroma=16    ← サブアクセント
  tertiary:        hue+60°, chroma=24    ← 補色アクセント
  neutral:         hue同じ, chroma=4     ← bg/surface
  neutralVariant:  hue同じ, chroma=8     ← outline/border
  error:           hue=25,  chroma=84    ← 固定赤
```

### Tonal Palette

各パレットは T0〜T100 の101段階。同じ hue+chroma で Tone だけ変えた色のスケール。
sRGB ガマット外の色は自動クランプ。

### Variant（10種）

| Variant | 特徴 |
|---|---|
| TONAL_SPOT | デフォルト。primary chroma=36 |
| VIBRANT | 高彩度。温度ベースで hue 回転 |
| EXPRESSIVE | 区分線形関数で hue シフト |
| FIDELITY | seed の chroma をそのまま保持 |
| CONTENT | chroma を seed から比率で導出 |
| MONOCHROME | chroma=0（グレースケール） |
| NEUTRAL | 低彩度 |
| RAINBOW | hue を大きく回転 |
| FRUIT_SALAD | hue+50° で tertiary を強調 |

### Dark/Light テーマ

同じパレットから Tone を変えて取得:
- Dark: primary=T80, bg=T10, fg=T90
- Light: primary=T40, bg=T99, fg=T10

### Surface 階層（Dark）

```
surfaceDim:              T6
surface:                 T10
surfaceContainerLowest:  T4
surfaceContainerLow:     T10
surfaceContainer:        T12
surfaceContainerHigh:    T17
surfaceContainerHighest: T22
surfaceBright:           T24
```

### oshicolor への示唆

- **neutral palette で bg 問題を構造的に解決**: chroma=4 なので鮮やかな bg が来ない
- **Tone ベースの contrast 保証**: syntax 色を配置するとき Tone 差で可読性を担保
- **tertiary = hue+60°**: 不足色を補完する際の hue 回転の根拠
- **FIDELITY variant**: キャラクターの色をそのまま使いたい場合に参考

---

## xeno.nvim

### コンセプト

base色 + accent色 の2色入力から100+のハイライトグループを生成。

### スケール生成

HSL 色空間で hue を保ち、lightness を10段階に展開:

```
Dark theme lightness:
  100: 0.900  200: 0.750  300: 0.650  400: 0.600  500: 0.480
  600: 0.280  700: 0.195  800: 0.140  900: 0.115  950: 0.090
```

base_900 = Normal.bg, base_300 = Normal.fg, accent_100 = keyword 等。

### 調整パラメータ

- `variation` (-1〜1): 彩度の強さ
- `contrast` (-1〜1): 明度の広がり
- 極端な明度では彩度を自動減衰（light: ×0.8, dark: ×0.7）

### ハイライトマッピング

20色（2スケール × 10段階）で全グループをカバー。
Diagnostic 色はデフォルト固定値（red, green, yellow, orange）。

### oshicolor への示唆

- **スケールからの機械的マッピング**: 段階番号でグループが決まるのでシンプル
- **Surface 階層**: base_900 → base_800 → base_700 の厳密な lightness gap
- **HSL の限界**: 知覚的均一性がないため、同じ lightness でも色によって明るさが違って見える

---

## 比較と V5 設計への反映

| 観点 | MCU | xeno | V5 採用 |
|---|---|---|---|
| 色空間 | HCT（知覚的 + contrast 直結） | HSL（非知覚的） | HCT |
| 入力 | seed 1色 | base + accent 2色 | seed 3色（3軸） |
| bg 生成 | neutral palette (chroma=4) | base スケール | neutral palette |
| syntax 色 | Tone で取得 | lightness で取得 | Tone で取得 |
| contrast | Tone 差で構造的保証 | 経験的クランプ | Tone 差で保証 |
| ハイライト対応 | なし（汎用） | 100+グループ | 100+グループ |
