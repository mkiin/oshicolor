---
title: Kmeans 色抽出（K=8-12、背景マスキング）
labels: [feature]
mvp: 1
feature: color-extract
sprint:
created: 2026-05-07
branch:
---

# Kmeans 色抽出（K=8-12、背景マスキング）

## 何をやるか

Lab 色空間で Kmeans (K=8-12) クラスタリングし、画像から主要色を抽出する。前段で四隅 flood fill による背景マスキングを入れ、前景部分のみクラスタリング対象にする。

## なぜやるか

アニメ画像はベタ塗りの色面が多く Kmeans との相性が良い。背景に引きずられないよう前景抽出が必要。

## 完了条件

- [ ] Lab 空間 Kmeans 実装
- [ ] 背景マスキング（四隅 flood fill）
- [ ] 乱数シード固定で再現性保証

## 関連

- spec: docs/features/color-extract/spec.md
- 参考: docs/references/wallust/overview.md（§2 Backend、§6 アニメ画像の特性）
