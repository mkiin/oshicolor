---
name: new-doc-version
description: >
  フィーチャーの次バージョンを発行する。前版の分析→設計選択肢の提示→討論→
  plan.md 作成→GitHub Issue 作成→feature ブランチ作成までを一貫して行う。
  「次のバージョンを切る」「V6を作る」「新しいバージョンを発行」「planをまとめて」
  「今の議論をまとめてドキュメントにして」といった依頼に使うこと。
disable-model-invocation: true
argument-hint: <RX> [概要メモ]
allowed-tools: Read, Grep, Glob, Write, Bash(gh *), Bash(git *), Bash(mkdir *)
---

# new-doc-version

フィーチャーの次バージョンを発行する。
分析→討論→ドキュメント作成→Issue→ブランチまでを1コマンドで完結させる。

## 前提

docs/ の規約は `docs-convention` スキルに従う。
規約が不明な場合は `.claude/skills/docs-convention/SKILL.md` を参照すること。

## 前処理で取得したコンテキスト

### 現在のオープン Issue

!`gh issue list --state open --limit 15 2>/dev/null || echo "取得失敗（gh 未認証の可能性）"`

### 登録済みラベル

!`gh label list --limit 30 2>/dev/null || echo "取得失敗"`

### 現在のブランチ

!`git branch --show-current 2>/dev/null || echo "取得失敗"`

## 入力

`$ARGUMENTS` は以下の形式:

- `R2` — フィーチャー名のみ。前版を分析し選択肢を提示する
- `R2 "mini.huesを廃止し直接導出方式に変更"` — 概要メモ付き（方針が決まっている場合）

## 実行手順

### Step 1: 前版を分析する

1. `docs/projects/features/$0/` 以下の最新バージョン番号(VY)を確認する
2. 最新バージョンの `issues.md` があれば読む
3. 最新バージョンの `plan.md` と `spec.md` を読み、現行の設計を把握する
4. `src/features/` 以下の関連コードを Grep/Glob で特定し、主要な実装を確認する
5. `README.md` のバージョン履歴テーブルを確認する

### Step 1.5: issues.md がなければ生成する

**`docs/projects/features/$0/VY/issues.md` が存在しない場合**のみ実行する。

Step 1 で読んだ docs（plan.md, spec.md）と実装コードの分析結果から、
現バージョンの課題・限界を `issues.md` としてドラフト生成する。

```markdown
# $0/VY Issues

## 判明した課題

| #   | 問題 | 原因・根拠                                            | 重要度          |
| --- | ---- | ----------------------------------------------------- | --------------- |
| 1   | ...  | plan.md の未決定事項 / コード上の制約 / spec との乖離 | High/Medium/Low |

## 限界・トレードオフ

- ...
```

生成後、ユーザーに提示して確認する:

- 追加すべき問題があるか
- 重要度の認識にずれがないか
- 不要な項目はないか

ユーザーの修正を反映した上で `docs/projects/features/$0/VY/issues.md` に保存する。
**これは前バージョンのドキュメント追記であり、唯一の例外的な前版変更である。**

**`issues.md` が既に存在する場合**: そのまま読んで Step 2 に進む。

### Step 2: 設計選択肢を提示する（討論フェーズ）

**概要メモが引数で渡されている場合**:
既に方針が決まっているため、概要メモを軸に整理して Step 3 に進む。

**概要メモがない場合**:
Step 1 + Step 1.5 の分析結果をもとに以下を提示し、ユーザーと討論する:

```markdown
## 前版(VY)の問題分析

| #   | 問題 | コード上の原因            | 重要度          |
| --- | ---- | ------------------------- | --------------- |
| 1   | ...  | `src/features/.../xxx.ts` | High/Medium/Low |

## 設計選択肢

### 案 A: [タイトル]

- 概要: ...
- Pros: ...
- Cons: ...
- 影響ファイル: ...

### 案 B: [タイトル]

- 概要: ...
- Pros: ...
- Cons: ...
- 影響ファイル: ...

## 推奨案

[選択理由]
```

ユーザーの判断を待つ。方針が決まったら Step 3 に進む。

### Step 3: ファイルを作成する

1. `docs/projects/features/$0/V{n+1}/` ディレクトリを作成する
2. `plan.md` を作成する:

```markdown
# $0/V{n+1} タイトル

## なぜ V{n+1} が必要か

前版の問題を記述。issues.md があればそこから引用。
Step 2 の討論内容を反映する。

## 前版との変更対照表

| 項目 | V{n} | V{n+1} |
| ---- | ---- | ------ |
| ...  | ...  | ...    |

## 設計方針

討論で決まった核心的なアイデアを記述。

## 変更内容

具体的な変更の詳細。実装の指針になる粒度で書く。
```

3. `spec.md` を作成する（実装前テンプレート）:

```markdown
# $0/V{n+1} 仕様

実装後に記述する。
```

### Step 4: README.md を更新する

1. `docs/projects/features/$0/README.md` のバージョン履歴テーブルに新行を追加する
2. 「現行」のリンクを新バージョンに更新する

### Step 5: ユーザーに確認する

作成したファイルの一覧と plan.md の内容を提示し、修正が必要か確認する。

### Step 6: GitHub Issue を作成する

1. plan.md の内容から Issue を構成する:
   - **タイトル**: `[RX/V{n+1}] 設計方針のサマリ`
   - **ラベル**: `RX` + `plan`
   - **本文**: plan.md リンク + 前版の問題 + 設計方針要約 + 実装チェックリスト

2. 前処理の「現在のオープン Issue」と重複しないか確認する

3. `gh issue create` で作成:

```bash
gh issue create \
  --title "[RX/V{n+1}] タイトル" \
  --body "本文" \
  --label "RX,plan"
```

### Step 7: feature ブランチを作成する

Issue 番号と plan の内容からブランチを作成する:

```bash
git checkout dev
git pull origin dev
git checkout -b feature/$0-V{n+1}-概要-kebab-case
```

ブランチ名の規則:

- `feature/R2-V6-hct-tone-adjustment` のように kebab-case
- 40文字以内に収める

### Step 8: 完了レポート

以下をまとめて報告する:

```
作成ファイル:
  - docs/projects/features/$0/V{n+1}/plan.md
  - docs/projects/features/$0/V{n+1}/spec.md
  - docs/projects/features/$0/README.md (更新)

GitHub Issue: #XX [タイトル]
ブランチ: feature/$0-V{n+1}-xxx (dev から作成)

次のステップ: plan.md に従って実装を開始してください。
```

## 注意事項

- plan.md は「実装の指示書」として機能する。曖昧な表現を避け、具体的に書く
- 討論で決まっていない部分は「未決定」と明記し、推測で埋めない
- 前バージョンのファイルは一切変更しない
- GitHub Issue / ブランチ作成はユーザーが不要と言えばスキップする
- 重複 Issue を作らない。前処理のコンテキストを必ず確認する
- 深い分析が必要な場合はユーザーに planner subagent の使用を提案する
