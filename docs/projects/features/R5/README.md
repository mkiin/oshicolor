# R5 リアルタイムプレビュー UI

HighlightMap を Neovim 風 UI でプレビュー表示する機能。

## バージョン履歴

| Ver | 核心アイデア | 主な問題 → 次バージョンへ |
| --- | --- | --- |
| V1  | prism-react-renderer + CSS 変数ベースの Neovim 再現プレビュー | 開発中 |

## 設計変遷

```
V1: "prism-react-renderer + CSS 変数で即時反映"
     + Neovim 風 UI（行番号 + コード + ステータスライン）
     + HighlightMap → CSS 変数インジェクト
     → 開発中
```

## 現行: V1

[`V1/plan.md`](V1/plan.md)

## 関連ドキュメント

- [`r5-preview-editor.md`](r5-preview-editor.md) — 詳細設計（既存）

## VX/ 配下のファイル命名規則

| ファイル | 役割 | 必須 |
| --- | --- | --- |
| `plan.md` | なぜこの版が必要か + 設計方針 + 変更点 | Yes |
| `spec.md` | アルゴリズム/実装の詳細仕様 | Yes |
| `issues.md` | この版で判明した課題・限界 | 任意 |
| `research.md` | 外部調査・業界事例 | 任意 |
