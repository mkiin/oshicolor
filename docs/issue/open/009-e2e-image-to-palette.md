---
title: 'E2E: 画像 → パレット JSON 出力'
labels: [task]
mvp: 1
feature: palette-design
sprint:
created: 2026-05-07
branch:
---

# E2E: 画像 → パレット JSON 出力

## 何をやるか

色抽出からパレット設計までの一気通貫のテスト。画像ファイル 1 枚を入力し、最終的な Neovim 用パレット JSON が出力されることを確認する。

## なぜやるか

MVP-1 の完了条件。各ステップの単体テストだけでは「組み合わせて動くか」が分からない。

## 完了条件

- [ ] テスト画像数枚を fixture として用意
- [ ] 入力画像 → JSON の自動テスト
- [ ] WCAG コントラスト比のアサーション

## 関連

- spec: docs/features/palette-design/spec.md
