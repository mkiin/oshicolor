---
title: Neovim 風プレビュー
labels: [refactor]
mvp: 3
feature: preview
sprint:
created: 2026-05-07
branch:
---

# Neovim 風プレビュー

## 何をやるか

rename 後の `src/features/preview/` をベースに、新パレット形式を受け取って描画できる状態にリファクタする。Shiki との統合は既に動いているので、入力データ形式の差分対応が中心になる。

## なぜやるか

既存実装はかなり完成度が高い。一方で AI Vision 出力前提のデータ形式に対応しているため、MVP-1 で生成する新パレット形式とのインタフェースを揃える必要がある。

## 完了条件

- [ ] 新パレット形式を受け取れる
- [ ] ハイライトグループから CSS 変数へのマッピングが新形式に対応している
- [ ] 言語切り替え UI が動く

## 関連

- spec: docs/features/preview/spec.md
- 前提: 029 src/features を docs 命名に rename
