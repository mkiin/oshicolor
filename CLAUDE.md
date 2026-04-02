# claude.md - oshicolor プロジェクトルール

## プロジェクト概要

キャラクターイラストからカラーパレットを抽出し、Neovim カラースキームを生成する Web アプリケーション。

## 技術スタック

- **フレームワーク**: TanStack Start (React)
- **ランタイム**: Cloudflare Workers
- **DB**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM
- **ストレージ**: Cloudflare R2
- **IaC**: Alchemy
- **非同期状態管理**: TanStack Query
- **クライアント状態管理**: Jotai
- **スタイリング**: Tailwind CSS
- **バリデーション**: Zod
- **フォーマッター**: Oxfmt
- **リンター**: Oxlint
- **パッケージマネージャー**: pnpm
- **ビルド / dev**: Vite
- **テスト**: Vitest

## 開発ワークフロー

GitHub × スクラムで運用する。タスク管理は GitHub Issues + Projects（カンバン）で行う。

### スプリント

- **1 週間単位**で回す
- Milestone = スプリント（例: `Sprint 1 (2026/03/24 - 2026/03/30)`）
- スプリントゴールは **1 つだけ**。「〜できる状態にする」で書く
- 1 スプリントに入れる Issue は **3〜5 件**
- 「今週やらないこと」を明示する。これがスクラムの本質

### Issue

- 1 Issue = **1 週間以内に完了できる、1 つの具体的なアウトプット**
- 大きすぎたら分割する。小さすぎたらまとめる
- 完了条件を必ず書く
- ラベルで分類する: `feature` / `bug` / `task` / `refactor` / `research` / `idea`

### カンバン（Projects ボード）

| 列          | 意味       |
| ----------- | ---------- |
| Backlog     | いつかやる |
| This Sprint | 今週やる   |
| In Progress | 作業中     |
| Review      | 確認中     |
| Done        | 完了       |

### ブランチと PR

- Issue ごとにブランチを切る
- PR は Issue に紐づける
- マージしたら Issue を Done に移動

### スプリントの流れ

1. **週の始め**: `/sprint-plan` でバックログを見直し、ゴールと Issue を決める
2. **作業中**:
   - Issue を In Progress に移動
   - 必要なら `/analyze` で現状分析 → `/plan` で設計をまとめる
   - 実装する
   - `/verification-loop` でビルド・lint・テストを通す
   - PR を出して Review に移動
   - マージしたら Done に移動
   - 区切りで `/checkpoint` を残す（中断しても復帰できるように）
3. **週の終わり**: `/sprint-review` で振り返り、次のバックログを整理する

## TypeScript の実行・型チェック

- `tsc` コマンドは使わない。型チェックは `oxlint` が担う
- Node.js 24 は TypeScript を直接実行できる（`node foo.ts` で動く）。`tsx` や `ts-node` も不要
- スクリプト実行: `node scripts/foo.ts`

## コミット

- コミットメッセージは Conventional Commits に従う
- `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`
- 1 コミット = 1 論理的変更
