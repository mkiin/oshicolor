# R4/V1 Neovim Lua カラースキーム生成

## なぜ V1 か

MVP のボトルネック。R2 が 66 ハイライトグループを `HighlightMap` として出力するところまでできているが、Neovim で読み込める Lua ファイルへの変換が未実装。これがないと MVP の「画像1枚から Lua をダウンロード」が完成しない。

## 設計方針

- **テンプレート文字列生成**（案 A）を採用
- AST ベース生成は出力が単純なため不採用（オーバーエンジニアリング）
- 純粋関数1つで完結させる。副作用なし
- `HighlightBundle`（R2 の出力型）をそのまま入力として受け取る

## 入力

```typescript
type HighlightBundle = {
  seeds: string[];
  neutral: NeutralPalette;   // bg, fg, comment 等 9色
  diagnostic: DiagnosticColors; // error, warn, info, hint
  highlights: HighlightMap;  // 66グループ: Record<string, HighlightDef>
};
```

## 出力する Lua の構造

```lua
-- oshicolor: <themeName>
vim.cmd("hi clear")
if vim.fn.exists("syntax_on") then vim.cmd("syntax reset") end
vim.o.termguicolors = true
vim.o.background = "dark"
vim.g.colors_name = "<themeName>"

local hi = vim.api.nvim_set_hl
hi(0, "Normal", { fg = "#c8c8c8", bg = "#1a1a2e" })
hi(0, "Comment", { fg = "#5a5a6e", italic = true })
-- ... 66グループ
```

## 変更内容

### 新規ファイル

| ファイル | 役割 |
|---|---|
| `src/features/lua-generator/lua-generator.ts` | `generateLuaColorscheme(bundle, themeName): string` 本体 |
| `src/features/lua-generator/lua-generator.test.ts` | 出力検証テスト |

### `generateLuaColorscheme` の処理

1. Lua ヘッダーを生成（`hi clear`, `background`, `colors_name`）
2. `HighlightMap` をループし、各 `HighlightDef` を `nvim_set_hl` 呼び出しに変換
   - `fg` / `bg` → hex 文字列をそのまま出力
   - `bold` / `italic` / `undercurl` → `true` のもののみ出力
3. 全行を結合して返す

### 未決定

- テーマ名のデフォルト値（`"oshicolor"` を仮置き）
- ライトテーマ対応（MVP 後）
