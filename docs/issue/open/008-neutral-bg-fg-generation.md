---
title: neutral（bg/fg）生成ロジック
labels: [feature]
mvp: 1
feature: palette-design
sprint:
created: 2026-05-07
branch:
---

# neutral（bg/fg）生成ロジック

## 何をやるか

抽出した色から背景色 (bg) と前景色 (fg) を生成する。最も暗い色を Lch で 80% 脱彩度 → 段階的に暗化、最も明るい色を 65% 明るく、のような派生ルール。

## なぜやるか

bg/fg は他の全ハイライトの基準になる。低彩度の安定した色でないとシンタックスハイライトが背景と喧嘩する。

## 完了条件

- [ ] bg 生成（最暗色 + 脱彩度）
- [ ] fg 生成（最明色 + 明度補正）
- [ ] dark/light モード両対応

## 関連

- spec: docs/features/palette-design/spec.md
- 参考: docs/references/wallust/overview.md（§4 dark palette）
