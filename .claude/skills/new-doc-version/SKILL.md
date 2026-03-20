---
name: new-doc-version
description: >
  docs/projects/features/ に新しいバージョンを発行する。
  討論で決まった設計方針を plan.md としてまとめ、ディレクトリを作成し、README.md を更新する。
  「次のバージョンを切る」「V5を作る」「新しいバージョンを発行」「planをまとめて」
  「今の議論をまとめてドキュメントにして」といった依頼に使うこと。
disable-model-invocation: true
argument-hint: <RX> [概要メモ]
allowed-tools: Read, Grep, Glob, Write, Bash(gh issue *), Bash(gh label *), Bash(mkdir *)
---

# new-doc-version

フィーチャーの次バージョンを発行する。
討論の内容を構造化されたドキュメントに変換し、GitHub Issue を作成するのが主な役割。

## 前提

docs/ の規約は `docs-convention` スキルに従う。
規約が不明な場合は `.claude/skills/docs-convention/SKILL.md` を参照すること。

## 前処理で取得したコンテキスト

### 現在のオープン Issue

!`gh issue list --state open --limit 15 2>/dev/null || echo "取得失敗（gh 未認証の可能性）"`

### 登録済みラベル

!`gh label list --limit 30 2>/dev/null || echo "取得失敗"`

## 入力

`$ARGUMENTS` は以下の形式:

- `R2` — フィーチャー名のみ。討論内容から plan.md を構成する
- `R2 "mini.huesを廃止し直接導出方式に変更"` — 概要メモ付き

## 実行手順

### Step 1: 現在の状態を把握する

1. `docs/projects/features/$RX/` 以下の最新バージョン番号を確認する
2. 最新バージョンの `issues.md` があれば読む（次版の plan.md の入力になる）
3. 最新バージョンの `plan.md` と `spec.md` を読み、現行の設計を把握する
4. `README.md` のバージョン履歴テーブルを確認する

### Step 2: 討論内容を整理する

現在の会話コンテキストから以下を抽出する:

- **前版の問題点**: 何がうまくいかなかったか
- **設計方針**: どう解決するか
- **変更対照表**: 前版と新版で何が変わるか

概要メモが引数で渡されている場合はそれも参考にする。
情報が不足している場合はユーザーに確認する。

### Step 3: ファイルを作成する

1. `docs/projects/features/$RX/V{n+1}/` ディレクトリを作成する
2. `plan.md` を作成する。以下の構成で書く:

```markdown
# $RX/V{n+1} タイトル

## なぜ V{n+1} が必要か

前版の問題を記述。issues.md があればそこから引用。
会話コンテキストの討論内容を反映する。

## 前版との変更対照表

| 項目 | V{n} | V{n+1} |
| ---- | ---- | ------ |
| ...  | ...  | ...    |

## 設計方針

討論で決まった核心的なアイデアを記述。

## 変更内容

具体的な変更の詳細。実装の指針になる粒度で書く。
```

3. `spec.md` を作成する。実装前なので以下の最小テンプレートで:

```markdown
# $RX/V{n+1} 仕様

実装後に記述する。
```

### Step 4: README.md を更新する

1. `docs/projects/features/$RX/README.md` のバージョン履歴テーブルに新行を追加する
2. 「現行」のリンクを新バージョンに更新する

### Step 5: 確認

作成したファイルの一覧と plan.md の内容をユーザーに提示し、
修正が必要かどうかを確認する。

### Step 6: GitHub Issue を作成する

ユーザーの確認後、GitHub Issue を作成するか尋ねる。
作成する場合:

1. plan.md の内容から Issue を構成する:
   - **タイトル**: `[RX/V{n+1}] 設計方針のサマリ`
   - **ラベル**: `RX` + `plan`
   - **本文**:
     - plan.md へのリンク
     - 前版の問題（issues.md から引用）
     - 設計方針の要約
     - 実装チェックリスト

2. 前処理で取得した「現在のオープン Issue」と重複しないか確認する

3. `gh issue create` で作成:

```bash
gh issue create \
  --title "[RX/V{n+1}] タイトル" \
  --body "本文" \
  --label "RX,plan"
```

4. 作成された Issue 番号を使ってブランチ名を提案する:

```
feature/RX-V{n+1}-概要-kebab-case
```

## 注意事項

- plan.md は「実装の指示書」として機能する。曖昧な表現を避け、具体的に書く
- 討論で決まっていない部分は「未決定」と明記し、推測で埋めない
- 前バージョンのファイルは一切変更しない
- GitHub Issue の作成は任意。ユーザーが不要と言えばスキップする
- 重複 Issue を作らない。前処理のコンテキストを必ず確認する
