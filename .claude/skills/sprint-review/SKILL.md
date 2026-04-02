---
name: sprint-review
description: >
  スプリントのふりかえり。完了確認 + 良かった/悪かった/次に試すことを整理し、
  記録ファイルに保存する。「ふりかえり」「スプリント終了」「今週のまとめ」
  といった文脈で使用。
disable-model-invocation: true
allowed-tools: Read, Glob, Write, Bash(gh issue *), Bash(gh api *), Bash(git log *)
---

# sprint-review

週の終わりに実行するスプリントレビュー + ふりかえり。

## 前処理で取得したコンテキスト

### 現在の Milestone

!`gh api repos/:owner/:repo/milestones --jq '.[] | select(.state=="open") | "\(.title): \(.open_issues) open / \(.closed_issues) closed"' 2>/dev/null || echo "取得失敗"`

### 今週のコミット

!`git log --oneline --since="7 days ago" 2>/dev/null || echo "取得失敗"`

## 実行手順

### Step 1: スプリントゴールの達成確認

1. 現在の Milestone に紐づく Issue を確認
2. ゴールに対して何が完了し、何が残ったかを整理

```
ゴール: [スプリントゴール]
達成度: X/Y 件完了

完了:
  - #XX タイトル
  - #XX タイトル

未完了:
  - #XX タイトル（理由）
```

### Step 2: ふりかえり（KPT）

ユーザーと以下を整理する:

- **Keep（良かったこと）**: 続けたいこと
- **Problem（うまくいかなかったこと）**: 改善したいこと
- **Try（次に試すこと）**: 次スプリントで具体的に試すアクション

### Step 3: 記録を保存する

`docs/sprint-review/YYYY-WNN.md` に保存:

```markdown
# Sprint N (YYYY/MM/DD - YYYY/MM/DD)

## ゴール

[スプリントゴール]

## 結果

| Issue | タイトル | 状態                       |
| ----- | -------- | -------------------------- |
| #XX   | ...      | Done / 持ち越し / 取り下げ |

## ふりかえり

### Keep

- ...

### Problem

- ...

### Try

- ...
```

### Step 4: 後処理

1. 完了 Issue のクローズ確認（ユーザーに確認してからクローズ）
2. 未完了 Issue の扱いを決める:
   - 次スプリントに持ち越す
   - Backlog に戻す
   - 不要なら Close する
3. Milestone をクローズする
4. `docs/projects/roadmap.md` の進捗を更新する

## 注意事項

- Issue の自動クローズはしない。必ずユーザー確認
- ふりかえりは短くていい。形式より「次に何を変えるか」が大事
- Try は具体的なアクションにする（「気をつける」はNG、「Issue を3件以下にする」はOK）
