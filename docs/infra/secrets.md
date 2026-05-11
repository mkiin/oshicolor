---
topic: secrets-management
status: planned
last-updated: 2026-05-07
---

# 環境変数とシークレットの安全な管理

GitHub Actions と Cloudflare Workers 周辺で扱っているシークレットの管理方針をまとめる。最近の GitHub 周辺のサプライチェーン攻撃と Actions のシークレット漏洩事例を踏まえ、Cloudflare と alchemy のエコシステムを最大限活用して、GitHub に置く秘密情報を最小化することを目的にする。

## 保管先の 4 線分離

12 ファクターの原則に沿って、値の種類ごとに保管先を完全に分離する。.env はローカル開発専用にし、GitHub には deploy 用 credential しか置かず、Worker のランタイムが使うシークレットは Cloudflare Secrets Store に置く。この線引きを守ることで、本番で動く Worker が読むシークレットは GitHub Actions のログにも CI 環境にも一度も流れない構造になる。

| 種別 | 保管先 | 例 |
| --- | --- | --- |
| ローカル開発でだけ必要な設定 | `.env` (gitignore 対象) | 開発用テストキー、ローカル DB の URL |
| 公開可能な識別子 | GitHub Repository Variables | CLOUDFLARE_ACCOUNT_ID、CLOUDFLARE_EMAIL |
| ビルド時シークレット | GitHub Environment Secret | CLOUDFLARE_API_TOKEN、ALCHEMY_PASSWORD、ALCHEMY_STATE_TOKEN |
| ランタイムシークレット | Cloudflare Secrets Store | 外部 API キー (将来追加) |

`.env` は production の secret 注入経路ではない。あくまでローカル開発者が手元の `.env` を作るための雛形としての役割しか持たせない。

## まず分類する

「シークレット」と一括りに扱っていたものを、性質ごとに分けて整理する。何が秘密で何が秘密でないかを切り分けないと、対策の優先順位が立たない。

### 識別子

公開しても困らない、単なる宛先情報。Cloudflare ダッシュボードを見れば誰でも分かる程度の情報なので、GitHub Repository Secrets に置く必要はない。

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_EMAIL`

これらは Repository **Variables** に移すか、deploy.yml の `env:` に直書きしてもよい。秘密扱いから外すことで、漏洩リスクの議論から完全に外せる。

### ビルド時シークレット

GitHub Actions の deploy step だけで使う秘密情報で、Worker のランタイムには関係ない。

- `CLOUDFLARE_API_TOKEN`: alchemy が Cloudflare API を呼ぶ鍵
- `ALCHEMY_PASSWORD`: alchemy state を暗号化するパスフレーズ
- `ALCHEMY_STATE_TOKEN`: Cloudflare State Store にアクセスするトークン

これらは GitHub Environment Secrets として保持する必要がある。代わりに最小権限と有効期限で守る。将来 OIDC が使えるようになれば、これらも GitHub から外せる可能性がある。

### ランタイムシークレット

現状は GEMINI_API_KEY の削除でゼロになる。将来、Worker から外部 API を叩く場面が出てきたら、ここに分類されるシークレットが増える。

これらは GitHub Actions の env には絶対に載せない。alchemy の `SecretRef` リソースで Cloudflare Secrets Store の secret を名前だけ参照する。secret の値は人間が Cloudflare ダッシュボードか `wrangler secret put` で直接登録するため、GitHub には一度も値が乗らない構造にできる。

### 不要になったもの

- `GEMINI_API_KEY`: wallust 路線への方針転換で完全に不要

## 既存トークンの棚卸し

| 名前 | 種別 | 現状 | 目指す状態 |
| --- | --- | --- | --- |
| GEMINI_API_KEY | 不要 | Repository Secret | 削除 |
| CLOUDFLARE_ACCOUNT_ID | 識別子 | Repository Secret | Repository Variables へ |
| CLOUDFLARE_EMAIL | 識別子 | Repository Secret | Repository Variables へ |
| CLOUDFLARE_API_TOKEN | ビルド時 | Repository Secret、広い権限、無期限 | Environment Secret、最小権限、期限あり |
| ALCHEMY_PASSWORD | ビルド時 | Repository Secret | Environment Secret、定期ローテーション検討 |
| ALCHEMY_STATE_TOKEN | ビルド時 | Repository Secret | Environment Secret、Cloudflare 側で権限最小化 |

## 個別の変更内容

### deploy.yml

GEMINI_API_KEY の行を削除する。ACCOUNT_ID と EMAIL を `secrets` から `vars` に変える。すべての `uses:` を 40 文字 commit SHA で pin し、横にバージョン文字列をコメントで残す。`environment:` キーで prod と dev を切り替え、prod のみ承認ゲートを通る構造にする。

```yaml
name: Deploy

on:
  push:
    branches: [main, dev]

env:
  STAGE: ${{ github.ref_name == 'main' && 'prod' || github.ref_name }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ github.ref_name == 'main' && 'prod' || 'dev' }}
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@<40char-sha>  # v4.x.x
      - uses: pnpm/action-setup@<40char-sha>  # v4.x.x
      - uses: actions/setup-node@<40char-sha>  # v4.x.x
        with:
          node-version: "24"
          cache: pnpm
      - run: pnpm install
      - run: pnpm exec alchemy deploy ./src/infrastructures/alchemy/alchemy.run.ts --stage ${{ env.STAGE }} --adopt
        env:
          CLOUDFLARE_ACCOUNT_ID: ${{ vars.CLOUDFLARE_ACCOUNT_ID }}
          CLOUDFLARE_EMAIL: ${{ vars.CLOUDFLARE_EMAIL }}
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          ALCHEMY_PASSWORD: ${{ secrets.ALCHEMY_PASSWORD }}
          ALCHEMY_STATE_TOKEN: ${{ secrets.ALCHEMY_STATE_TOKEN }}
```

### alchemy.run.ts

GEMINI_API_KEY の binding を削除する。空文字フォールバックは構造的に危険なため、bindings を空にする。ランタイムシークレットを追加する場合のパターンは、本 spec 後段の「ランタイムシークレットの導入パターン」節を参照する。

```typescript
import alchemy from "alchemy";
import { TanStackStart } from "alchemy/cloudflare";
import { CloudflareStateStore } from "alchemy/state";

const app = await alchemy("oshicolor", {
  stateStore: process.env.CI
    ? (scope) => new CloudflareStateStore(scope)
    : undefined,
});

export const worker = await TanStackStart("website", {
  build: { command: "vite build" },
  bindings: {},
});

// oxlint-disable-next-line no-console -- デプロイ URL の出力
console.log({ url: worker.url });

await app.finalize();
```

### .env.example

GEMINI_API_KEY を削除する。ACCOUNT_ID と EMAIL の節には「秘密ではないので Variables に登録する」旨を注釈で残す。CLOUDFLARE_API_TOKEN のコメントを最小権限の案内に書き換える。具体的に必要な権限は次のとおりで、ローカル開発時はこれより広い権限を持っていても問題ない。

- Workers Scripts Edit
- Workers Routes Edit
- R2 Read/Write を使う場合のみ
- D1 Edit を使う場合のみ
- Account Read

`.env` には本番で使う値を書かない。`.env.example` はあくまでローカル開発者が手元の `.env` を作るときの雛形である。

### CLOUDFLARE_API_TOKEN の再発行

既存トークンを Cloudflare ダッシュボードで revoke する。新規発行時には次を設定する。

- 権限: 上記の最小権限のみ
- 有効期限: 6 か月程度に区切り、期限切れで自動失効させる
- Client IP Address Filtering: GitHub Actions の IP レンジは広いため CI 用には設定しない。個人開発機向けに発行する別トークンには自宅 IP を入れる

新トークンは GitHub の Environment Secret に登録する。

### GitHub Environments のセットアップ

リポジトリ設定の Environments で `prod` と `dev` を作る。

- `prod`: Required reviewers にオーナーアカウントを設定する
- `dev`: 承認なし

既存の Repository Secret のうち、ビルド時シークレット 3 件を、prod と dev それぞれの Environment Secret に複製する。値が同じで構わないが、構造を分離しておくことで将来 prod だけ別の token に切り替えるときの摩擦が無くなる。

Repository Secret は最終的に空にする。

### Repository Variables のセットアップ

リポジトリ設定の Variables で `CLOUDFLARE_ACCOUNT_ID` と `CLOUDFLARE_EMAIL` を登録する。これらは秘密ではないため、ログに出てもよい。Repository レベルでよく、Environment 分けは不要。

## ランタイムシークレットの導入パターン

今後 Worker から外部 API を叩く場面が出たときは、GitHub Actions の env に秘密を追加するのではなく、Cloudflare Secrets Store に置く方式を取る。alchemy 側は `SecretRef` で名前を参照するだけにして、値そのものは GitHub に一度も渡らないようにする。

### 値の登録は人間がやる

Cloudflare ダッシュボードで Secrets Store に secret を登録するか、`wrangler secret put` で CLI から登録する。たとえば `STRIPE_API_KEY` を登録するときは、Cloudflare の Worker & Pages → Secrets Store → Add secret から入力する。この瞬間に値は Cloudflare に保存され、それ以降は人間も含めて UI 経由でしか取り出せない。

prod と dev で値を分けたい場合は、`STRIPE_API_KEY_PROD` と `STRIPE_API_KEY_DEV` のように名前を分けて登録する。alchemy.run.ts 側で stage を見て参照名を切り替える。

### alchemy.run.ts での参照

```typescript
import { SecretRef, TanStackStart } from "alchemy/cloudflare";

const stage = process.env.STAGE ?? "dev";

const stripeKey = await SecretRef({ name: `STRIPE_API_KEY_${stage.toUpperCase()}` });

export const worker = await TanStackStart("website", {
  build: { command: "vite build" },
  bindings: {
    STRIPE_KEY: stripeKey,
  },
});
```

deploy 時に GitHub Actions からは `STAGE` 変数しか渡ってこない。`STRIPE_API_KEY_PROD` という名前を解決するだけで、値そのものは Cloudflare 側にしか存在しない。

### Worker のランタイム側

```typescript
async fetch(request, env: typeof worker.Env) {
  const apiKey = await env.STRIPE_KEY.get();
  // ...
}
```

`env.STRIPE_KEY.get()` は Promise を返す。テストでモックする場合は同期的な値返しにしないよう注意する。

### この方式の利点

- 値が Cloudflare 側にだけ保管されるため、GitHub Actions のログや state にも CI 環境にも一切値が流れない
- secret のローテーションが Cloudflare ダッシュボードだけで完結する。GitHub Environment Secret の更新を伴わない
- 別 Worker や別 service から同じ secret を参照したくなったとき、`SecretRef` で名前を共有するだけで済む

### なぜ Secret ではなく SecretRef を選ぶか

alchemy の `Secret` リソースは「alchemy が値を作成・更新する」セマンティクスを持つ。これを使うと alchemy が `process.env.STRIPE_API_KEY` を読み、その値を Cloudflare に書き込む構造になるため、deploy 時に GitHub Actions の env に値を載せる必要が出てくる。`SecretRef` は「すでに存在する secret を名前で参照する」セマンティクスなので、alchemy 経由で値が流れない。GitHub に値を渡さない原則を守るためには `SecretRef` 側が正解になる。

## 完了の判断基準

- GEMINI_API_KEY がすべての箇所から消えている
- CLOUDFLARE_ACCOUNT_ID と CLOUDFLARE_EMAIL が Repository Variables に移っている
- CLOUDFLARE_API_TOKEN が最小権限と有効期限ありで再発行され、Environment Secret に登録されている
- ALCHEMY_PASSWORD と ALCHEMY_STATE_TOKEN が Environment Secret に移っている
- Repository Secret が空になっている
- deploy.yml の全 `uses:` 行が 40 文字 commit SHA で pin されている
- GitHub Environments の prod に Required reviewers が設定されている
- prod へのデプロイが承認ゲートで一度止まることを実機で確認している
- alchemy.run.ts に bindings が空の状態で deploy が通る

## 中期対応

このスペックの即時対応では扱わず、別 issue として切り出すスコープを列挙する。

- **OIDC への移行**: Cloudflare は Workers と Pages について OIDC 連携を提供しているが、alchemy 経由でこれを使えるかは未確認。`/library-research` で alchemy 側の対応を調査してから判断する。OIDC が使えれば、CLOUDFLARE_API_TOKEN を GitHub から外せる可能性がある
- **AccountApiToken による自動発行**: alchemy の `AccountApiToken` リソースを使い、deploy 用トークンを Cloudflare 側で自動管理する仕組みに移行する。chicken/egg 問題があるため、初期トークンの発行と運用フローの設計が必要
- **GitHub Secret Scanning と Push Protection の有効化**: リポジトリ設定から有効化する
- **Cloudflare 側の audit log と alert**: 不審な API 呼び出しを検知できるようにする
- **ALCHEMY_PASSWORD の定期ローテーション**: state 再暗号化の手順を含めて運用 runbook を作る
- **ランタイムシークレット登録の runbook 整備**: Cloudflare ダッシュボード経由で secret を登録する手順、命名規則、prod と dev での値分離方針を runbook にまとめる。初めて runtime secret を導入するときに参照できる状態にする
