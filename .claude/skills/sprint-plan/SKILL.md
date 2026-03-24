---
name: sprint-plan
description: >
  スプリント計画。バックログを確認し、今週のゴールを1つ設定し、
  取り組む Issue を 3〜5 件選ぶ。「今週何やる？」「スプリント計画」
  「次のスプリント」といった文脈で使用。
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash(gh issue *), Bash(gh project *), Bash(gh api *)
---

# sprint-plan

週の始めに実行するスプリント計画。

## 前処理で取得したコンテキスト

### オープン Issue 一覧

!`gh issue list --state open --limit 30 2>/dev/null || echo "取得失敗（gh 未認証の可能性）"`

### 現在の Milestone

!`gh api repos/:owner/:repo/milestones --jq '.[] | "\(.title) (\(.open_issues) open, \(.closed_issues) closed)"' 2>/dev/null || echo "取得失敗"`

## 実行手順

### Step 1: 前スプリントの確認

直近の Milestone（前スプリント）があれば:

- 完了した Issue 数 / 残った Issue 数を確認
- 残った Issue は今回に持ち越すか、Backlog に戻すか判断を仰ぐ

前スプリントがなければスキップ。

### Step 2: バックログを俯瞰する

1. オープン Issue を一覧で提示する
2. `docs/projects/roadmap.md` を読み、MVP の進捗を確認する
3. 以下の観点で整理する:
   - MVP に必要な Issue はどれか
   - ブロッカーになっている Issue はどれか
   - すぐ終わる小粒な Issue はどれか

### Step 3: スプリントゴールを提案する

**1つだけ** ゴールを設定する。良いゴールの基準:

- 「〜できる状態にする」という完成形で書ける
- 1週間で達成可能
- MVP に近づく

例:
- 「画像から抽出した色で Lua ファイルを生成できる状態にする」
- 「プレビュー画面でダークテーマを確認できる状態にする」

### Step 4: Issue を選ぶ

ゴール達成に必要な Issue を **3〜5 件** 選ぶ。

各 Issue について:
- MVP に必要か？ → Yes なら優先
- 今週で完了できるサイズか？ → 大きすぎたら分割を提案
- 他の Issue をブロックしていないか？

### Step 5: 「やらないこと」を明示する

バックログにあるが今週は手を付けない Issue を明示する。
これがスプリントの最も重要な機能。

### Step 6: ユーザーに確認する

以下を提示して承認を得る:

```
## Sprint N (YYYY/MM/DD - YYYY/MM/DD)

### ゴール
[1文で]

### 今週やること
- #XX タイトル
- #XX タイトル
- #XX タイトル

### 今週やらないこと
- #XX タイトル（理由）
- #XX タイトル（理由）
```

### Step 7: Milestone を作成/更新する

承認後:

1. `gh api` で Milestone を作成（期限 = 今週末）
2. 選んだ Issue を Milestone に紐づけ
3. Projects ボードで該当 Issue を「This Sprint」列に移動

## 注意事項

- ゴールは必ず **1つ**。複数ゴールはスプリントの意味を失う
- 5件を超える Issue を入れない。入れすぎは未完了を生む
- 「やらないこと」を決めるのがこのスキルの本質
- MVP 期間中は、MVP ラベルの Issue を優先する
