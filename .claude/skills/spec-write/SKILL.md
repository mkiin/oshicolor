---
name: spec-write
description: >
  docs/features/<feature>/spec.md をテンプレに沿って生成または更新する。
  「spec を書いて」「<feature> の仕様をまとめて」といった文脈で使用。
disable-model-invocation: true
argument-hint: <feature-name>
allowed-tools: Read, Write, Edit, Glob
---

# spec-write

`docs/features/<feature>/spec.md` を `.claude/templates/spec.md` に従って生成・更新する。

## 入力

`$ARGUMENTS`: feature 名（例: `color-extract`, `palette-design`, `lua-gen`）

## 実行手順

### Step 1: テンプレを読む

`.claude/templates/spec.md` を Read で読み込む。

### Step 2: 既存ファイルを確認

`docs/features/$ARGUMENTS/spec.md` の存在を Glob で確認する。

- 存在する場合: Read で内容を取得し、更新モードへ
- 存在しない場合: 新規作成モードへ

### Step 3: 内容を生成

会話コンテキストから以下を抽出してテンプレを埋める:

- feature 名（frontmatter）
- status（planned / wip / implemented を会話から判断）
- last-updated（今日の日付）
- 概要、入出力、アルゴリズム / 処理フロー、主要な型・定数、依存

UI 系 feature など「アルゴリズム / 処理フロー」が不要な場合はセクションごと削除する。

### Step 4: ユーザーに確認

- 新規作成: 全文を提示し承認後に Write
- 更新: diff を提示し承認後に Edit

### Step 5: 書き込み

承認後にファイルを書き込み、保存先を報告する。

## 注意事項

- 「過去の検討経緯」は書かない。git history に任せる
- frontmatter の `last-updated` は必ず今日の日付に更新する
- 既存 spec.md を勝手に上書きしない。必ず diff 確認を経る
