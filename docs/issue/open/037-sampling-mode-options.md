---
title: sampling mode (high/distributed/low) を salience_palette に追加
labels: [feature]
mvp: 3
feature: color-extract
created: 2026-05-18
branch:
---

# sampling mode (high/distributed/low) を salience_palette に追加

## 何をやるか

color-extract feature の salience_palette に sampling mode のノブを追加し、Balanced (default) / High / Distributed / Low の 4 種類から選べるようにする。wallust v4 の SamplingMode を移植する形になる。

## なぜやるか

salience_palette が 16 色枠に 6 色をサンプリングするときの戦略を変えると、出力テーマの傾向が変わる。「最顕著な色を多めに取る (High)」「分布の端を取る (Distributed)」「目立たない色を取る (Low)」のような選択肢が要望として出る可能性がある。MVP (#035) では Balanced のみで運用し、ユーザー検証後に追加する。

## 完了条件

- [ ] Sampling mode 4 種類が `extractColors(image, { sampling })` で選択できる
- [ ] 同じ画像で sampling を切り替えると出力 Colors の color1 から color6 が変わる
- [ ] 各 sampling の単体テストが追加される
- [ ] spec.md の 6 salience_palette の節が更新される

## 実装方針

着手時に feature-design skill が埋める。

## 関連

- spec: docs/features/color-extract/spec.md
- 参考: docs/references/wallust/v4-changes.md (§5 sampling)
- 前提 issue: #035 (Phase 1 の Salience pipeline 移植)
