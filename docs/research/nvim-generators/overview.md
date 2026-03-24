# Neovim カラースキーマ生成ライブラリ 調査 (#20)

## ライブラリ分類

### 1. フレームワーク型（ゼロから定義）

手動でハイライトグループを定義していく。自由度が高いが自動生成には不向き。

- **lush.nvim** — HSL DSL + リアルタイムプレビュー
- **colorbuddy.nvim** — Color/Group API + 依存グラフ
- **polychrome.nvim** — マルチ色空間 DSL

### 2. 生成・変換型（パレットから自動生成）

少数の入力色からハイライトグループを自動生成。oshicolor と相性がよい。

- **mini.hues** — 2色 → Oklab で全自動生成
- **nvim-highlite** — パレットから自動派生
- **colorgen-nvim** — TOML テンプレート（Rust 製）
- **mini.colors** — 既存テーマの変換ユーティリティ

### 3. 規格ベース型

- **base16-nvim** — 16色スロットへの固定マッピング
- **text-to-colorscheme** — HSV + GPT API（実験的）

---

## ハイライトグループ数 比較

| ライブラリ | 総グループ | Base Vim | Treesitter | LSP | プラグイン | 入力 |
|---|---|---|---|---|---|---|
| base16-nvim | **341** | 40 | 150+ | 20+ | 80+ | 16色 (base00-0F) |
| colorgen-nvim | **281** | 50+ | 60+ | 20+ | 70+ | TOML パレット |
| lush.nvim | 300+（拡張可） | 全対応 | 全対応 | 全対応 | 拡張可 | HSL/HSLuv |
| mini.hues | **150+** | 40+ | 40+ | 10+ | 100+ | 2色のみ |
| nvim-highlite | **150+** | 全対応 | 派生 | 全対応 | 派生 | パレット名 |
| colorbuddy | 拡張可 | ユーザー定義 | ユーザー定義 | ユーザー定義 | ユーザー定義 | Color+Group API |
| polychrome | 拡張可 | ユーザー定義 | ユーザー定義 | ユーザー定義 | ユーザー定義 | 関数型 DSL |
| text-to-colorscheme | 150+ | 自動 | 自動 | 自動 | 自動 | HSV+設定 |
| mini.colors | 任意 | — | — | — | — | 既存スキーマ |

### プラグイン対応の内訳（base16-nvim: 80+ グループ）

Telescope, nvim-cmp (30+), notify.nvim (20+), DAP UI (30+), indent-blankline, gitsigns,
illuminate, vim-rainbow, gitcommit 関連

### プラグイン対応の内訳（mini.hues: 100+ グループ）

mini.nvim ファミリー, bufferline, noice, trouble, which-key, telescope, nvim-cmp,
gitsigns, indent-blankline, lazy.nvim, dap-ui, nvim-tree

---

## 生成ロジック詳細

### base16-nvim — 固定16色マッピング

```
入力: base00〜base0F の 16色（HEX）
  ↓
意味割り当て:
  base00 = 背景（最暗）    base05 = 前景
  base01 = 背景（やや明）  base08 = 赤（エラー・削除）
  base02 = 選択背景        base09 = オレンジ（整数・定数）
  base03 = コメント        base0A = 黄（クラス・検索）
  base04 = 暗い前景        base0B = 緑（文字列・成功）
  base05 = 前景            base0C = シアン（サポート）
  base06 = 明るい前景      base0D = 青（関数・見出し）
  base07 = 最も明るい前景  base0E = 紫（キーワード・選択）
                           base0F = 茶（非推奨・埋め込み）
  ↓
341グループに nvim_set_hl() で適用
```

- 色操作は `darken()` のみ（RGB 各成分 × (1 - percentage)）
- バリアント自動生成なし。16色の範囲内でやりくりする

### colorgen-nvim — TOML テンプレート方式

```toml
[palette]
fg = '#abb2bf'
bg = '#1e222a'
blue = '#519fdf'
error_red = '#F44747'

[highlights]
Normal = 'fg bg'
Error = 'error_red bg b'
TSComment = 'link:Comment'
```

- `'fg bg style special blend'` 形式。`-` は NONE
- スタイル: `b`(bold), `i`(italic), `u`(underline), `c`(undercurl), `s`(strikethrough)
- Rust CLI が TOML → Lua コードを生成
- **色操作は一切なし** — 全バリアントをパレットに手動定義

### lush.nvim — HSL DSL

```lua
local sea = hsl(208, 100, 80)
local complement = sea.rotate(180).darken(10).saturate(10)

lush(function()
  return {
    Normal { fg = sea, bg = sea.darken(70) },
    Comment { fg = sea.desaturate(50).lighten(20) },
  }
end)
```

- HSL / HSLuv（知覚均一）の両方をサポート
- 操作: `rotate()`, `saturate()`, `desaturate()`, `lighten()`, `darken()`, `mix()`
- `readable()` でコントラスト検証
- Shipwright 経由で Lua/VimScript/任意フォーマットにエクスポート

### mini.hues — 2色から Oklab 全自動生成

```lua
require('mini.hues').setup({
  background = '#11262d',
  foreground = '#c0c8cc',
  saturation = 'medium',
})
```

- 背景・前景の 2色 + saturation 設定で 150+ グループを自動生成
- **Oklab/Oklch 色空間**で知覚的に均等なパレットを計算
- 明度・彩度のバリアントを自動で導出して UI/構文に割り当て
- 実装: `lua/mini/hues.lua`（2037行）

### nvim-highlite — パレットから自動派生

```lua
local palette, terminal = Highlite.palette("ayu")
local groups = Highlite.groups("default", palette)
Highlite.generate("highlite-ayu", groups, terminal)
```

- 3ステップで完結。数色のコアカラーから明暗バリアントを自動生成
- 組み込みカラースキーム 12種以上

### colorbuddy.nvim — HSL 依存グラフ

```lua
Color.new('red', '#cc6666')
Color.new('light_red', colors.red:light())
Group.new('Error', colors.red, colors.background, styles.bold)
```

- HSL モディファイア: `:light()`, `:dark()`, `:saturate()`, `:desaturate()`, `:rotate()`
- **メタテーブルで色の依存関係を追跡** — 親の色を変えると子グループも自動更新

### polychrome.nvim — マルチ色空間

```lua
Colorscheme.define('theme', function()
  Normal { fg = rgb(150, 150, 219), bg = rgb(20, 20, 20) }
  Comment { fg = oklch(0.6, 0.1, 240) }
end):apply()
```

- 6色空間: RGB, HSL, Oklab, Oklch, CieXYZ, LMS
- sRGB 範囲外の色は自動クリッピング
- `:Polychrome preview` でライブ編集

---

## 色操作アルゴリズム比較

| ライブラリ | 色空間 | 操作 | 自動バリアント |
|---|---|---|---|
| base16-nvim | RGB | darken のみ | なし |
| colorgen-nvim | なし | なし | なし |
| lush.nvim | HSL, HSLuv | rotate/saturate/darken/lighten/mix | なし（手動） |
| mini.hues | **Oklab/Oklch** | 全自動 | **あり** |
| mini.colors | **Oklab/Oklch/Okhsl** | チャンネル更新・色覚シミュレーション | 変換型 |
| nvim-highlite | 不明 | 自動派生 | **あり** |
| colorbuddy | HSL | light/dark/saturate/rotate | メタテーブル伝播 |
| polychrome | Oklab/Oklch/HSL/RGB/XYZ/LMS | 色空間変換 + クリッピング | なし（手動） |

---

## oshicolor への示唆

### 相性評価

| 方式 | 相性 | 理由 |
|---|---|---|
| **mini.hues 方式** | ★★★ | ドミナント 2色で全自動生成。抽出パレットと直結 |
| **base16 方式** | ★★☆ | 16色マッピングが明確。スロット埋めの変換ロジックが必要 |
| **nvim-highlite 方式** | ★★☆ | 少ない入力で多くのグループをカバー |
| **lush 方式** | ★☆☆ | 手動チューニング前提。自動生成パイプラインには不向き |

### 次のステップ

- [ ] mini.hues の Oklab パレット生成ロジック（2037行）を精読し、oshicolor の R2 マッピングに取り入れられるか検討
- [ ] base16 の 16色スロット定義を参考に、抽出パレットから意味的スロットへの変換ルールを設計
- [ ] ハイライトグループのカバレッジ目標を決定（現在の 66 グループ → 150+? 300+?）
