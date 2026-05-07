---
title: 配布方法の調査・決定
labels: [research]
mvp: 4
feature: distribution
sprint:
created: 2026-05-07
branch:
---

# 配布方法の調査・決定

## 何をやるか

ユーザーへの配布方法を調査し決定する。候補: Neovim プラグイン連携、GitHub Gist 出力、ファイル直接ダウンロード、その他。

## なぜやるか

ダウンロードファイルだけだと dotfiles 管理ツール (lazy.nvim, packer 等) との連携が手作業になる。

## 完了条件

- [ ] 候補手段の調査 (3-5 件)
- [ ] 各手段の比較表
- [ ] MVP-4 で実装する 1 案の決定

## 関連

- spec: docs/features/distribution/spec.md
