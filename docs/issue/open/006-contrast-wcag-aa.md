---
title: コントラスト保証（WCAG AA）
labels: [feature]
mvp: 1
feature: palette-design
sprint:
created: 2026-05-07
branch:
---

# コントラスト保証（WCAG AA）

## 何をやるか

背景と前景・各シンタックス色のコントラスト比が WCAG AA (4.5:1) を満たすまで、暗化と明化を繰り返す自動補正ループを実装する。最大 10 回程度のイテレーション。

## なぜやるか

エディタテーマで一番大事なのは可読性。アニメ画像から取れる色は淡いものが多く、補正なしだと Comment が背景に溶けて読めなくなる。

## 完了条件

- [ ] WCAG コントラスト比計算
- [ ] 反復補正ループ (最大 10 回)
- [ ] bg/fg + 全シンタックス色の対背景比保証

## 関連

- spec: docs/features/palette-design/spec.md
- 参考: docs/references/wallust/overview.md（§4 後処理、§7 src/colors.rs）
