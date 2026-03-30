---
name: plan
description: >
  討論結果を plan.md にまとめ、新バージョンを発行する。
  V ディレクトリ作成 + plan.md + spec.md placeholder まで。
  「plan にまとめて」「V を切って」「バージョンを発行」といった文脈で使用。
  事前に /analyze で討論が済んでいることが前提。
disable-model-invocation: true
argument-hint: <MVP-X/ステップ名> [タイトル]
allowed-tools: Read, Glob, Write
---

# plan

討論結果を plan.md にまとめ、新バージョンを発行する。
**事前に `/analyze` で分析・討論が済んでいることが前提。**

## 前提

- docs/ の規約は `docs-convention` スキルに従う
- `/analyze` の討論結果が会話コンテキストにあること

## 入力

`$ARGUMENTS` は以下の形式:

- `MVP-1/ai-vision` — ステップ名のみ。会話コンテキストから討論結果を取得
- `MVP-1/ai-vision "パーツラベリングの精度改善"` — タイトル付き

## 実行手順

### Step 1: 次バージョン番号を決定する

`docs/projects/features/pipeline-v2/$0/` 以下の最新バージョン番号(VXX)を確認し、V{XX+1} とする。
バージョンが存在しない場合は V01 とする。

### Step 2: ファイルを作成する

1. `docs/projects/features/pipeline-v2/$0/V{XX+1}/` ディレクトリを作成する
2. `plan.md` を作成する:

```markdown
# MVP-X/<ステップ名>/V{XX+1} タイトル

## なぜ V{XX+1} が必要か

前版の問題を記述。issues.md があればそこから引用。
討論内容を反映する。

## 前版との変更対照表

| 項目 | V{XX} | V{XX+1} |
| ---- | ----- | ------- |
| ...  | ...   | ...     |

## 設計方針

討論で決まった核心的なアイデアを記述。

## 変更内容

具体的な変更の詳細。
```

3. `spec.md` を作成する（placeholder）:

```markdown
# MVP-X/<ステップ名>/V{XX+1} 仕様

実装後に記述する。
```

### Step 3: ユーザーに確認する

作成したファイルの一覧と plan.md の内容を提示し、修正が必要か確認する。

**Issue 作成やブランチ作成が必要な場合は `/create-issue` を案内する。**

## 注意事項

- plan.md は「実装の指示書」。曖昧な表現を避け、具体的に書く
- 討論で決まっていない部分は「未決定」と明記し、推測で埋めない
- 前バージョンのファイルは一切変更しない
