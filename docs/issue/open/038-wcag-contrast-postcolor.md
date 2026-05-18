---
title: WCAG コントラスト補正の追加 (postcolor)
labels: [feature]
mvp: 2
feature: color-extract
created: 2026-05-18
branch:
---

# WCAG コントラスト補正の追加 (postcolor)

## 何をやるか

color-extract feature の出力に WCAG 21 コントラスト補正の段を追加する。salience_palette の後段で、背景と前景および各色のコントラスト比が WCAG AA 基準 (4.5:1) を満たすよう、必要な色の明度を反復補正する。wallust v4 の `check_contrast_all` を移植する形になる。

## なぜやるか

アニメ画像から取れる色は淡いものが多く、補正しないとエディタテーマで「背景と Comment が同化して読めない」「文字色が背景に溶ける」などの可読性問題が出やすい。MVP (#035) では補正なしで進めて、実テーマ生成で読みづらさが顕在化した時点で追加する。

## 完了条件

- [ ] `extractColors(image, { checkContrast: true })` でコントラスト補正が走る
- [ ] 補正後の Colors で `background ↔ foreground` および `background ↔ color1..color15` の比が 4.5:1 以上になる
- [ ] 補正の反復は最大 10 回まで (発散時の安全弁)
- [ ] 補正前後の値差が許容範囲内に収まる単体テストを追加
- [ ] spec.md に postcolor の節を追加

## 実装方針

着手時に feature-design skill が埋める。

## 関連

- spec: docs/features/color-extract/spec.md
- 参考: docs/references/wallust/v4-changes.md (§9 キャッシュとポストプロセス)
- 前提 issue: #035 (Phase 1 の Salience pipeline 移植)
