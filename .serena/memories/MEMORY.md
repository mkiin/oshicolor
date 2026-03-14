# oshicolor プロジェクト

## 概要

キャラクターイラストからカラーパレットを抽出し Neovim カラースキームを生成する Web アプリ。

## 技術スタック

TanStack Start (React) / Cloudflare Workers / D1 / R2 / Drizzle ORM / Jotai / TanStack Query / Tailwind CSS v4 / Zod / Biome / pnpm

## 主要コマンド

- `pnpm dev` — 開発サーバー起動 (alchemy dev)
- `pnpm check` — Biome lint + format 一括チェック
- `pnpm exec tsc --noEmit` — 型チェック
- `pnpm test` — vitest

## 重要なディレクトリ

- `src/features/color-extractor/` — extract-colors ライブラリを使う既存抽出実装
- `src/features/color-extract/` — k-means++ 比較用（新規）
- `src/features/theme-generator/` — Neovim テーマ生成
- `src/routes/index.tsx` — メイン UI

## パス別名

`@/` → `src/`

## 詳細

- [suggested_commands.md](suggested_commands.md)
