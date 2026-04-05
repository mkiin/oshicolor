# Catppuccin/nvim カラー派生アルゴリズム解析

## 1. パレット定義

### ベースカラー構成（全フレーバー共通: 26 色）

Catppuccin は 4 フレーバー (Latte/Frappe/Macchiato/Mocha) すべてで同じ 26 キー名を持つ。

| カテゴリ       | キー名                                             | 役割                               |
| -------------- | -------------------------------------------------- | ---------------------------------- |
| **アクセント** | rosewater, flamingo, pink, mauve, red, maroon       | 強調・エラー・構文ハイライト       |
| **アクセント** | peach, yellow, green, teal, sky, sapphire, blue, lavender | 構文・UI アクセント               |
| **テキスト**   | text, subtext1, subtext0                           | 前景テキスト階調                   |
| **オーバーレイ**| overlay2, overlay1, overlay0                       | コメント・非活性テキスト           |
| **サーフェス** | surface2, surface1, surface0                       | UI 境界・選択背景                  |
| **ベース**     | base, mantle, crust                                | 背景の 3 段階（明→暗）            |

### フレーバー間の明度方向

| フレーバー  | base       | text       | 方向       |
| ----------- | ---------- | ---------- | ---------- |
| Latte       | `#eff1f5`  | `#4c4f69`  | Light (bg が明るい) |
| Frappe      | `#303446`  | `#c6d0f5`  | Dark                |
| Macchiato   | `#24273a`  | `#cad3f5`  | Dark                |
| Mocha       | `#1e1e2e`  | `#cdd6f4`  | Dark (最も暗い)     |

## 2. blend / mix 関数の実装

### 2.1 `blend(fg, bg, alpha)` — 核心関数

**ファイル**: `lua/catppuccin/utils/colors.lua:24-34`

```lua
function M.blend(fg, bg, alpha)
  bg = hex_to_rgb(bg)
  fg = hex_to_rgb(fg)
  local blendChannel = function(i)
    local ret = (alpha * fg[i] + ((1 - alpha) * bg[i]))
    return math.floor(math.min(math.max(0, ret), 255) + 0.5)
  end
  return string.format("#%02X%02X%02X", blendChannel(1), blendChannel(2), blendChannel(3))
end
```

- **色空間**: sRGB（線形補間、ガンマ補正なし）
- **計算式**: `result = alpha * fg + (1 - alpha) * bg`
- **alpha**: 0.0 = 完全に bg、1.0 = 完全に fg

### 2.2 `darken(hex, amount, bg)` — blend のラッパー

```lua
function M.darken(hex, amount, bg)
  return M.blend(hex, bg or M.bg, math.abs(amount))
end
```

**意味**: `hex` 色を `bg`（デフォルト `#000000`）方向に `amount` だけ寄せる。
amount=0.18 なら「accent を 18% 残して残りは bg」。

### 2.3 `lighten(hex, amount, fg)` — blend のラッパー

```lua
function M.lighten(hex, amount, fg)
  return M.blend(hex, fg or M.fg, math.abs(amount))
end
```

**意味**: `hex` 色を `fg`（デフォルト `#ffffff`）方向に寄せる。

### 2.4 `brighten(color, percentage)` — HSLuv ベース

```lua
function M.brighten(color, percentage)
  local hsl = hsluv.hex_to_hsluv(color)
  local larpSpace = 100 - hsl[3]
  if percentage < 0 then larpSpace = hsl[3] end
  hsl[3] = hsl[3] + larpSpace * percentage
  return hsluv.hsluv_to_hex(hsl)
end
```

- **色空間**: HSLuv（知覚均一）
- **用途**: leap.nvim 等のごく一部でのみ使用。メイン手法ではない

### 2.5 `increase_saturation(hex, percentage)` — RGB ベース

- **色空間**: sRGB
- **用途**: lightspeed.nvim でのみ使用（1 箇所）

### 2.6 `vary_color(palettes, default)` — フレーバー分岐

```lua
function M.vary_color(palettes, default)
  local flvr = require("catppuccin").flavour
  if palettes[flvr] ~= nil then return palettes[flvr] end
  return default
end
```

Light テーマ (Latte) と Dark テーマで異なる値を返すためのユーティリティ。

## 3. blend が使われている具体的な箇所

### 3.1 Diagnostics (Error/Warn/Info/Hint) の背景色

**ファイル**: `groups/lsp.lua:13,24-48`

```lua
local darkening_percentage = 0.095

DiagnosticVirtualTextError = { bg = U.darken(error, darkening_percentage, C.base), fg = error }
DiagnosticVirtualTextWarn  = { bg = U.darken(warning, darkening_percentage, C.base), fg = warning }
DiagnosticVirtualTextInfo  = { bg = U.darken(info, darkening_percentage, C.base), fg = info }
DiagnosticVirtualTextHint  = { bg = U.darken(hint, darkening_percentage, C.base), fg = hint }
```

**パターン**: `darken(accent, 0.095, base)` — アクセント色を 9.5% だけ残して base に溶かす。
非常に薄い色付き背景を生成する。

### 3.2 StatusLine / TabLine / WinBar 系

**ファイル**: `groups/editor.lua:85-89`

```lua
StatusLine   = { fg = C.text, bg = C.mantle }
StatusLineNC = { fg = C.surface1, bg = C.mantle }
TabLine      = { bg = C.crust, fg = C.overlay0 }
TabLineFill  = { bg = C.mantle }
TabLineSel   = { link = "Normal" }
WinBar       = { fg = C.rosewater }
```

**blend は使っていない。** パレットの既存色（mantle, crust）を直接使用。

### 3.3 Diff 表示 (DiffAdd/DiffChange/DiffDelete)

**ファイル**: `groups/syntax.lua:75-78`

```lua
DiffAdd    = { bg = U.darken(C.green, 0.18, C.base) }
DiffChange = { bg = U.darken(C.blue, 0.07, C.base) }
DiffDelete = { bg = U.darken(C.red, 0.18, C.base) }
DiffText   = { bg = U.darken(C.blue, 0.30, C.base) }
```

**パターン**: `darken(accent, ratio, base)` — ratio で色の強度を制御。
DiffChange (0.07) は控えめ、DiffText (0.30) は強め。

GitSigns のインライン diff ではさらに強い ratio を使用:

```lua
GitSignsAddInline    = { bg = U.darken(C.green, 0.36, C.base) }
GitSignsChangeInline = { bg = U.darken(C.blue, 0.14, C.base) }
GitSignsDeleteInline = { bg = U.darken(C.red, 0.36, C.base) }
```

### 3.4 選択・検索ハイライト (Visual, Search, IncSearch)

**ファイル**: `groups/editor.lua:77-78,93-94`

```lua
Search    = { bg = U.darken(C.sky, 0.30, C.base), fg = C.text }
IncSearch = { bg = U.darken(C.sky, 0.90, C.base), fg = C.mantle }
CurSearch = { bg = C.red, fg = C.mantle }  -- blend なし、直接色
Visual    = { bg = C.surface1, style = { "bold" } }  -- blend なし
```

**パターン**: Search は sky を 30% blend（薄い）、IncSearch は 90%（ほぼ sky そのもの）。
Visual はパレット色を直接使用。

## 4. 「ベースパレットにない色」の生成パターン分類

### パターン A: `darken(accent, ratio, base)` — 最も多用（90% 以上）

accent 色を base に向かって blend する。ratio が小さいほど base に近く、薄い色になる。

| 用途カテゴリ | accent | ratio | 結果 |
| --- | --- | --- | --- |
| Diagnostics bg | red/yellow/sky/teal | 0.095 | 極薄の色付き背景 |
| Diff bg | green/blue/red | 0.07-0.30 | 軽い色付き背景 |
| GitSigns inline | green/blue/red | 0.14-0.36 | 中程度の色付き背景 |
| Neogit diff | green/red | 0.095-0.500 | 軽〜強の色付き背景 |
| Render-markdown heading bg | rainbow色 | 0.095 | 極薄の色付き背景 |
| CursorLine | surface0 | 0.64 | surface0 を base に近づけた色 |
| MatchParen bg | surface1 | 0.70 | surface1 を base に近づけた色 |
| Search bg | sky | 0.30 | 薄い sky 背景 |

### パターン B: `lighten(accent, ratio, target)` — 少数

accent 色を text や base 方向に明るくする。

| 用途 | accent | ratio | target |
| --- | --- | --- | --- |
| CursorLine (Latte) | mantle | 0.70 | base |
| Neogit diff fg | red/green | 0.85 | text |
| Lightspeed (Latte) | pink | 0.70 | text |

### パターン C: `brighten(color, percentage)` — HSLuv ベース、極少

- leap.nvim: `brighten(C.green, 0.3)` / `brighten(C.red, 0.4)`
- 知覚均一色空間での明度調整

### パターン D: `increase_saturation(hex, percentage)` — 極少

- lightspeed.nvim: `increase_saturation(C.red, 0.7)` — 1 箇所のみ

### パターン E: パレット色の直接使用 — 非常に多い

大部分のハイライトグループは blend を使わず、26 色パレットから直接 fg/bg を割り当てる。
特に UI chrome (StatusLine, TabLine, WinBar, NeoTree, Snacks) はほぼ全て直接色。

## 5. Dark テーマ vs Light テーマ (Mocha vs Latte) の違い

### 5.1 `vary_color` による分岐

`vary_color` は Latte のみ特別扱いするパターンで使われる:

```lua
-- CursorLine: dark では darken、Latte では lighten
bg = U.vary_color(
  { latte = U.lighten(C.mantle, 0.70, C.base) },  -- Latte: mantle を base 方向に明るく
  U.darken(C.surface0, 0.64, C.base)               -- Dark: surface0 を base 方向に暗く
)
```

**方向が逆転する**: Dark では `darken`、Latte では `lighten` を使う。
ただし Catppuccin の `darken` は「bg 方向に寄せる」なので、
Latte の base が明るいなら `darken(accent, ratio, C.base)` でも結果的に明るくなる。

### 5.2 `darken` の ratio は変わらない

Diagnostics の `darkening_percentage = 0.095` は全フレーバーで同一。
`darken(red, 0.095, C.base)` を Latte に適用すると、base が明るい (#eff1f5) ため、
結果は「明るいベースにほんのり赤みがかった色」になる。
ratio 自体は変えなくても、base が異なることで自然に適切な結果が得られる。

### 5.3 transparent 時の `darkening_percentage` 変更

markview / render-markdown では透過背景時に ratio を変更:

```lua
local darkening_percentage = O.transparent_background
  and U.vary_color({ latte = 0.15 }, 0.28)  -- 透過時: Latte=0.15, Dark=0.28
  or 0.095                                    -- 通常時: 共通
```

### 5.4 dim_inactive の分岐

`mapper.lua` の `C.dim` 計算でも Latte は `lighten` 方向で調整:

```lua
C.dim = O.dim_inactive.shade == "dark"
  and U.vary_color(
    { latte = U.darken(C.base, dim_percentage, C.mantle) },
    U.darken(C.base, dim_percentage, C.mantle)
  )
  or U.vary_color(
    { latte = U.lighten("#FBFCFD", dim_percentage, C.base) },
    U.lighten(C.surface0, dim_percentage, C.base)
  )
```

## 6. oshicolor への示唆

### 核心的な知見

1. **blend 関数 1 つで 90% 以上の派生色を生成**: `darken(accent, ratio, base)` の ratio を変えるだけで、Diagnostics bg (0.095) から Diff bg (0.18) まで表現可能
2. **26 色パレットのうち、blend で派生するのは背景色のみ**: fg には常にパレット色を直接使用。blend は「accent × base の中間色」を背景として生成するためのもの
3. **UI chrome は blend 不要**: StatusLine, TabLine 等は mantle/crust/surface を直接使用
4. **Light/Dark の切り替えは base の色が吸収する**: 同じ ratio でも base が異なれば適切な結果になる

### oshicolor の 3 色パレットへの適用案

| Catppuccin の概念 | oshicolor の対応 |
| --- | --- |
| 26 色パレット | AI が抽出した 3 accent + 派生した bg/fg + surface 階調 |
| `darken(accent, ratio, base)` | 同じアルゴリズムで Diagnostics bg / Diff bg を生成 |
| ratio 定数 (0.095, 0.18, 0.30 等) | そのまま流用可能 |
| `vary_color` | bg の明度で自動判定すれば不要 |

### 推奨 blend ratio テーブル

```
極薄背景 (Diagnostics, Heading bg):  0.095
軽い背景 (DiffChange):               0.07
中程度背景 (DiffAdd/Delete):         0.18
やや強い背景 (DiffText, Search):     0.30
強い背景 (GitSigns inline):          0.36
ほぼ原色 (IncSearch):                0.90
```
