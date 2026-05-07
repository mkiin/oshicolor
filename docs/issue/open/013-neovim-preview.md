---
title: Neovim 風プレビュー
labels: [feature]
mvp: 3
feature: preview
sprint:
created: 2026-05-07
branch:
---

# Neovim 風プレビュー

## 何をやるか

ブラウザ上に Neovim 風のコードビューアを表示し、生成したテーマがどう見えるかをプレビューする。複数言語サンプル (TS, Python, Lua) 対応。

## なぜやるか

ダウンロード前に「実際にどう見えるか」を確認できないと、何度もダウンロードを試すハメになる。MVP-3 のコア体験。

## 完了条件

- [ ] コードハイライタ (Prism or Shiki) との統合
- [ ] ハイライトグループ → CSS 変数のマッピング
- [ ] 言語切り替え UI (TS/Python/Lua)

## 関連

- spec: docs/features/preview/spec.md
