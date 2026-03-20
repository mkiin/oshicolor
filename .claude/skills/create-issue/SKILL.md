---
name: create-issue
description: >
  GitHub Issue を作成する。issues.md や会話コンテキストから Issue を生成し、
  ラベル・ブランチ名も提案する。
  「Issue を作って」「GitHub に登録」「タスクを切る」といった文脈で使用。
disable-model-invocation: true
argument-hint: <RX> [概要]
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

- `R2` — フィーチャー名のみ。会話コンテキストから Issue 内容を構成
- `R2 "tonal palette の Tone 差が不十分"` — 概要付き

## 実行手順

### Step 1: 情報を収集する

1. `$ARGUMENTS[0]` (RX) に対応する最新バージョンの `issues.md` を読む
   - パス: `docs/projects/features/$0/` 以下の最新 VX ディレクトリ
2. 会話コンテキストから Issue に含めるべき情報を抽出する
3. 上記「現在のオープン Issue」と重複しないか確認する

### Step 2: Issue 内容を構成する

以下の情報を整理する:

- **タイトル**: `[RX/VY] 概要` 形式
- **ラベル**: フィーチャーラベル (`R1`〜`R5`) + 種別ラベル (`bug`, `enhancement`, `plan`, `research`)
- **本文**: 問題の説明、再現手順（あれば）、対応方針（あれば）、関連する plan.md/issues.md へのリンク

### Step 3: ユーザーに確認する

作成する Issue のプレビューを提示し、修正が必要か確認する。

### Step 4: Issue を作成する

確認後、`gh issue create` で Issue を作成する:

```bash
gh issue create \
  --title "[RX/VY] タイトル" \
  --body "本文" \
  --label "RX,種別"
```

### Step 5: ブランチ名を提案する

作成した Issue 番号を使って、ブランチ名を提案する:

```
feature/RX-VY-概要-kebab-case
```

## 注意事項

- 重複 Issue を作らない。Step 1 で既存 Issue を必ず確認する
- ラベルが存在しない場合は作成しない（ユーザーに報告する）
- 本文は簡潔に。長い説明は plan.md や issues.md へのリンクで代替する
