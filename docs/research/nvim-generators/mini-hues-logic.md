# mini.hues 実装ロジック解析 (#20)

## 1. 設計思想 — 何を解決しているか

カラースキーマ作成の本質的な難しさは「色を選ぶこと」ではなく「色の関係性を保つこと」にある。
ある色を決めたとき、他の色がそれと知覚的にどれだけ違うか、十分なコントラストがあるか、
色同士が互いに区別できるかを人間が手動で調整するのは困難である。

mini.hues はこの問題を **2色の入力だけで全自動解決する** というアプローチを取る。

```
入力: background (#11262d) + foreground (#c0c8cc)
  ↓
出力: 26色のパレット → 350+ ハイライトグループへの適用
```

この「2色 → 全体」の変換を支えるのが以下の3つの柱である。

---

## 2. 3つの柱

### 柱1: Oklch 色空間で考える

RGB や HSL ではなく **Oklch** を使う。これが mini.hues の設計の根幹。

**なぜ Oklch か？**
RGB/HSL は「人間の知覚」と一致しない。HSL で同じ lightness=50 でも、
黄色は明るく見え、青は暗く見える。Oklch では lightness が知覚的に均一なので、
「同じ L 値 → 同じ明るさに見える」が保証される。

```
Oklch の3チャンネル:
  L (Lightness)  0〜100  明るさ（知覚均一）
  C (Chroma)     0〜∞    鮮やかさ（0 = グレー）
  H (Hue)        0〜360  色相（色相環上の角度）
```

この特性があるから「L だけ変えればトーン違いが作れる」「C を揃えれば統一感が出る」
「H を等間隔に並べれば最大限区別できる色が得られる」という操作が成立する。

### 柱2: 明度レイヤーで構造を作る

背景と前景の L 値を基準に、5段階の明度レイヤーを自動生成する。
これにより「どの色をどの用途に使うか」が明度だけで決まる。

### 柱3: 色相を等間隔配置で最大分離する

非ベース色（red, orange, yellow, ...）の色相は、背景・前景の色相から
**最も遠くなるように** 等間隔グリッドを配置する。
これにより、ベース色とアクセント色が知覚的に混同されない。

---

## 3. パレット生成アルゴリズム — 全体像

```
┌─────────────────────────────────────────────────────┐
│  入力: background, foreground (HEX)                  │
│  設定: n_hues (0-8), saturation, accent              │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  Step 1: HEX → Oklch 変換                            │
│    bg_lch = { l: 15.2, c: 2.8, h: 208 }             │
│    fg_lch = { l: 81.3, c: 1.1, h: 225 }             │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  Step 2: 明度レイヤーの計算                            │
│    基準点3つを決め、5段階の bg/fg バリアントを生成       │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  Step 3: 色相グリッドの生成                            │
│    n_hues 個の等間隔点を bg_h, fg_h から最も遠い位置に  │
│    → 8色名 (red〜purple) にマッピング                  │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  Step 4: 26色パレットの生成                            │
│    bg系5色 + fg系5色 + 8色×2(fg明度/bg明度) + accent×2 │
│    各色は Oklch → gamut clip → HEX で出力              │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  Step 5: パレット → 350+ ハイライトグループへの適用      │
└──────────────────────────────────────────────────────┘
```

---

## 4. Step 2 詳細: 明度レイヤーの計算

### 基準点の決定

```lua
local is_dark = bg_l <= 50
local l_bg_edge = is_dark and 0 or 100    -- 背景側の極値（dark→0, light→100）
local l_fg_edge = is_dark and 100 or 0    -- 前景側の極値
local l_mid = 0.5 * (bg_l + fg_l)         -- 背景と前景の中間点
```

dark テーマ (bg_l=15, fg_l=80) の例:

```
L: 0 ----15------- 47.5 ----------80---- 100
   │     │           │              │      │
   bg_edge bg        mid            fg    fg_edge
```

### 5段階バリアント

bg, fg それぞれについて、基準点との**加重平均**で4つのバリアントを生成する。
加重比は `0.33:0.67` と `0.67:0.33`（3分の1ずつ近づく）。

```lua
bg_edge2 = 0.33 * bg_l + 0.67 * l_bg_edge   -- bg_edgeに近い（最も暗い）
bg_edge  = 0.67 * bg_l + 0.33 * l_bg_edge   -- bgよりやや暗い
bg       = bg_l                                -- 入力そのまま
bg_mid   = 0.67 * bg_l + 0.33 * l_mid        -- bgよりやや明るい
bg_mid2  = 0.33 * bg_l + 0.67 * l_mid        -- midに近い（かなり明るい）
```

dark テーマ (bg_l=15, fg_l=80) での具体値:

```
bg_edge2:  0.33×15 + 0.67×0   =  5.0    ← 最暗（FloatBorder bg）
bg_edge:   0.67×15 + 0.33×0   = 10.1    ← やや暗（NormalFloat bg）
bg:                              15.0    ← Normal bg
bg_mid:    0.67×15 + 0.33×47.5 = 25.7    ← やや明（CursorLine bg）
bg_mid2:   0.33×15 + 0.67×47.5 = 36.8    ← 明るめ（Visual bg, LineNr fg）

fg_edge2:  0.33×80 + 0.67×100  = 93.4
fg_edge:   0.67×80 + 0.33×100  = 86.6
fg:                               80.0    ← Normal fg
fg_mid:    0.67×80 + 0.33×47.5  = 69.3   ← StatusLine fg
fg_mid2:   0.33×80 + 0.67×47.5  = 58.2   ← Comment fg
```

この10色（bg系5 + fg系5）はすべて**入力色の色相とクロマを保持**し、
明度だけを変えている。だから全体のトーンが統一される。

---

## 5. Step 3 詳細: 色相グリッドの生成

### 問題設定

背景と前景の色相 (bg_h, fg_h) が既に「使われている」色相である。
アクセント色は、これらと**知覚的に最も区別しやすい**色相に配置したい。

### アルゴリズム

1. 色相環 (0°〜360°) を `n_hues` 等分するグリッドを考える
2. グリッドの開始角度 `d` を調整して、bg_h と fg_h の**両方から最も遠い**配置を探す

```lua
-- n_hues=8, bg_h=208, fg_h=225 の場合:
local period = 360 / 8  -- = 45°
local half_period = 22.5

-- bg_h, fg_h を period で剰余して折り畳む
local ref_bg = 208 % 45 = 28    -- period内での位置
local ref_fg = 225 % 45 = 0

-- 2点の中間点を求め、half_period ずらした方を選ぶ
local mid = 0.5 * (28 + 0) = 14
local mid_alt = (14 + 22.5) % 45 = 36.5

-- ref_bg(=28) から遠い方を採用
-- dist(14, 28) = 14  vs  dist(36.5, 28) = 8.5
-- → mid(=14) の方が遠いので mid_alt(=36.5) を採用
d = 36.5
```

3. グリッド生成: `[36.5, 81.5, 126.5, 171.5, 216.5, 261.5, 306.5, 351.5]`

4. 8つの参照色名に最近接グリッド点を割り当て:

```lua
res.red    = approx(0)     -- 351.5°（0°に最も近い点）
res.orange = approx(45)    -- 36.5°
res.yellow = approx(90)    -- 81.5°
res.green  = approx(135)   -- 126.5°
res.cyan   = approx(180)   -- 171.5°
res.azure  = approx(225)   -- 216.5°
res.blue   = approx(270)   -- 261.5°
res.purple = approx(315)   -- 306.5°
```

### n_hues < 8 の場合

n_hues=2 なら `[d, d+180]` の2点グリッドになり、8つの色名すべてが
この2点のどちらかに割り当てられる。結果として**実質2色のアクセント**で
カラースキーマが成立する。

```
n_hues=8: 8色すべて異なる色相
n_hues=4: 4色（red=orange, yellow=green, cyan=azure, blue=purple）
n_hues=2: 2色のみ（より統一感の高いテーマ）
n_hues=0: アクセント色なし（モノクロ的）
```

---

## 6. Step 4 詳細: 26色パレットの構成

### 非ベース色（8色 × 2バリアント = 16色）

各色名に対して **fg の明度** と **bg の明度** の2バリアントを生成。
クロマは saturation 設定で一律に決まる。

```lua
local chroma = ({
  low       = 4,
  lowmedium = 6,
  medium    = 8,     -- デフォルト
  mediumhigh = 12,
  high      = 16,
})[saturation]

-- fg明度バリアント（テキストに使う）
red    = { l = fg_l, c = chroma, h = hues.red }
green  = { l = fg_l, c = chroma, h = hues.green }
-- ...

-- bg明度バリアント（背景に使う）
red_bg    = { l = bg_l, c = chroma, h = hues.red }
green_bg  = { l = bg_l, c = chroma, h = hues.green }
-- ...
```

**ポイント**: 全アクセント色が**同じ L 値（= fg_l）と同じ C 値（= chroma）**を共有する。
Oklch の知覚均一性により、これらはすべて**同じ明るさ・同じ鮮やかさに見える**。

### アクセント色（2色）

UI の強調要素（ボーダー、タイトル、検索ハイライト等）に使う特別な色。

```lua
if accent == 'bg' then
  accent    = { l = fg_l, c = chroma, h = bg_lch.h }  -- 背景の色相 × 前景の明度
  accent_bg = bg                                        -- 背景色そのまま
elseif accent == 'fg' then
  accent    = fg                                        -- 前景色そのまま
  accent_bg = { l = bg_l, c = chroma, h = fg_lch.h }  -- 前景の色相 × 背景の明度
else
  accent    = { l = fg_l, c = chroma, h = hues[accent] }
  accent_bg = { l = bg_l, c = chroma, h = hues[accent] }
end
```

### パレット全体像（26色）

```
bg 系 (5色):     bg_edge2, bg_edge, bg, bg_mid, bg_mid2
fg 系 (5色):     fg_edge2, fg_edge, fg, fg_mid, fg_mid2
アクセント系 (8×2色):
  fg明度: red, orange, yellow, green, cyan, azure, blue, purple
  bg明度: red_bg, orange_bg, yellow_bg, green_bg, cyan_bg, azure_bg, blue_bg, purple_bg
特殊 (2色):     accent, accent_bg
```

---

## 7. Gamut Clipping — sRGB の壁への対処

Oklch で計算した色が sRGB の範囲外になることがある（特に高 chroma ）。
mini.hues はこの問題を **cusp テーブル + 幾何学的クリッピング** で解決する。

### Cusp テーブル

色相 0°〜359° の各1°刻みに対して、sRGB で表現可能な最大 chroma と
そのときの lightness (cusp point) を事前計算したルックアップテーブル。
360個のエントリ（L1735行目付近の `H.cusps`）。

### クリッピングアルゴリズム

```
           L
    100 ┤            ╱
        │           ╱ sRGB gamut
        │     cusp ●     boundary
        │         ╱ ╲
        │        ╱   ╲
      0 ┤───────────────── C
```

1. 目標色 (L, C, H) の H に対応する cusp を引く
2. C が gamut 内なら → そのまま返す
3. C が gamut 外なら → cusp 方向へ (L, C) を移動し、gamut 境界との交点に置く

```lua
H.clip_to_gamut = function(lch)
  local gamut_points = H.get_gamut_points(lch)
  if lch.c <= gamut_points.c_upper then return lch end  -- gamut内

  -- gamut外 → cusp方向へクリップ
  res.l = gamut_points.l_cusp_clip
  res.c = gamut_points.c_cusp_clip
  return res
end
```

**色相 (H) は絶対に変えない**。これにより、クリップ後も意図した色味が保たれる。

---

## 8. 色変換パイプライン

```
HEX → RGB → linear RGB → Oklab → Oklch
                                    ↓
                              パレット計算
                                    ↓
Oklch → gamut clip → Oklab → linear RGB → sRGB → HEX
```

### 各変換の実装

```
HEX → RGB:           16進数パース
RGB → linear RGB:    sRGBガンマ補正の逆変換（x/12.92 or ((x+0.055)/1.055)^2.4）
linear RGB → Oklab:  3×3行列変換 → 立方根 → 3×3行列変換
Oklab → Oklch:       (a,b) → (sqrt(a²+b²), atan2(b,a))
Oklch → Oklab:       (c,h) → (c·cos(h), c·sin(h))
```

lightness には追加の知覚補正が入る:

```lua
-- Björn Ottosson の改良 lightness 推定
-- https://bottosson.github.io/posts/colorpicker/
H.correct_lightness = function(x)
  x = 0.01 * x
  local k1, k2 = 0.206, 0.03
  local k3 = (1 + k1) / (1 + k2)
  return 100 * 0.5 * (k3*x - k1 + sqrt((k3*x - k1)^2 + 4*k2*k3*x))
end
```

---

## 9. パレット → ハイライトグループの割り当てルール

### 設計原則

mini.hues のハイライト割り当てには明確なルールがある:

| パレット色  | 意味的役割           | 使用箇所                                       |
| ----------- | -------------------- | ---------------------------------------------- |
| `fg`        | 通常テキスト         | Normal, Operator, Type, @variable              |
| `fg` + bold | 強調テキスト         | Statement, Keyword 系                          |
| `fg_mid`    | 準前景               | StatusLine fg                                  |
| `fg_mid2`   | 弱い前景             | Comment                                        |
| `bg`        | 通常背景             | Normal bg                                      |
| `bg_mid`    | やや明るい背景       | CursorLine, VisualNOS                          |
| `bg_mid2`   | 明るい背景           | Visual, MatchParen bg, LineNr                  |
| `bg_edge`   | やや暗い背景         | NormalFloat bg, Folded bg                      |
| `bg_edge2`  | 最も暗い背景         | (端のハイライト)                               |
| `red`       | エラー・削除         | DiagnosticError, DiffDelete, diffRemoved       |
| `orange`    | 注意・特殊キーワード | Delimiter, @keyword.return, @markup.heading.1  |
| `yellow`    | 警告・識別子         | DiagnosticWarn, Identifier, IncSearch          |
| `green`     | 成功・文字列・追加   | String, DiffAdd, ModeMsg                       |
| `cyan`      | ヒント・特殊         | DiagnosticHint, Special                        |
| `azure`     | 関数・ディレクトリ   | Function, Directory, MoreMsg                   |
| `blue`      | 情報・前処理         | DiagnosticInfo, PreProc, @parameter            |
| `purple`    | 定数                 | Constant                                       |
| `accent`    | UI強調               | Search bg, FloatBorder fg, Title, CursorLineNr |
| `*_bg`      | 背景バリアント       | DiffAdd/Change/Delete bg, Error bg, Snippet bg |

### Diagnostic の色相距離ルール

エラーからの重要度が下がるにつれ、色相が red から離れていく:

```
DiagnosticError = red      (hue ≈ 0°)
DiagnosticWarn  = yellow   (hue ≈ 90°)    ← red から 90° 離れる
DiagnosticInfo  = blue     (hue ≈ 270°)   ← さらに離れる
DiagnosticOk    = green    (hue ≈ 135°)
DiagnosticHint  = cyan     (hue ≈ 180°)   ← red の補色（最も離れている）
```

### Markdown 見出しの色相グラデーション

H1〜H6 は色相環を順に辿る:

```
H1 = orange   (45°)
H2 = yellow   (90°)
H3 = green    (135°)
H4 = cyan     (180°)
H5 = azure    (225°)
H6 = blue     (270°)
```

---

## 10. oshicolor への応用可能性

### そのまま使えるもの

1. **Oklch 色空間の採用** — 抽出パレットから「知覚均一な派生色」を生成する基盤
2. **明度レイヤー方式** — bg/fg から 0.33/0.67 の加重平均で5段階を作る手法
3. **色相グリッドの最大分離** — 抽出されたドミナント色相を避けてアクセント色を配置
4. **Gamut clipping** — Oklch で計算した色を安全に HEX に戻す手法
5. **ハイライト割り当てルール** — 色の意味的役割のマッピング表

### 差異・要検討

| mini.hues の前提       | oshicolor の状況                     |
| ---------------------- | ------------------------------------ |
| 入力は2色（bg + fg）   | 入力はドミナント+パレット（5〜16色） |
| アクセント色は自動生成 | キャラクター固有色を活かしたい       |
| 全色が同一 chroma      | 抽出色は chroma がバラバラ           |
| 色相は等間隔配置       | キャラクターの色味に偏りがある       |

### ハイブリッド案

```
1. 抽出パレットから bg, fg を選定（既存の R2 ロジック）
2. mini.hues 方式で明度レイヤー（bg系5 + fg系5）を生成
3. 抽出パレットの色を Oklch に変換し、8色スロットに最近接割り当て
   → 割り当てられないスロットは mini.hues 方式で自動生成
4. 各スロットの _bg バリアントは bg_l で L を差し替えて生成
5. gamut clipping で安全な HEX に変換
6. ハイライト割り当てテーブル（本ドキュメント §9）に従って適用
```
