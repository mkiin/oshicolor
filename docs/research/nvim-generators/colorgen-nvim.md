# colorgen-nvim 調査レポート

> 調査日: 2026-02-22
> リポジトリ: `sample-repo/nvim-generators/colorgen-nvim/`
> 言語: Rust（CLI ツール）

---

## 設計思想

**「TOML テンプレートで色の定義とグループ割り当てを宣言し、Rust CLI が Lua ファイルを生成する」**

色の管理と展開を完全に分離する。
ユーザーは1つの TOML ファイルに「パレット定義」と「ハイライトグループ定義」を書くだけ。
CLI ツールが TOML を読み込み、Neovim が読み込める Lua ファイルを生成する。

---

## TOML テンプレート構造（`user_template.toml`）

### セクション1: `[information]`

```toml
[information]
 name = "onedarker"
 background = "dark"
 author = 'Christian Chiarulli <chrisatmachine@gmail.com>'
```

### セクション2: `[palette]`

```toml
[palette]
 fg = '#abb2bf'
 bg = '#1e222a'
 blue = '#519fdf'
 green = '#88b369'
 red = '#d05c65'
 yellow = '#d5b06b'
 purple = '#b668cd'
 error_red = '#F44747'
 warning_orange = '#ff8800'
 info_yellow = '#FFCC66'
 hint_blue = '#4FC1FF'
 # ... 約30〜40個のキー
```

### セクション3: `[highlights]`, `[Treesitter]`, `[LSP]`, etc.

```toml
[highlights]
 Normal = 'fg bg'         # 'fg_key bg_key'
 Comment = 'gray - i'     # 'fg - style' (- はスキップ)
 String = 'orange'        # 'fg_key のみ'

[Treesitter]
 TSComment = 'link:Comment'   # link 指定
 TSFunction = 'blue'
 TSKeyword = 'purple'

[LSP]
 LspDiagnosticsDefaultError = 'error_red'
 LspDiagnosticsDefaultWarning = 'warning_orange'
```

---

## 色指定文法（`src/sections/color_spec/parser.rs`）

各ハイライトグループの値は以下の文法で記述する:

```
<fg> [<bg> [<style> [<sp> [<blend>]]]]

fg/bg/sp: パレットキー名 | '#RRGGBB' | '-'（スキップ）
style: 文字の組み合わせ
  o=standout, u=underline, c=undercurl, d=underdouble
  t=underdotted, h=underdashed, s=strikethrough
  i=italic, b=bold, r=reverse, n=nocombine
blend: 0〜100

例:
  'fg bg'         → fg=fg, bg=bg
  'gray - i'      → fg=gray, bg=skip, style=italic
  'error_red bg b'→ fg=error_red, bg=bg, style=bold
  'link:Comment'  → Comment グループへのリンク
  '- - u'         → fg=skip, bg=skip, style=underline
```

---

## Lua 出力構造（`src/sections.rs`）

```lua
-- 生成される palette.lua
local colors = {
  fg = "#abb2bf",
  bg = "#1e222a",
  blue = "#519fdf",
  -- ...
}
return colors

-- 生成される theme.lua
local c = require('onedarker.palette')
local hl = vim.api.nvim_set_hl
local theme = {}

theme.set_highlights = function()
  -- highlights
  hl(0, "Normal", { fg = c.fg, bg = c.bg })
  hl(0, "Comment", { fg = c.gray, italic = true })

  -- Treesitter
  hl(0, "TSFunction", { fg = c.blue })
  hl(0, "TSComment", { link = "Comment" })

  -- LSP
  hl(0, "LspDiagnosticsDefaultError", { fg = c.error_red })
end

return theme
```

---

## アーキテクチャ

```
入力: user_template.toml
       ↓
  Rust CLI: TOML パース
  ├─ [information] → テーマ名・背景設定
  ├─ [palette] → LinkedHashMap<String, RgbColor>
  └─ [highlights/Treesitter/LSP/...] → Sections 構造体
       ↓
  バリデーション: パレット参照の整合性チェック
       ↓
  Lua ファイル生成
  ├─ palette.lua (colors テーブル)
  └─ theme.lua (vim.api.nvim_set_hl 呼び出し列)
```

---

## セクション設計

`[highlights]`, `[Treesitter]`, `[LSP]`, `[markdown]`, `[Telescope]` 等を
TOML セクションとして分離できる。各セクションはコメントとして Lua に出力される。

```lua
theme.set_highlights = function()
  -- highlights
  hl(0, "Normal", ...)

  -- Treesitter
  hl(0, "TSFunction", ...)

  -- LSP
  hl(0, "LspDiagnosticsDefaultError", ...)
end
```

---

## oshicolor への示唆

- **TOML 宣言 vs コード生成**: colorgen-nvim の「データとロジックの分離」は参考になる。oshicolor の Lua 生成器でも、パレット → `vim.api.nvim_set_hl` の変換パターンはそのまま使える
- **セクション分割**: `highlights / Treesitter / LSP / Plugin` という分割は Lua ファイルの可読性向上に有効
- **パレット参照のバリデーション**: 生成前に参照整合性をチェックする設計は堅牢
- **link 記法**: `link:Comment` という直感的な文法はテンプレートとして使いやすい
- **出力形式**: `vim.api.nvim_set_hl(0, "group", attrs)` という現代的な Neovim API を使っている点が最新
