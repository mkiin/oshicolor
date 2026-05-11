---
name: create-issue
description: >
  ローカルで Issue を作成する。会話コンテキストから docs/issue/{open,idea}/00X-xxx.md を生成する。
  「Issue を作って」「タスクを切る」「これ Issue 化して」「アイデアを記録」といった文脈で使用。
disable-model-invocation: true
argument-hint: [概要]
allowed-tools: Read, Write, Glob, Edit
---

# create-issue

会話コンテキストから Issue を生成し `docs/issue/{open,idea}/` に保存する。
ユーザーは Markdown を直接書かない前提。AI が会話から構造化する。

## 入力

`$ARGUMENTS`: Issue 概要（任意）。指定されない場合は会話コンテキストから判断する。

## 実行手順

### Step 1: テンプレを読む

`.claude/templates/issue.md` を Read で読み込む。

### Step 2: 既存 Issue の最大番号を取得する

`docs/issue/{open,current,done,idea}/*.md` を Glob で一覧取得し、ファイル名先頭の 3 桁番号から最大値を求める。
新しい Issue 番号 = 最大 + 1（3 桁ゼロ埋め）。1 件もない場合は `001`。

### Step 3: 配置先を判断する

会話コンテキストから種別を判断する:

- アイデア段階（実装するか不確か）→ `docs/issue/idea/`
- 実装意思あり → `docs/issue/open/`

判断つかない場合はユーザーに確認する。

### Step 4: 内容を生成する

会話コンテキストから以下を埋める:

- `title`
- `labels`: `feature` / `bug` / `task` / `refactor` / `research` / `idea` から複数選択。idea/ 配下のものは `idea` を含める
- `mvp`: 1〜5（該当しなければ frontmatter から削除）
- `feature`: color-extract / palette-design / lua-gen / download-ui / preview / distribution（該当しなければ削除）
- `created`: 今日の日付
- `branch`: 着手前なら空
- `何をやるか` / `なぜやるか` / `完了条件` / `関連`

`実装方針` セクションは create-issue では空のままにする。着手時に `feature-design` skill が HOW（このタスクの作業手順）を埋める。trivial な bug fix では着手者が直接埋めてよい。コメントの観点ガイドだけ残しておく。

WHAT（feature 仕様、API、型、アルゴリズム）は `docs/features/<feature>/spec.md` に書くため、`実装方針` には書かない。

不明な情報はユーザーに簡潔に確認する。憶測で埋めない。

### Step 5: ファイル名を決定する

`<3桁番号>-<title を kebab-case>.md`

例: `005-kmeans-color-extract.md`

### Step 6: ユーザーに確認する

draft の全文と保存先パスを提示する。修正なければ Write する。

### Step 7: ブランチ名を提案する（任意）

`open/` 配下の Issue で着手する場合のブランチ名:

```
<labels[0]>/<番号>-<title-kebab>
```

例: `feature/005-kmeans-color-extract`

## 注意事項

- frontmatter は YAML として有効に保つ。空フィールドは省略してよい
- 既存 Issue との重複は title で簡易チェックする
- 1 度に複数 Issue を作る場合は連番で採番する（並列に作っても番号が重複しないように）
- 「やらないこと」「Approach」セクションは追加しない。必要なら body に自由に書き足してもらう
