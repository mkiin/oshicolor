# lush.nvim 調査レポート

> 調査日: 2026-02-22
> リポジトリ: `sample-repo/nvim-generators/lush.nvim/`
> 言語: Lua

---

## 設計思想

**「Lua DSL で色の依存関係をリアクティブに記述し、ライブプレビューで即座に確認する」**

「色を値として扱う」のではなく「色の関係を式として記述する」のが核心。
`Normal.fg.darken(40)` のように既存グループの色から派生した値を定義でき、
ベース色を変えるとすべての派生色が自動的に更新される。

---

## 色操作 API（`lua/lush/vivid/hsl_like.lua`）

HSL と HSLuv の両方をサポート。すべての操作はメタテーブルでチェーン可能。

```lua
local hsl = lush.hsl
local base = hsl(208, 90, 30)  -- hsl(H, S, L)

-- 明度操作
base:lighten(20)   -- L += 20
base:darken(20)    -- L -= 20

-- 彩度操作
base:saturate(20)  -- S += 20
base:desaturate(20) -- S -= 20

-- 色相操作
base:rotate(60)    -- H += 60 (循環)

-- 色の取得
base:hue()         -- H 値を返す
base:saturation()  -- S 値を返す
base:lightness()   -- L 値を返す

-- ミックス
base:mix(other, ratio)  -- 2色をベクトルブレンド

-- コントラスト判定
base:readable()    -- コントラスト比に基づき白or黒を返す

-- チェーン
base:darken(20):desaturate(10):rotate(30)
```

---

## DSL 仕様（`lua/lush/parser.lua`）

### 3種のグループ定義

```lua
return lush(function()
  return {
    -- 1. direct: 色を直接指定
    Normal { bg = hsl(208, 90, 30), fg = hsl("#A3CFF5") },

    -- 2. link: 別グループへのリンク（{ GroupName } 記法）
    Statement { Keyword },

    -- 3. inherit: 別グループから継承して一部上書き（{ Parent, attr = val }）
    Comment { Whitespace, gui = "italic" },
  }
end)
```

**実装メカニズム**: `setfenv` で spec 関数のスコープを書き換え、
`GroupName` という未定義変数へのアクセスを自動的にグループ参照として解決する。

---

## エントリポイント（`lua/lush.lua`）

```lua
-- spec 関数渡し → パース（返り値を後で利用可能）
local parsed = lush(function() ... end)

-- parsed spec 渡し → Neovim に適用
lush(parsed)

-- API
lush.parse(spec)    -- spec → AST
lush.compile(ast)   -- AST → nvim_set_hl 用テーブル
lush.apply(parsed)  -- Neovim API 経由で直接適用
lush.extends({spec1, spec2}).with(overrideSpec)  -- スペックの継承
lush.merge({spec1, spec2})  -- スペックのマージ
```

---

## Shipwright エクスポート（`lua/shipwright/transform/lush/`）

ビルドシステム Shipwright を通じて配布用ファイルを生成できる。

```lua
-- 出力形式: Lua テーブル形式
-- Normal = {fg = "#A3CFF5", bg = "#1e3050"},
-- Comment = {fg = "#...", italic = true},

-- 出力形式: Vimscript 形式
-- hi Normal guifg=#A3CFF5 guibg=#1e3050
-- hi Comment guifg=#... gui=italic
```

エクスポート時はリンク解決を行い、実際の HEX 値を埋め込む。

---

## ライブプレビュー（`:Lushify`）

開発時は `:Lushify` コマンドで spec ファイルを保存のたびに即座に Neovim に適用。
色の関係式が変わった場合は依存するすべてのグループが自動更新される。

---

## アーキテクチャ

```
入力: Lua DSL (spec 関数)
       ↓
  parser: setfenv → グループ名を自動解決 → AST 生成
  グループ型: direct / link / inherit
       ↓
  compiler: AST → { "Normal" = {fg="...", bg="..."}, ... } テーブル
       ↓
  apply: vim.api.nvim_set_hl() で直接適用
       ↓
  (optional) Shipwright export → .lua / .vim ファイル
```

---

## oshicolor への示唆

- **色の関係式**: `fg = Normal.bg.lighten(70)` のような派生定義は oshicolor のカラーマッパーでも参考になる。ベース色を変えると全派生色が更新されるリアクティブ設計
- **HSLuv のサポート**: lush は HSL に加え **HSLuv**（知覚均一な HSL）もサポートしている。OKLch と同様の目的の色空間
- **inherit 記法**: 親グループの色を引き継ぎつつ一部だけ変える設計は、oshicolor の「クラスター」概念と相性が良い
- **チェーン操作**: `base:darken(20):desaturate(10)` は OKLch の L/C 操作に対応する API として参考にできる
- **配布形式**: `lush spec → lua テーブル / vimscript` という変換パイプラインは oshicolor の出力設計の参考になる
