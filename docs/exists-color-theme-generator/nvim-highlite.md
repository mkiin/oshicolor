# nvim-highlite 調査レポート

> 調査日: 2026-02-22
> リポジトリ: `sample-repo/nvim-highlite/`
> 言語: Lua

---

## 設計思想

**「ハイライトグループと 1:1 対応するセマンティックロールを事前定義し、パレットとして渡す」**

ユーザーは直接ハイライトグループに色を渡さない。
代わりに意味的に名付けられたパレットキー（50+個）に色を渡す。
フレームワークがパレットを受け取り、ハイライトグループへの展開を自動化する。

---

## パレット定義（`lua/highlite/color/palette/highlite.lua`）

```lua
palette = {
  -- 構文
  keyword      = 0x60AFFF,
  string       = 0x70D533,
  number       = 0xFFB7B7,
  boolean      = 0xF0DF33,
  func         = 0xCF55F0,
  type         = 0x33DBC3,
  constant     = 0xF0AF00,
  identifier   = 0xC0C0C0,
  comment      = 0x808080,
  operator     = ...,
  label        = ...,
  punctuation  = ...,

  -- keyword の細分化
  keyword_function  = 0x33DBC3,
  keyword_operator  = 0x22FF22,
  keyword_return    = 0x60AFFF,
  loop              = 0x2BFF99,
  conditional       = 0x95C5FF,
  storage           = ...,

  -- PreProc 細分化
  define   = 0x7766FF,
  include  = 0x99FF99,
  macro    = 0x7766FF,
  preproc  = 0xF4C069,
  preproc_conditional = ...,

  -- 診断
  error   = 0xEE4A59,
  warning = 0xFF8900,
  hint    = 0xD5508F,
  info    = 0xFFB7B7,

  -- UI
  bg              = 0x202020,
  bg_contrast_low = 0x353535,
  bg_contrast_high= 0x505050,
  text            = 0xC0C0C0,
  text_contrast_bg_low  = ...,
  text_contrast_bg_high = ...,

  -- その他
  throw  = ...,  -- exception
  structure = ...,
  type_definition = ...,
  uri    = ...,
  -- ... 合計 50+ キー
}
```

---

## グループ展開（`lua/highlite/groups/default.lua`）

```lua
-- パレットキー → ハイライトグループ（自動展開）
local function from_palette(palette, opts)
  local conditional = { fg = palette.conditional, italic = true }
  local keyword     = { fg = palette.keyword }
  local repeat_     = { fg = palette.loop, italic = true }
  local exception   = { fg = palette.throw, bold = true }
  local storage_class = { fg = palette.storage, bold = true }

  local groups = {
    Normal = { fg = palette.text, bg = palette.bg },
    Keyword = keyword,
    Conditional = conditional,
    Repeat = repeat_,
    Function = { fg = palette.func },
    Type = { fg = palette.type },
    String = { fg = palette.string },
    -- ...100+ グループが自動生成される
  }
  return groups
end
```

### link による TreeSitter 解決

```lua
-- TreeSitter グループは link で吸収
["@keyword"]            = { link = "Keyword" },
["@keyword.function"]   = { link = "Function" },
["@keyword.conditional"]= { link = "Conditional" },
["@type"]               = { link = "Type" },
```

link 解決はフレームワーク側でメタテーブル経由で行う（遅延評価）。

---

## パレットのカスタマイズ方法

```lua
-- colors/mytheme.lua
local highlite = require("highlite")
local palette = require("highlite.color.palette").get()  -- デフォルトパレット取得

-- 任意のキーを上書き
palette.keyword = "#FF6B6B"
palette.string  = "#A8FF78"

-- フレームワークが展開
highlite.setup({ palette = palette })
```

---

## エクスポート対応

nvim-highlite はエクスポート機能も持つ（`lua/highlite/export/`）:
- `native/lua.lua` → Neovim Lua フォーマット
- `native/vim.lua` → Vimscript フォーマット
- `fish.lua`, `bat.lua`, `ghostty.lua`, `wezterm.lua` → ターミナルテーマ

---

## アーキテクチャ

```
入力: 50+個のセマンティックロール色（手動定義 or 既存パレット利用）
       ↓
  フレームワークがパレット → グループ変換テーブルを適用
  スタイル属性（italic/bold）はパレットキーの意味で固定
       ↓
  link で TreeSitter / LSP グループを吸収（遅延解決）
       ↓
  Neovim .lua ファイル / Vim .vim ファイル
```

---

## oshicolor への示唆

- **ロールの粒度設計**: `keyword` だけでなく `loop`, `conditional`, `storage`, `throw` を分けることで言語構造ごとの色付けが可能
- **クラスター化**: 全ロールに独立した色を割り当てるのは自動生成では困難。**「色クラスター」に分類**し同色 or 明度差のみで対応する設計が現実的
  ```
  クラスターA（keyword 系）: keyword / conditional / loop / storage / throw → 同色
  クラスターB（construct 系）: func / method / constructor              → 同色
  クラスターC（value 系）: string / character                           → 同色
  クラスターD（literal 系）: number / boolean / constant                → 同色
  クラスターE（type 系）: type / interface / enum / typedef             → 同色
  クラスターF（diagnostic 系）: error / warning / hint / info           → 専用4色
  ```
- **Diagnostic 専用色**: error=0xEE4A59, warning=0xFF8900, hint=0xD5508F, info=0xFFB7B7 という具体的な色配置は参考になる
- **italic/bold のセマンティクス**: `conditional=italic`, `exception=bold`, `storage_class=bold` という慣習は取り入れやすい
