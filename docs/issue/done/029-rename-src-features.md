---
title: src/features を docs 命名に rename
labels: [refactor]
mvp: 1
feature:
sprint:
created: 2026-05-07
branch: features/refactor/029-rename-src-features
---

# src/features を docs 命名に rename

## 何をやるか

`docs/features/` の命名に合わせて `src/features/` の各ディレクトリを rename し、AI Vision 出力に依存していた実装を一旦白紙にする。具体的な作業は次のとおり。

- `src/features/palette-generator/` を `src/features/palette-design/` に rename する
- `src/features/vim-preview/` を `src/features/preview/` に rename する
- `src/features/palette-design/usecases/` の中身 diagnostic.ts、neutral.ts、syntax.ts、ui.ts を全削除する
- AI Vision 出力に依存する stores、たとえば `vision-result.atom.ts` を削除する
- 上記の rename と削除に追従して全 import を修正する

## なぜやるか

docs と src の feature 命名が一致していないと、後で spec とコードの対応が分かりにくくなる。usecases は AI Vision 出力に依存した実装なので、wallust ベースに置き換えるためにここで一度白紙にしておく。

## 完了条件

- [x] `palette-generator` が `palette-design` に rename されている
- [x] `vim-preview` が `preview` に rename されている
- [x] `palette-design/usecases/` が空である
- [x] AI Vision 依存の stores が削除されている
- [x] 全 import が新パスに追従している

## 実装方針

### 設計アプローチ

`git mv` でディレクトリ rename (`palette-generator` → `palette-design`、`vim-preview` → `preview`) を行い、`palette-design/usecases/` 配下の AI Vision 依存 usecase (diagnostic.ts、neutral.ts、syntax.ts、ui.ts、seed-selection.ts、generate-palette.ts) を削除する。連鎖して AI Vision 依存の stores (vision-result.atom.ts、seeds.atom.ts、neutral.atom.ts、syntax.atom.ts、ui.atom.ts、diagnostic.atom.ts、palette.atom.ts) と vision-result 表示 components (seed-view.tsx、editor-palette-view.tsx、syntax-palette-view.tsx、diagnostic-palette-view.tsx) と types/vision-result.ts も削除する。残るのは Palette 型定義、mood atom、汎用ユーティリティ (config.ts、blend.ts、contrast.ts、oklch-utils.ts)。最後に全 import パスを `@/features/palette-design` と `@/features/preview` に追従させる。

### 触るファイル

- `src/features/palette-generator/` → `src/features/palette-design/` rename
- `src/features/vim-preview/` → `src/features/preview/` rename
- `src/features/palette-design/usecases/` の AI Vision 依存 usecase を削除
- `src/features/palette-design/stores/` の AI Vision 依存 atom を削除
- `src/features/palette-design/components/` の vision-result 表示 component を削除
- `src/features/palette-design/types/vision-result.ts` 削除
- `src/features/palette-design/index.ts` を残す export だけに書き換え
- `src/features/preview/usecases/palette-to-vim-colors.ts`、`palette-to-shiki-theme.ts`、`types/vim-preview.types.ts`、`components/vim-preview.tsx` の import パスを `@/features/palette-design` に書き換え
- `src/routes/preview.tsx` の import パスを `@/features/preview` に書き換え

### 構造・命名・責務分離

`palette-design` の責務は「パレット型定義 (Palette、ThemeMood 等)、mood 状態管理、汎用パレット計算ユーティリティ」までに縮退させる。wallust ベースの新パレット生成路線はこの issue では着手せず、後続 issue (005〜008) で実装する。`preview` は引き続き Palette を引数として受け取るレンダリング層として残す。

### 使用ライブラリ

新規追加なし。

### テスト戦略

自動テストなし。`pnpm build` が成功すること、`pnpm dev` でトップページとプレビューページに到達できることを手動確認する。トップページの placeholder 表示と preview ページの VimPreview 表示の二点を確認対象とする。

## 関連

- 前提: 028 AI Vision 系コードの一掃
- 後続で影響を受ける issue: 005〜008 palette-design 系、013 と 014 preview 系
