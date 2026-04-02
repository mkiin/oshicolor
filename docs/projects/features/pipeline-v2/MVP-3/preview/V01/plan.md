# MVP-3/preview/V01 Shiki ベースの Neovim 風プレビュー

## 概要

prism-react-renderer を Shiki に置き換え、パレット JSON からリアルタイムで Neovim 風プレビューを表示する。

## なぜ Shiki に移行するか

- **トークン精度**: Shiki は TextMate grammar ベースで Prism より正確
- **Neovim との一致**: Neovim も Tree-sitter（TextMate 系）を使うので、ハイライト結果が近い
- **テーマ互換**: カスタム JSON テーマを動的生成して適用できる

## 設計方針（vimee パターンを採用）

vimee (`sample-repo/stack/vimee`) の `@vimee/shiki-editor` パターンに倣う:

1. **`codeToTokens()` でトークン配列を取得**（HTML 文字列ではない）
2. **各トークンの `color` をインラインスタイルで適用**
3. **CSS 変数で UI 色（カーソル、選択、ステータスライン等）を制御**

### レンダリングフロー

```
NeovimColorTokens
  → buildShikiTheme()    # カスタム Shiki JSON テーマを動的生成
  → createHighlighter()  # テーマ+言語でハイライターを初期化
  → codeToTokens()       # トークン配列 (ThemedToken[][]) を取得
  → <span style={{ color: token.color }}>  # React で直接レンダリング
```

### 色の動的更新

```
パレット JSON 変更
  → NeovimColorTokens 更新
  → buildShikiTheme() 再実行
  → highlighter.loadTheme() で新テーマを登録
  → codeToTokens() 再実行（useMemo で自動）
  → React re-render
```

## 前版（prism-react-renderer）との変更対照表

| 項目 | pipeline-v1 (Prism) | V01 (Shiki) |
|---|---|---|
| トークン化 | `<Highlight>` render props | `codeToTokens()` + useMemo |
| テーマ形式 | PrismTheme (styles 配列) | Shiki JSON テーマ (TextMate tokenColors) |
| 色の適用 | `getTokenProps()` | `token.color` インラインスタイル |
| カーソル行 | render props 内で行ごとに背景色 | CSS 変数 `--cursor-line` |
| UI 色 | インラインスタイル | CSS 変数 |

## 影響範囲

| ファイル | 変更 |
|---|---|
| `prism-theme.ts` | **削除** → `shiki-theme.ts` に置き換え |
| `neovim-code-block.tsx` | **スクラップ&ビルド**: `<Highlight>` → useShikiTokens + token map |
| `neovim-preview.atoms.ts` | `prismThemeAtom` → `shikiHighlighterAtom` + `shikiTokensAtom` |
| `neovim-gutter.tsx` | 軽微（データソースの変更のみ） |
| `neovim-statusline.tsx` | CSS 変数化 |
| `neovim-tabline.tsx` | CSS 変数化 |
| `neovim-editor-area.tsx` | レイアウト構造は維持 |

## やること

- [ ] Shiki 依存の追加（`shiki` パッケージ）
- [ ] `buildShikiTheme()`: NeovimColorTokens → Shiki JSON テーマ変換
- [ ] `useShikiTokens` hook 実装
- [ ] neovim-code-block.tsx の書き換え
- [ ] CSS 変数による UI 色制御
- [ ] prism-react-renderer 依存の削除
- [ ] サンプルコード（TypeScript, Python, Lua）での表示確認
