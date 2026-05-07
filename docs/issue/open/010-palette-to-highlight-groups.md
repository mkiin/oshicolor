---
title: パレット JSON → ハイライトグループ割り当て
labels: [feature]
mvp: 2
feature: lua-gen
sprint:
created: 2026-05-07
branch:
---

# パレット JSON → ハイライトグループ割り当て

## 何をやるか

palette-design が出力した JSON を読み込み、Neovim のハイライトグループ ID にマッピングするデータ変換層を実装する。

## なぜやるか

palette-design と lua-gen を疎結合にする中間層。将来 VSCode/kitty 等への拡張時もこの中間表現を使い回せる。

## 完了条件

- [ ] JSON スキーマ定義
- [ ] ハイライトグループ ID への変換
- [ ] エラーハンドリング (不正 JSON)

## 関連

- spec: docs/features/lua-gen/spec.md
