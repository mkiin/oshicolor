---
title: src/features を docs 命名に rename
labels: [refactor]
mvp: 1
feature:
sprint:
created: 2026-05-07
branch:
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

- [ ] `palette-generator` が `palette-design` に rename されている
- [ ] `vim-preview` が `preview` に rename されている
- [ ] `palette-design/usecases/` が空である
- [ ] AI Vision 依存の stores が削除されている
- [ ] 全 import が新パスに追従している

## 関連

- 前提: 028 AI Vision 系コードの一掃
- 後続で影響を受ける issue: 005〜008 palette-design 系、013 と 014 preview 系
