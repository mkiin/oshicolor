---
title: alchemy 撤去と Workers Builds 利用環境の整備
labels: [refactor]
created: 2026-05-12
branch: refactor/031-remove-alchemy-prepare-workers-builds
---

# alchemy 撤去と Workers Builds 利用環境の整備

## 何をやるか

oshicolor の IaC を alchemy から外し、Cloudflare Workers Builds (GitHub 連携 native CI/CD) で deploy できる土台を整える。具体的には次のとおり。

- `alchemy` 依存をアプリから外す。`package.json` の `alchemy` パッケージ、`deploy` / `destroy` スクリプト、`src/infrastructures/alchemy/` ディレクトリを撤去する
- リモート state store (CloudflareStateStore が指す KV / R2 など) を Cloudflare ダッシュボードで削除する
- 既存の GitHub Actions (`.github/workflows/deploy.yml`) を一旦停止または削除する
- `wrangler.jsonc` を Workers Builds 経由で deploy できる最小構成 (Worker 名、main、compatibility_date、必要な bindings) に整える
- ローカル開発 (`vite dev`) と手元の `wrangler deploy` が動くことを確認する
- `.env.example` から alchemy 関連項目 (`ALCHEMY_PASSWORD`、`ALCHEMY_STATE_TOKEN`) を削除する

このスコープでは Workers Builds の固定 preview URL の整備と、Workers Builds で push 契機の自動 deploy を本番運用に統合する CI/CD 設計は扱わない。別 issue で進める。

## なぜやるか

alchemy のソース調査 (`docs/references/infra/alchemy/workers-builds.md`) により、alchemy は Workers Builds を IaC として宣言・管理する手段を持たないことが確定した。両者は思想的に競合し、並走させると Cloudflare 上のリソースが alchemy state と Workers Builds の双方で二重管理になり、整合性を保てない。oshicolor は PR を作らず手元で merge して push するブランチ戦略を採るため、Workers Builds の自動 build / deploy が運用と相性が良い。alchemy を撤去して Workers Builds に一本化することで、IaC 実行を CI から `alchemy deploy` を呼ぶ間接構造に依存しない形に移行する。

## 完了条件

- [ ] `package.json` から `alchemy` 依存と `deploy` / `destroy` スクリプトが削除されている
- [ ] `src/infrastructures/alchemy/` ディレクトリが repo から消えている
- [ ] `.env.example` から `ALCHEMY_PASSWORD` と `ALCHEMY_STATE_TOKEN` が削除されている
- [ ] Cloudflare 側に残った alchemy state (KV / R2 / D1) が削除されている
- [ ] `.github/workflows/deploy.yml` が無効化または削除されている
- [ ] `wrangler.jsonc` が Workers Builds で deploy できる最小構成 (name、main、compatibility_date) になっている
- [ ] 手元の `wrangler deploy` が成功する
- [ ] `pnpm dev` (vite dev) が動く

## 実装方針

### 設計アプローチ

alchemy の state を生かしたまま `pnpm exec alchemy destroy` を prod と dev の二段階で走らせて Cloudflare 上のリソースをクリーンアップし、その後で code とローカル state を撤去する流れを採る。順序を逆にすると state が孤立して Worker や KV / R2 / D1 を CLI で消せなくなり、ダッシュボードでの手作業に頼ることになるため、destroy 完了を最優先する。最後に `wrangler.jsonc` の `name` を `oshicolor` に揃え、手元から `pnpm exec wrangler deploy` で Worker を新規作成して疎通を確認する。

### 触るファイル

- `src/infrastructures/alchemy/alchemy.run.ts` を削除する
- `src/infrastructures/alchemy/` ディレクトリ全体を削除する
- `.alchemy/` のローカル state ディレクトリを削除する
- `package.json` から `alchemy` 依存、`scripts.deploy`、`scripts.destroy` を取り除く
- `.github/workflows/deploy.yml` を削除する
- `.env.example` から `ALCHEMY_PASSWORD`、`ALCHEMY_STATE_TOKEN`、`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_EMAIL`、`GEMINI_API_KEY` を一旦すべて落とし、wrangler login の案内コメントだけ残す形に書き直す
- `wrangler.jsonc` の `name` を `"tanstack-start-app"` から `"oshicolor"` に変える

### 構造・命名・責務分離

Worker 名を `oshicolor` に統一することで、`workers.dev` サブドメインの固定 URL を `oshicolor.<subdomain>.workers.dev` に揃える。`wrangler.jsonc` を Worker 設定の唯一の真実として扱い、build command と deploy command は本 issue のスコープに含めず Cloudflare ダッシュボードでの設定に委ねる。bindings は現状未使用なので最小構成のまま据え置く。

### 使用ライブラリ

新規追加はしない。既存の `wrangler` と `@cloudflare/vite-plugin` のみで動かし、`alchemy` パッケージは依存と script の両方から外す。

### テスト戦略

自動テストは追加しない。手動確認として `pnpm exec wrangler deploy` が exit 0 で終わること、`oshicolor.<subdomain>.workers.dev` に HTTP 200 が返ること、`pnpm dev` (vite dev) がローカルで起動することの三点を完了条件と照合する。Worker の機能挙動のうち `GEMINI_API_KEY` 依存箇所は本 issue では確認対象外として 030 や後続 issue に委ねる。

## 関連

- 調査レポート: docs/references/infra/alchemy/workers-builds.md
- 後続 issue (別途): Workers Builds の固定 preview URL 整備
- 後続 issue (別途): Workers Builds に push 契機の自動 deploy を統合し main / dev で環境分離する CI/CD 設計
- 影響を受ける既存 issue: docs/issue/open/030-secrets-management-refactor.md (alchemy 前提の secret 設計の見直しが必要になる可能性)
