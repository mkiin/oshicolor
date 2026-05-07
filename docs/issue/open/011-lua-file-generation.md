---
title: Lua ファイル生成
labels: [feature]
mvp: 2
feature: lua-gen
sprint:
created: 2026-05-07
branch:
---

# Lua ファイル生成

## 何をやるか

ハイライトグループ → カラーの割り当てから、Neovim プラグインとして読み込める Lua ファイルを生成する。テンプレートベースで実装する。

## なぜやるか

最終成果物。ユーザーが dotfiles に組み込めるファイル形式が必要。

## 完了条件

- [ ] Lua テンプレート (lush.nvim 形式 or 直書き)
- [ ] vim.api.nvim_set_hl ベースの出力
- [ ] テーマ名・コメントヘッダの自動付与

## 関連

- spec: docs/features/lua-gen/spec.md
