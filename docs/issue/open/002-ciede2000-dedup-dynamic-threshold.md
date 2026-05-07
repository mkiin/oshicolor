---
title: CIEDE2000 dedup + 動的しきい値
labels: [feature]
mvp: 1
feature: color-extract
sprint:
created: 2026-05-07
branch:
---

# CIEDE2000 dedup + 動的しきい値

## 何をやるか

Kmeans の重心を CIEDE2000 色差で dedup し、似すぎる色を統合する。しきい値は並列に複数値を試し、最終色数 6-8 に収まる値を採用する動的探索方式。

## なぜやるか

Kmeans は髪のグラデや影で「ほぼ同じ色」を別クラスタとして拾う。dedup なしだと最終パレットが単調になる。

## 完了条件

- [ ] CIEDE2000 色差計算
- [ ] しきい値ベース dedup
- [ ] 動的しきい値探索（範囲 5-20）

## 関連

- spec: docs/features/color-extract/spec.md
- 参考: docs/references/wallust/overview.md（§3 Dynamic Threshold、§6 動的しきい値）
