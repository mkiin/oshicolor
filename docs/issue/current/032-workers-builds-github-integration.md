---
title: Workers Builds で GitHub 連携と push 契機の自動デプロイを整備
labels: [refactor]
created: 2026-05-12
branch: refactor/032-workers-builds-github-integration
---

# Workers Builds で GitHub 連携と push 契機の自動デプロイを整備

## 何をやるか

031 で alchemy を撤去し手元 `wrangler deploy` で `oshicolor` Worker を deploy できる状態を作った土台の上に、Cloudflare Workers Builds の GitHub 連携を載せて push 契機の自動デプロイを復活させる。具体的には次のとおり。

- Cloudflare dashboard で Workers Builds 用の GitHub App を oshicolor repo に対してインストールする
- user-scoped API token を発行する。Builds API は account-scoped token を受け付けないため
- `oshicolor` Worker を oshicolor repo に connect する
- production trigger (main への push、deploy command = `npx wrangler deploy`) を作成する
- preview trigger (main 以外への push、deploy command = `npx wrangler versions upload`) を作成する
- main push で `oshicolor.<subdomain>.workers.dev` が更新されること、dev push で `dev-oshicolor.<subdomain>.workers.dev` の固定 preview URL が発行されることを実機で確認する
- 設定再現性のため `scripts/setup-workers-builds.sh` を curl ベースで script 化することを検討する。GitHub App インストールと user-scoped token 発行だけは dashboard 必須なので、README に手順を残す

現状の oshicolor は永続化リソース (D1 / R2 / KV) を持たないため、preview と production で Worker を分ける必要は無い。同じ `oshicolor` Worker の version を切り替える形 (`wrangler versions upload`) で preview URL を持たせる。将来 D1 等を導入するときに、その issue で Wrangler Environments による分離の要否を改めて判断する。

## なぜやるか

031 で自動デプロイは外れたままになっており、リリースは手元 `wrangler deploy` の手動運用に依存している。oshicolor のブランチ戦略は PR を作らず手元で merge して push する形なので、Workers Builds の push 契機自動デプロイと branch alias preview URL が運用に最も合致する。preview URL を固定形式 (`<branch>-<worker>.<subdomain>.workers.dev`) で持つことで、動作確認用の URL を覚えやすくし、共有時の摩擦を減らす。CLI スクリプト化することで、別 Worker (将来の 033 環境分離) や別アカウントでも同じ手順を再現できる。

## 完了条件

- [ ] Cloudflare dashboard で Cloudflare GitHub App が oshicolor repo にインストール済み
- [ ] user-scoped API token が発行されている (権限は `Workers Builds Configuration: Edit` と `Workers Scripts: Read`)
- [ ] `oshicolor` Worker が oshicolor repo に connect されている
- [ ] production trigger (`branch_includes: ["main"]`、`deploy_command: "npx wrangler deploy"`、`build_command: "pnpm build"`) が登録されている
- [ ] preview trigger (`branch_includes: ["*"]`、`branch_excludes: ["main"]`、`deploy_command: "npx wrangler versions upload"`、`build_command: "pnpm build"`) が登録されている
- [ ] main への push で `oshicolor.<subdomain>.workers.dev` が新しいバージョンに更新されることを実機確認した
- [ ] dev への push で `dev-oshicolor.<subdomain>.workers.dev` が発行され HTTP 200 が返ることを実機確認した
- [ ] 設定手順が README または `docs/infra/` 配下に残されている (curl コマンド or `scripts/setup-workers-builds.sh`)

## 実装方針

### 設計アプローチ

Cloudflare ダッシュボード UI を使用して GitHub App インストール、API token 発行、Worker 接続、trigger 設定を行う。ダッシュボード操作後、セットアップ手順を `docs/infra/setup-workers-builds.md` に記録するか、curl ベースの `scripts/setup-workers-builds.sh` で自動化を検討する。GitHub App インストールと user-scoped token 発行はダッシュボード必須のため、スクリプト化の対象外とする。main / dev への push で動作確認し、production / preview URL が HTTP 200 で応答することを検証する。

### 触るファイル

- `docs/infra/setup-workers-builds.md` 新規作成（セットアップ手順記載）
- `scripts/setup-workers-builds.sh` 新規作成（オプション：API trigger 登録の自動化スクリプト）
- `wrangler.jsonc` 確認のみ（031 で既に整備済み）

### 構造・命名・責務分離

Worker 名を `oshicolor` で統一し、production URL は `oshicolor.<subdomain>.workers.dev`、preview URL は `<branch>-oshicolor.<subdomain>.workers.dev` の固定形式で管理する。build command は `pnpm build`、production deploy は `npx wrangler deploy`、preview deploy は `npx wrangler versions upload` に統一し、Cloudflare ダッシュボードの trigger 設定で参照させる。

### 使用ライブラリ

新規追加なし。既存の `wrangler` CLI と `curl` / `jq` を活用。`scripts/setup-workers-builds.sh` を書く場合は curl で Cloudflare Workers Builds API を呼び出す形式を採用。

### テスト戦略

自動テストなし。手動確認として以下を実施: (1) main push で `oshicolor.<subdomain>.workers.dev` が HTTP 200 を返し、新しいバージョンに更新されていることを確認。(2) dev push で `dev-oshicolor.<subdomain>.workers.dev` が HTTP 200 を返し、固定 preview URL が発行されていることを確認。(3) Cloudflare ダッシュボードで production / preview trigger が正しく登録されていることを確認。

## 関連

- 依存: docs/issue/done/031-remove-alchemy-prepare-workers-builds.md
- 関連: docs/issue/current/028-purge-ai-vision-code.md (028 完了で GEMINI_API_KEY 参照コード自体が消える。Worker secret 整備が 032 内で不要な理由)
- 参考: docs/references/infra/alchemy/workers-builds.md (alchemy が Workers Builds を扱えなかった調査記録)
- 参考: Cloudflare Workers Builds API reference (https://developers.cloudflare.com/workers/ci-cd/builds/api-reference/)
