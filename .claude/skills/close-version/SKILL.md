---
name: close-version
description: >
  フィーチャーバージョンの実装完了処理。
  spec.md を実装後の状態に更新し、関連 Issue をクローズ確認し、README.md を更新する。
  「V5 を完了にして」「バージョンをクローズ」「実装完了」といった文脈で使用。
disable-model-invocation: true
argument-hint: <RX>
allowed-tools: Read, Grep, Glob, Edit, Write, Bash(gh issue *), Bash(gh pr *)
---

# close-version

フィーチャーバージョンの実装完了処理を一括で行う。

## 前処理で取得したコンテキスト

### 関連オープン Issue

!`gh issue list --state open --limit 20 2>/dev/null || echo "取得失敗"`

## 入力

`$ARGUMENTS` は フィーチャー名（例: `R2`）

## 実行手順

### Step 1: 現在の状態を確認する

1. `docs/projects/features/$0/` の最新バージョンを特定
2. 最新バージョンの `plan.md` を読み、計画内容を把握
3. `src/features/` 以下の実装コードを確認

### Step 2: spec.md を更新する

`plan.md` の設計方針と実際の実装コードを照合し、`spec.md` を実装後の状態に更新する。
docs-convention スキルのフォーマットに従う。

含めるべき内容:

- アルゴリズム/処理の全体フロー
- 主要な定数・型定義
- 依存パッケージ（変更がある場合）

### Step 3: README.md を更新する

`docs/projects/features/$0/README.md` のバージョン履歴テーブルを更新:

- 現バージョンの「主な問題」列を埋める（issues.md があれば参照）
- 「現行」リンクが最新バージョンを指していることを確認

### Step 4: 関連 Issue の確認

1. 上記「関連オープン Issue」から、`$0` ラベルが付いた Issue を抽出
2. 各 Issue の状態をユーザーに提示
3. クローズしてよいか確認する（自動クローズはしない）

### Step 5: サマリーを提示

完了した内容をまとめて報告:

- 更新したファイル一覧
- クローズ候補の Issue 一覧
- 残っている課題（あれば）

## 注意事項

- spec.md は実装の「記録」。推測や計画は書かない
- Issue は自動クローズしない。ユーザーの確認を得てからクローズする
- issues.md に新たな課題があれば、次バージョンへの引き継ぎとして記録されていることを確認する
