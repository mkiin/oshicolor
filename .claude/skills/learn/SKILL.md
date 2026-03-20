---
name: learn
description: >
  非自明なパターンを手動でスキルとして抽出・保存する。
  「これを覚えて」「パターンを保存」「スキルにして」といった文脈で使用。
disable-model-invocation: true
argument-hint: "[パターンの概要]"
allowed-tools: Read, Write, Glob
---

# learn

現在のセッションで発見した非自明なパターンをスキルとして保存する。

## 保存先

`~/.claude/skills/learned/` 以下に保存。

## 実行手順

### Step 1: パターンを特定する

`$ARGUMENTS` が指定されていればそれを起点に、なければ現在の会話コンテキストから以下を抽出:

- **何が起きたか**: エラー、予期しない動作、ワークアラウンド
- **なぜ起きたか**: 根本原因
- **どう解決したか**: 具体的な修正方法
- **再発条件**: どういう状況で同じ問題が起きるか

### Step 2: スキルファイルを作成する

以下のフォーマットで SKILL.md を作成:

```yaml
---
name: learned-<topic-kebab-case>
description: >
  [1行で何のパターンか説明。Claude が自動で参照できるようにキーワードを含める]
user-invocable: false
---
```

本文:

```markdown
# <パターン名>

## 状況

[どういうときにこのパターンが適用されるか]

## 問題

[何が起きるか]

## 解決策

[具体的な対処法。コード例があれば含める]

## 注意点

[落とし穴や関連する制約]
```

### Step 3: ユーザーに確認する

作成したスキルの内容をプレビュー表示し、保存してよいか確認する。

### Step 4: 保存

確認後、`~/.claude/skills/learned/<topic>/SKILL.md` に保存する。

## 注意事項

- `user-invocable: false` にする（バックグラウンド知識として Claude が自動参照する用途）
- description にはキーワードを豊富に含める（Claude のマッチング精度に影響する）
- 既存の learned スキルと重複しないか `~/.claude/skills/learned/` を確認する
- トリビアルな内容（IDE の使い方など）は保存しない。プロジェクト固有の非自明なパターンのみ
