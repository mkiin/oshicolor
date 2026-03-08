# oshicolor ドキュメントマップ

> 最終更新: 2026-02-23

---

## ディレクトリ構成

```
docs/
├── README.md                          ← このファイル（ナビゲーション用）
│
├── infra/                             ← インフラ・デプロイ関連
│   └── alchemy/                       ← Alchemy IaC フレームワーク
│
├── research/                          ← 技術調査・外部リソース分析
│   ├── nvim-themes/                   ← Neovim テーマ設計分析
│   ├── nvim-generators/               ← 既存 Neovim カラースキーム生成ツール調査
│   ├── color-extractors/              ← 色抽出ライブラリ調査
│   │   ├── extract-color/             ← extract-colors ライブラリ
│   │   ├── anicolors/                 ← anicolors 調査
│   │   └── node-vibrant/              ← node-vibrant（採用ライブラリ）
│   └── specs/                         ← カラースキーム仕様・標準
│
└── projects/                          ← プロジェクト固有ドキュメント
    ├── project.md                     ← プロジェクト全体概要
    ├── requirements/                  ← 要件定義
    ├── knowledge/                     ← 技術ナレッジ（oshicolor 固有）
    └── features/                      ← 機能別設計・実装記録
        ├── R1/ ← 色抽出
        ├── R2/ ← カラースキーム生成
        ├── R3/ ← コントラスト調整
        ├── R4/ ← Lua 生成
        └── R5/ ← プレビューエディタ
```

---

## infra/

### `infra/alchemy/`

Alchemy IaC フレームワークのリファレンス。

| ファイル | 内容 |
|---|---|
| `getting-start.md` | Alchemy のセットアップ手順 |
| `apps&stages.md` | App / Stage の概念と使い方 |
| `binding.md` | リソースバインディング |
| `cli.md` | CLI コマンドリファレンス |
| `d1-drizzle.md` | D1 + Drizzle ORM の設定 |
| `local-dev.md` | ローカル開発環境の構築 |
| `resource.md` | リソース定義の書き方 |
| `secret.md` | シークレット管理 |
| `tanstack-start.md` | TanStack Start との統合 |

---

## research/

### `research/nvim-themes/` — **Neovim テーマ設計分析**

| ファイル | 内容 |
|---|---|
| **`color-scheme-master.md`** ⭐ | **kanagawa / tokyonight / catppuccin 統合分析**。ハイライト階層アーキテクチャ、Hue マッピング比較、全ハイライトグループ対応表、oshicolor v4 への示唆を収録。 |
| **`red-hue-themes-analysis.md`** | **赤系テーマ分析**（reddish.nvim / rose-pine / gruvbox / monokai-pro）。signatureColor が赤系（H: 0°〜25°）の場合のハイライト割り当て戦略を調査。判断B の解決根拠。 |

### `research/nvim-generators/` — 既存カラースキーム生成ツール調査

既存の Neovim カラースキーム自動生成ツールの設計思想・実装調査。

| ファイル | 内容 |
|---|---|
| `README.md` | 調査対象ツール一覧・比較サマリ |
| `xeno-nvim.md` | xeno.nvim（トーンスケールベース） |
| `root-loops.md` | root-loops（ANSI-16 ベース） |
| `nvim-highlite.md` | nvim-highlite（自動コントラスト調整） |
| `colorgen-nvim.md` | colorgen-nvim（CLI ツール） |
| `lush-nvim.md` | lush.nvim（DSL ベース） |
| `vimcolors-org.md` | vimcolors.org の傾向分析 |

### `research/color-extractors/` — 色抽出ライブラリ調査

#### `extract-color/` — extract-colors ライブラリ

| ファイル | 内容 |
|---|---|
| `README.md` | extract-colors ライブラリ概要 |
| `anicolors-color-extractor.md` | anicolors 色抽出器の解析 |
| `comparison.md` | 各ライブラリの比較 |
| `extract-colors-lib.md` | extract-colors API リファレンス |

#### `anicolors/` — anicolors 調査

| ファイル | 内容 |
|---|---|
| `anicolors-code-map.md` | anicolors コードマップ |
| `color-extractor-comparison.md` | 抽出器の比較（anicolors 視点） |
| `hair-color-extraction.md` | 髪色抽出の特性分析 |

#### `color-thief/` — color-thief（colorthief v3+）調査

node-vibrant の比較対象として調査したライブラリ。OKLCH 量子化・豊富な Color オブジェクトが特徴。

| ファイル | 内容 |
|---|---|
| `README.md` | color-thief 概要・アーキテクチャ・機能一覧 |
| `vs-node-vibrant.md` | **node-vibrant との設計・アルゴリズム比較**（量子化色空間・スウォッチ分類の差異） |

#### `node-vibrant/` — node-vibrant（採用ライブラリ）⭐

oshicolor が採用している色抽出ライブラリ。R2 設計の基盤。

| ファイル | 内容 |
|---|---|
| `README.md` | node-vibrant 概要・採用理由 |
| `algorithm.md` | **MMCQ アルゴリズム詳解**（64色生成の仕組み） |
| `architecture.md` | ライブラリアーキテクチャ |
| `code-map.md` | コードマップ（クラス・関数一覧） |
| `data-flow.md` | **データフロー**（Swatch[] の生成から利用まで） |

### `research/specs/` — カラースキーム仕様・標準

| ファイル | 内容 |
|---|---|
| `base24-color-scheme-spec.md` | Base24 カラースキーム仕様 |

---

## projects/

### `projects/project.md`

プロジェクト全体の概要・背景・目標。

### `projects/requirements/`

| ファイル | 内容 |
|---|---|
| `requirements-phase1.md` | フェーズ1 機能要件定義 |

### `projects/knowledge/` — 技術ナレッジ

oshicolor に固有の技術調査・設計ナレッジ。

| ファイル | 内容 |
|---|---|
| `highlight-group-color-strategy.md` ⭐ | **ハイライトグループへの色割り当て戦略**。Hue ゾーン定義、スコアリング設計の詳細。 |
| `OKLab・OKLch/oklch-color-fundamentals.md` | OKLch 色空間の基礎知識 |

### `projects/features/` — 機能別設計・実装記録

#### `R1/` — 色抽出機能

| ファイル | 内容 |
|---|---|
| `color-extraction-explainer.md` | 色抽出の概念説明 |
| `r1-plan-v1.md` | v1 設計 |
| `r1-plan-v2.md` | v2 設計 |
| `r1-remaining-issues.md` | 未解決課題 |

#### `R2/` — カラースキーム生成機能 ⭐

| ファイル | 内容 |
|---|---|
| `r2-color-mapping-v1.md` | カラーマッピング v1 |
| `r2-color-mapping-v2.md` | カラーマッピング v2 |
| `r2-color-mapping-v3.md` | カラーマッピング v3 |
| `r2-plan-v2.md` | 実装計画 v2 |
| `r2-plan-v3.md` | 実装計画 v3 |
| **`r2-plan-v4.md`** ⭐ | **実装計画 v4**（node-vibrant 64色 + Hue ゾーンスコアリング。現行設計） |
| `r2-remaining-issues-v1.md` | 未解決課題 v1 |
| `r2-remaining-issues-v2.md` | 未解決課題 v2（判断A/B/C） |

#### `R3/` — コントラスト調整機能

| ファイル | 内容 |
|---|---|
| `r3-contrast-adjuster.md` | コントラスト自動調整の設計 |

#### `R4/` — Lua 生成機能

| ファイル | 内容 |
|---|---|
| `r4-lua-generator.md` | Neovim 向け Lua ファイル生成の設計 |

#### `R5/` — プレビューエディタ機能

| ファイル | 内容 |
|---|---|
| `r5-preview-editor.md` | Web 上でカラースキームをプレビューする機能の設計 |

---

## よく参照するドキュメント

| 目的 | ドキュメント |
|---|---|
| 「どのハイライトグループに何色を割り当てるか」知る | `research/nvim-themes/color-scheme-master.md` |
| node-vibrant の 64 色生成を理解する | `research/color-extractors/node-vibrant/algorithm.md` |
| R2 の現行設計（v4）を確認する | `projects/features/R2/r2-plan-v4.md` |
| Hue ゾーンスコアリングの詳細設計を確認する | `projects/knowledge/highlight-group-color-strategy.md` |
| OKLch の基礎を学ぶ | `projects/knowledge/OKLab・OKLch/oklch-color-fundamentals.md` |
| インフラ設定（Alchemy）を確認する | `infra/alchemy/` 配下 |
