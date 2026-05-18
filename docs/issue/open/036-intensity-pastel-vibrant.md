---
title: intensity 補正 (Pastel/Vibrant) を salience_palette に追加
labels: [feature]
mvp: 2
feature: color-extract
created: 2026-05-18
branch:
---

# intensity 補正 (Pastel/Vibrant) を salience_palette に追加

## 何をやるか

color-extract feature の salience_palette に intensity 補正のノブを追加し、Normal / Pastel / Vibrant の 3 段階から選べるようにする。wallust v4 の `with_intensity` を移植する形になる。

## なぜやるか

色の「強さ」の好みは画像とユーザーで分かれる。柔らかい色合いを好むユーザーには Pastel、鮮やかさを求めるユーザーには Vibrant、画像そのままを尊重したいユーザーには Normal、と切り替えできることでテーマの自由度が上がる。MVP (#035) では Normal のみで運用し、ユーザー検証で需要が確認できた段階で追加する。

## 完了条件

- [ ] Intensity 3 種類 (Normal/Pastel/Vibrant) が `extractColors(image, { intensity })` で選択できる
- [ ] 同じ画像で intensity を切り替えると出力 Colors が期待どおり変わる
- [ ] 各 intensity の単体テストが追加される
- [ ] spec.md の 6 salience_palette の節が更新される

## 実装方針

着手時に feature-design skill が埋める。

## 関連

- spec: docs/features/color-extract/spec.md
- 参考: docs/references/wallust/v4-changes.md (§4 with_intensity)
- 前提 issue: #035 (Phase 1 の Salience pipeline 移植)
