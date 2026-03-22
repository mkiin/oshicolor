# R5/V1 Neovim プレビュー改善（HighlightMap 対応）

## なぜ V1 が必要か

既存の `src/features/neovim-preview/` に Neovim 風プレビューコンポーネントが実装済みだが、以下の課題がある:

1. **`NeovimColorTokens` が R2 の HighlightMap と乖離** — 独自の省略名（`fn`, `kw`, `op`）で、R2/V9 の 66 グループに対応していない
2. **bg が全て同じ色** — `Normal.bg`, `CursorLine.bg`, `StatusLine.bg` の区別がない
3. **CursorLine のハイライトがない** — カーソル行の背景色が未実装
4. **行番号の色が `comment` を流用** — `LineNr` / `CursorLineNr` の区別なし
5. **サンプルコードが外部から渡す必要がある** — 組み込みのデフォルトサンプルがない

## 既存実装の評価

### そのまま使える

- コンポーネント分割（Preview → EditorArea → Gutter + CodeBlock、StatusLine、Tabline）
- `prism-react-renderer` の `Highlight` コンポーネントの使い方
- `buildPrismTheme` による `PrismTheme` 生成
- Jotai + `useHydrateAtoms` の hydration パターン
- `Provider key={JSON.stringify(colors)}` による atom store リセット

### 変更が必要

- `NeovimColorTokens` 型 → R2/V9 の `HighlightMap` 互換型に拡張
- `atoms.ts` のデフォルト値 → neutral palette 段階値に対応
- 各コンポーネントが参照するカラートークン → 拡張型に合わせて更新
- `prism-theme.ts` のマッピング → 拡張型に合わせて更新

## 設計方針

### NeovimColorTokens の拡張

現行の省略名を HighlightMap の命名に合わせて拡張する:

```typescript
// 現行
type NeovimColorTokens = {
  bg: string;      // Normal.bg のみ
  fg: string;
  comment: string;
  fn: string;
  kw: string;
  // ...
};

// V1 拡張
type NeovimColorTokens = {
  // bg 階層（neutral palette 対応）
  bg: string;           // Normal.bg
  bgPopup: string;      // Pmenu.bg
  bgSurface: string;    // StatusLine.bg
  bgCursorLine: string; // CursorLine.bg
  bgVisual: string;     // Visual.bg

  // fg 階層
  fg: string;           // Normal.fg
  comment: string;      // Comment.fg
  lineNr: string;       // LineNr.fg
  cursorLineNr: string; // CursorLineNr.fg
  border: string;       // WinSeparator.fg / NonText.fg
  delimiter: string;    // Delimiter.fg

  // syntax（Vibrant seed 由来）
  keyword: string;      // Keyword / Statement / Conditional / Repeat
  fn: string;           // Function
  operator: string;     // Operator
  string: string;       // String / Character
  type: string;         // Type
  constant: string;     // Constant / Special
  number: string;       // Number / Boolean / Float

  // UI（Muted seed 由来）
  accent: string;       // ステータスラインのモード表示等
  searchBg: string;     // Search.bg
  pmenuSelBg: string;   // PmenuSel.bg
};
```

### CursorLine の実装

CodeBlock コンポーネントでカーソル行（固定位置、例: 3行目）に `bgCursorLine` を適用:

```tsx
<div style={{
  backgroundColor: isCursorLine ? bgCursorLine : 'transparent'
}}>
```

### サンプルコード組み込み

`constants/sample-code.ts` に TypeScript / Python / Lua のサンプルを定数として定義。各サンプルは以下のトークンを含む: comment, string, function, keyword, type, number, boolean, operator

## 実装タスク

1. **`NeovimColorTokens` 型の拡張** — bg 階層 + fg 階層 + syntax 名の正規化
2. **`atoms.ts` の更新** — 拡張型に合わせたデフォルト値
3. **`prism-theme.ts` の更新** — 拡張型のフィールド名に合わせる
4. **`NeovimGutter` の改善** — `lineNr` / `cursorLineNr` の色分け
5. **`NeovimCodeBlock` の改善** — CursorLine 背景の実装
6. **`NeovimEditorArea` の改善** — bg 階層の適用
7. **`NeovimStatusLine` の改善** — `bgSurface` を StatusLine 背景に使用
8. **`NeovimTabline` の改善** — `bgSurface` を Tabline 背景に使用
9. **サンプルコード定数** — 3 言語分の組み込みサンプル

## 依存パッケージ

変更なし。`prism-react-renderer` は既にインストール済み。
