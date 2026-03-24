---
name: plan
description: >
  討論結果を plan.md にまとめ、新バージョンを発行する。
  V ディレクトリ作成 + plan.md + spec.md placeholder + README 更新まで。
  「plan にまとめて」「V を切って」「バージョンを発行」といった文脈で使用。
  事前に /analyze で討論が済んでいることが前提。
disable-model-invocation: true
argument-hint: <RX> [タイトル]
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

- `R2` — フィーチャー名のみ。会話コンテキストから討論結果を取得
- `R2 "tonal palette ベースのカラースキーム生成"` — タイトル付き

## 実行手順

### Step 1: 次バージョン番号を決定する

`docs/projects/features/$0/` 以下の最新バージョン番号(VY)を確認し、V{Y+1} とする。

### Step 2: ファイルを作成する

1. `docs/projects/features/$0/V{Y+1}/` ディレクトリを作成する
2. `plan.md` を作成する:

```markdown
# $0/V{Y+1} タイトル

## なぜ V{Y+1} が必要か

前版の問題を記述。issues.md があればそこから引用。
討論内容を反映する。

## 前版との変更対照表

| 項目 | V{Y} | V{Y+1} |
| ---- | ---- | ------ |
| ...  | ...  | ...    |

## 設計方針

討論で決まった核心的なアイデアを記述。

## 変更内容

具体的な変更の詳細。実装の指針になる粒度で書く。
```

3. `spec.md` を作成する（placeholder）:

```markdown
# $0/V{Y+1} 仕様

実装後に記述する。
```

### Step 3: README.md を更新する

1. `docs/projects/features/$0/README.md` のバージョン履歴テーブルに新行を追加
2. 「現行」のリンクを新バージョンに更新

### Step 4: ユーザーに確認する

作成したファイルの一覧と plan.md の内容を提示し、修正が必要か確認する。

**Issue 作成やブランチ作成が必要な場合は `/create-issue` を案内する。**

## 注意事項

- plan.md は「実装の指示書」。曖昧な表現を避け、具体的に書く
- 討論で決まっていない部分は「未決定」と明記し、推測で埋めない
- 前バージョンのファイルは一切変更しない
- **MVP 期間中は V の発行を最小限にする。横串で繋ぐ作業は V 不要**
