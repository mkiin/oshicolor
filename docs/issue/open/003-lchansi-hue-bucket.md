---
title: LchAnsi hue バケット実装（欠損色フォールバック）
labels: [feature]
mvp: 1
feature: color-extract
sprint:
created: 2026-05-07
branch:
---

# LchAnsi hue バケット実装（欠損色フォールバック）

## 何をやるか

色相を 6 バケット (red/yellow/green/cyan/blue/magenta) + black/gray に振り分け、各バケットの代表色を抽出する。バケットが空の場合は固定値とその近傍から人工的に合成する。

## なぜやるか

画像の色相が偏っていても ANSI 順序が守られる。Neovim のシンタックスハイライトが壊れない安全網。

## 完了条件

- [ ] hue 6 バケット振り分け
- [ ] black/gray バケット (L<5, L>95)
- [ ] 欠損バケットの色合成

## 関連

- spec: docs/features/color-extract/spec.md
- 参考: docs/references/wallust/overview.md（§3 LchAnsi、§7 src/colorspaces/lchansi.rs）
