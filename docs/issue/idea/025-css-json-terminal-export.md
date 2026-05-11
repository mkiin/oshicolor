---
title: CSS / JSON / ターミナル向けエクスポート
labels: [feature, idea]
created: 2026-05-07
---

# CSS / JSON / ターミナル向けエクスポート

## 何をやるか

Neovim Lua 以外の出力形式をサポート: CSS 変数、JSON、kitty/alacritty/wezterm 等のターミナルテーマ。

## なぜやるか

Linux ricing 文化では環境全体の色統一ニーズがある。エディタだけでなく WM/ターミナルにも同じパレットを使いたい。

## 完了条件

- [ ] エクスポート形式の選択 UI
- [ ] CSS / JSON テンプレート
- [ ] kitty / alacritty / wezterm テンプレート

## 関連

- 参考: docs/references/wallust/overview.md（§6 出力テンプレート、minijinja）
