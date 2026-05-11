---
title: Salience スコア（推し色強調）
labels: [feature]
mvp: 1
feature: color-extract
sprint:
created: 2026-05-07
branch:
---

# Salience スコア（推し色強調）

## 何をやるか

色の「目立ちやすさ」をスコア化し、推し色を優先的にパレットに残す仕組みを実装する。彩度 + 画像中心からの距離による減衰の重み付き和でスコア定義する。

## なぜやるか

キャラの推し色（髪色・瞳色など）をエディタの注目系（Visual/Search）に当てたい。単純な頻度ベースだと背景や肌色が優位になる。

## 完了条件

- [ ] Salience スコア式の実装
- [ ] 重み調整（彩度・中心距離）
- [ ] 推し色フィールドのパレットへの引き渡し

## 関連

- spec: docs/features/color-extract/spec.md
- 参考: docs/references/wallust/overview.md（§3 LchSalience、§6 Salience を推し度として再解釈）
