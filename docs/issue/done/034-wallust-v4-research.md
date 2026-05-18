---
title: library/wallust の実装と 4.0.0 リリース変更内容の調査
labels: [research]
feature: color-extract
created: 2026-05-18
branch: research/034-wallust-v4-research
---

# library/wallust の実装と 4.0.0 リリース変更内容の調査

## 何をやるか

- `library/wallust/`（4.0.0-alpha）の主要モジュールを読み、`gen_colors` を中心とした実行フローを最新版に追従させる
- 4.0.0 リリースで導入された変更点（API、新規 colorspace / backend / palette、アルゴリズム変更、依存変更、設定スキーマ変更）を整理する
- 既存 `docs/references/wallust/overview.md` との差分を洗い出し、レポートを追加または更新する

## なぜやるか

- oshicolor の color-extract 実装で wallust の知見を借りる前提のため、最新版に追従した知識が必要になる
- 現状の `overview.md` は旧バージョンを下敷きにしており、4.0.0 で挙動が変わっている部分は採用判断をやり直す必要がある
- vendor 済みのソースを読まずに kmeans / lch / salience 系の実装判断を進めると、後段の issue（#001, #003, #004）で根拠の薄い設計になりかねない

## 完了条件

- [ ] `library/wallust/src/` の backends, colorspaces, palettes, colors.rs を読み、4.0.0 の実行フローを把握する
- [ ] 4.0.0 の CHANGELOG または GitHub Release Notes を整理し、3.x からの差分を列挙する
- [ ] `docs/references/wallust/` 配下にレポートを追加または `overview.md` を更新する
- [ ] oshicolor への展開方針（採用するか、変えて取り入れるか）まで書ききる

## 実装方針

<!-- 着手時に feature-design skill が埋める（HOW を書く）。trivial な bug fix では着手者が直接埋めてよい -->
<!-- WHAT（feature 仕様・API・型・アルゴリズム）は docs/features/<feature>/spec.md に書く。ここには書かない -->

### 設計アプローチ

### 触るファイル

### 構造・命名・責務分離

### 使用ライブラリ

### テスト戦略

## 関連

- 既存レポート: docs/references/wallust/overview.md
- 関連 issue: #001 (kmeans-color-extract), #003 (lchansi-hue-bucket), #004 (salience-oshi-color)
- vendored source: library/wallust/ (4.0.0-alpha)
