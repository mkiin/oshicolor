---
name: create-issue
description: >
  GitHub Issue を作成する。issues.md や会話コンテキストから Issue を生成し、
  ラベル・ブランチ名も提案する。
  「Issue を作って」「GitHub に登録」「タスクを切る」といった文脈で使用。
disable-model-invocation: true
argument-hint: <MVP-X> [概要]
allowed-tools: Bash(gh issue *), Bash(gh label *), Read, Grep, Glob
---

# create-issue

GitHub Issue を作成する。

## 前処理で取得したコンテキスト

### 現在のオープン Issue

!`gh issue list --state open --limit 20 2>/dev/null || echo "取得失敗（gh 未認証の可能性）"`

### 登録済みラベル

!`gh label list --limit 50 2>/dev/null || echo "取得失敗"`

## 入力

`$ARGUMENTS` の形式:

- `MVP-1` — MVP 番号のみ。会話コンテキストから Issue 内容を構成
- `MVP-1 "AI Vision のプロンプト精度改善"` — 概要付き

## 実行手順

### Step 1: 情報を収集する

1. `$ARGUMENTS[0]` (MVP-X) に対応するドキュメントを確認する
   - パス: `docs/projects/features/pipeline-v2/$0/` 以下
2. 会話コンテキストから Issue に含めるべき情報を抽出する
3. 上記「現在のオープン Issue」と重複しないか確認する

### Step 2: Issue 内容を構成する

以下の情報を整理する:

- **タイトル**: `[MVP-X] 概要` 形式
- **ラベル**: 種別ラベル (`feature`, `bug`, `task`, `refactor`, `research`)
- **本文**: 問題の説明、対応方針（あれば）、関連ドキュメントへのリンク

### Step 3: ユーザーに確認する

作成する Issue のプレビューを提示し、修正が必要か確認する。

### Step 4: Issue を作成する

確認後、`gh issue create` で Issue を作成する:

```bash
gh issue create \
  --title "[MVP-X] タイトル" \
  --body "本文" \
  --label "種別"
```

### Step 5: ブランチ名を提案する

作成した Issue 番号を使って、ブランチ名を提案する:

```
feature/mvp-X-概要-kebab-case
```

## 注意事項

- 重複 Issue を作らない。Step 1 で既存 Issue を必ず確認する
- ラベルが存在しない場合は作成しない（ユーザーに報告する）
- 本文は簡潔に。長い説明は plan.md や issues.md へのリンクで代替する
