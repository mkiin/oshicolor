---
title: 環境変数とシークレットの安全な管理
labels: [refactor]
created: 2026-05-07
branch:
---

# 環境変数とシークレットの安全な管理

## 何をやるか

GitHub Actions と alchemy 周辺のシークレット管理を見直し、Cloudflare と alchemy のエコシステムを活用して GitHub に置く秘密情報を最小化する。実装案は `docs/infra/secrets.md` を参照する。具体的な作業項目は次のとおり。

- deploy.yml と alchemy.run.ts と .env.example から GEMINI_API_KEY を削除する
- CLOUDFLARE_ACCOUNT_ID と CLOUDFLARE_EMAIL を Repository Secrets から Repository Variables に移す。これらは識別子であり秘密ではない
- CLOUDFLARE_API_TOKEN を Cloudflare ダッシュボードで revoke し、最小権限と 6 か月程度の有効期限を持つ新トークンを発行して Environment Secret に登録する
- ALCHEMY_PASSWORD と ALCHEMY_STATE_TOKEN を Environment Secret に移行する
- deploy.yml の全 `uses:` を 40 文字 commit SHA で pin する。横にバージョン文字列をコメントで残す
- GitHub Environments の prod と dev を作成し、prod に Required reviewers を設定する
- .env.example のコメントを最小権限案内に書き換える

## なぜやるか

最近の GitHub 周辺のサプライチェーン攻撃と Actions のシークレット漏洩事例を踏まえ、長寿命トークンの拡散と tag 参照型の action 依存を整理する必要がある。alchemy が提供する `Secret`、`AccountApiToken`、Cloudflare Secrets Store のエコシステムを使えば、ランタイムシークレットを GitHub に置かない構造に持っていける。今回はその基礎固めとして、識別子とビルド時シークレットの分類整理、最小権限トークンへの差し替え、prod 環境の承認ゲート設定までを扱う。

## 完了条件

- [ ] GEMINI_API_KEY がすべての箇所から消えている
- [ ] CLOUDFLARE_ACCOUNT_ID と CLOUDFLARE_EMAIL が Repository Variables に移っている
- [ ] CLOUDFLARE_API_TOKEN が最小権限と有効期限ありで再発行され、Environment Secret に登録されている
- [ ] ALCHEMY_PASSWORD と ALCHEMY_STATE_TOKEN が Environment Secret に移っている
- [ ] Repository Secret が空になっている
- [ ] deploy.yml の全 `uses:` 行が 40 文字 commit SHA で pin されている
- [ ] prod に Required reviewers が設定されている
- [ ] prod へのデプロイが承認ゲートで一度止まることを実機で確認している

## 関連

- 実装案: docs/infra/secrets.md
- 将来の参考: 同 spec 末尾の「将来のランタイムシークレット導入パターン」節
- 中期対応として別 issue 化する候補: OIDC 移行、AccountApiToken による自動発行、Secret Scanning、Cloudflare audit log、ALCHEMY_PASSWORD 定期ローテーション
