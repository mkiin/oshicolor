---
title: Neovim ハイライトグループへの 2 層マッピング
labels: [feature]
mvp: 1
feature: palette-design
sprint:
created: 2026-05-07
branch:
---

# Neovim ハイライトグループへの 2 層マッピング

## 何をやるか

LchAnsi で得た 8 色（black/red/green/yellow/blue/magenta/cyan/gray）を中間表現とし、Neovim のシンタックスグループ (Normal/Comment/String/Keyword/Function/Type/Constant/Visual/Search) にセマンティックに割り当てる。

## なぜやるか

ANSI 16 色そのままでは Neovim には粗い。中間表現を経由することで欠損色の補完が効き、推し色を Visual/Search に当てるなどの拡張が容易になる。

## 完了条件

- [ ] 中間 8 色 → ハイライトグループのマッピング表
- [ ] 推し色を Visual/Search に当てるオプション
- [ ] ANSI 16 色も同時出力

## 関連

- spec: docs/features/palette-design/spec.md
- 参考: docs/references/wallust/overview.md（§6 LchAnsi を中間表現として使う）
