---
name: refactor-clean
description: >
  dead code 除去・未使用 import 整理・重複コード統合。
  「コードを整理」「dead code を削除」「リファクタリング」といった文脈で使用。
disable-model-invocation: true
argument-hint: "[対象ディレクトリ or ファイル]"
context: fork
agent: refactor-cleaner
allowed-tools: Read, Grep, Glob, Edit, Write, Bash(pnpm *), Bash(oxlint *)
---

# refactor-clean

コードベースのクリーンアップを実行する。

## 対象

`$ARGUMENTS` が指定されていればそのパスを対象に、なければ `src/` 全体を対象にする。

## タスク

1. `pnpm lint` を実行して現在の警告・エラーを把握
2. 未使用の import、変数、関数、型定義を特定・削除
3. 重複コードがあれば共通ユーティリティに統合
4. マジックナンバーがあれば定数に切り出す
5. 変更後に `pnpm lint` と `pnpm build` が通ることを確認
6. 変更したファイル一覧と変更内容のサマリーを報告
