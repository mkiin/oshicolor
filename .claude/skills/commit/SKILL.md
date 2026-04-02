---
name: commit
description: >
  git diff からコミットメッセージを生成してコミットする。
  「コミット」「コミットして」「変更を保存」といった文脈で使用。
disable-model-invocation: true
allowed-tools: Bash(git *)
model: haiku
---

# commit

git diff を分析し、Conventional Commits 形式のコミットメッセージを生成してコミットする。

## 前処理で取得したコンテキスト

### ステージング状態

!`git status --short 2>/dev/null`

### staged diff

!`git diff --cached 2>/dev/null | head -200`

### unstaged diff

!`git diff 2>/dev/null | head -200`

### 直近のコミットメッセージ

!`git log --oneline -5 2>/dev/null`

## 実行手順

### Step 1: 差分を確認する

1. staged / unstaged の差分を確認する
2. 差分がなければ「コミットする変更がありません」と報告して終了する
3. unstaged の変更がある場合、ステージング 意味的なまとまりでステージングする。

### Step 2: コミットメッセージを生成する

差分の内容から以下を判断する:

- **種別**: `feat` / `fix` / `refactor` / `docs` / `chore` / `test`
- **要約**: 変更の「なぜ」を 1 行で（日本語 OK）

形式:

```
<種別>: <要約> (#issue number)
```

複数の論理的変更が含まれている場合は、分割コミットを行う。

### Step 3: コミットする

```bash
git commit -m "<メッセージ>"
```

## 種別の判断基準

| 種別       | 条件                             |
| ---------- | -------------------------------- |
| `feat`     | 新しい機能・ファイルの追加       |
| `fix`      | バグ修正、既存動作の修正         |
| `refactor` | 動作を変えないコード改善         |
| `docs`     | ドキュメント・コメントのみの変更 |
| `chore`    | 設定・依存関係・ビルドの変更     |
| `test`     | テストの追加・修正               |

## 注意事項

- `.env` やクレデンシャルを含むファイルが staged されていたら警告する
- 1 コミット = 1 論理的変更を守る。混ざっていたら分割をする
- メッセージは簡潔に。本文（body）は原則不要
