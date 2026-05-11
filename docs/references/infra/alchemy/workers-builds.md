# alchemy における Cloudflare Workers Builds 対応の有無 調査レポート

oshicolor の自動デプロイ環境を設計するため、alchemy が Cloudflare Workers Builds の GitHub 連携 native CI/CD を IaC として宣言・管理できる仕組みを持つかを確認した。結論を断定するために、ローカルにクローンした `library/alchemy/` のソースコードを直接読み、API フィールド名とエンドポイント呼び出しの双方を grep して検証した。

---

## 1. 全体像

alchemy は TypeScript ネイティブな IaC ライブラリで、`alchemy.run.ts` を書いて実行することで Cloudflare をはじめとする外部 API を直接叩き、リソースを Create / Update / Delete する。リソースは memoized async function として表現され、状態はローカルファイルかリモート state store に保存する。デプロイは利用者側の責任で行うことが前提で、典型的には `alchemy deploy --stage <name>` を GitHub Actions などの CI から呼ぶ。

これに対して Cloudflare Workers Builds は逆方向の仕組みで、GitHub または GitLab リポジトリを Cloudflare 側に connect すると、push を契機に Cloudflare のビルダーが build と deploy を実行する。alchemy が「外部から API を叩いてリソースを作る」のに対し、Workers Builds は「Cloudflare 側が VCS を購読して動く」もので、両者のメンタルモデルは交差する。

このレポートでは、alchemy がこの Workers Builds 機能を IaC として宣言できるかという 1 点のみを扱う。

---

## 2. 結論

alchemy は Workers Builds の Git integration を IaC として宣言・管理する手段を持たない。これは現バージョン (`library/alchemy` リポジトリの main 相当) のソースを全件確認した結果から断定できる。

根拠は次の四点である。

### 2.1 Cloudflare provider のリソース一覧に該当項目がない

`library/alchemy/alchemy/src/cloudflare/` には 90 件以上の TypeScript ファイルが並ぶが、Workers Builds に対応するリソース定義は存在しない。実在するファイルは、access 系 (`access-application.ts` ほか)、ai 系 (`ai-search.ts` ほか)、ストレージ系 (`bucket.ts` (R2)、`kv-namespace.ts`、`d1-database.ts`)、Worker 周辺 (`route.ts`、`custom-domain.ts`、`version-metadata.ts`、`secrets-store.ts`)、ネットワーク系 (`tunnel.ts`、`hyperdrive.ts`)、フレームワーク統合 (`astro/`、`tanstack-start/`、`vite/` ほか) などで、`builds.ts`、`workers-builds.ts`、`git-integration.ts`、`github-integration.ts` といった命名のファイルは無い。

ファイル名による初手の判定だけでなく、内容の grep でも裏付けが取れた。`BuildConfig|workers_builds|workersBuilds|builds_v2|/builds/` で検索したところ、cloudflare provider 内のヒットは `auth.ts` の 1 件のみだった。

### 2.2 auth.ts の唯一のヒットは permission scope 列挙にすぎない

`auth.ts` の該当行は次のとおりで、AccountApiToken リソースが選択できる Cloudflare API token の permission scope の文字列リストに `"workers_builds:read"` と `"workers_builds:write"` を含めているだけだった。

```ts
"workers_builds:read":
  "See Cloudflare Workers Builds data such as builds, build configuration, and build logs",
"workers_builds:write":
  "See and change Cloudflare Workers Builds data such as builds, build configuration, and build logs",
```

つまり alchemy が提供しているのは「Workers Builds 用のスコープを持つ API token を発行する」までで、Workers Builds そのものを構成する側ではない。Workers Builds を CI で叩きたい人が token を作る用途に限定される。

### 2.3 Workers Builds API のフィールド名とエンドポイント呼び出しが 0 件

Cloudflare の Workers Builds API は `build_caching`、`build_command`、`build_output_directory`、`build_watch_paths`、`deploy_command`、`root_directory` といった固有のフィールドを持ち、`/accounts/{id}/workers/scripts/{name}/builds` 系のエンドポイントを使う。これらを `library/alchemy/alchemy/src/` 全体で検索したが、いずれもヒットしなかった。実装が水面下で進んでいる兆候も無い。

### 2.4 GitHub provider 側にも該当リソースが無い

`library/alchemy/alchemy/src/github/` には `repository-environment.ts`、`repository-webhook.ts`、`secret.ts`、`comment.ts`、`client.ts` しか無い。Cloudflare 側に repository を connect するリソース、たとえば `cloudflare-git-connection.ts` のようなものは存在しない。Workers Builds の installation は Cloudflare ダッシュボードの GitHub App 認可フローでしか作れないので、API 自体が IaC 化しづらいという事情もある。

---

## 3. alchemy の設計が Workers Builds を持たない理由

alchemy の README と examples を読むと、ライブラリの中心思想が「ユーザーが自分の手でデプロイの実行点を握る」ことに置かれていることが分かる。examples は 20 個以上あるが、いずれも `alchemy.run.ts` を書いて `alchemy deploy` で実行する構成で、Cloudflare のビルダーに何かを委譲する例は一つも無い。

CHANGELOG 内の "CI/CD" 言及も二件あったが、それらは alchemy 自身の CI ワークフロー (GitHub Actions 上で alchemy のテストを回す件と、GitHub Secret Resource を追加した件) であり、Workers Builds とは無関係だった。

WHY をまとめると、alchemy は「IaC の宣言と実行の両方を利用者側に置く」設計で、「VCS push を契機に外部サービスがビルドする」モデルとは思想的に競合する。両者を同時に走らせると、Cloudflare のリソース定義が alchemy state と Workers Builds の双方で管理される二重管理が発生し、整合性を保てない。

---

## 4. oshicolor への展開

oshicolor はすでに alchemy を IaC として採用しており、`alchemy.run.ts` で Worker を宣言し、`.github/workflows/deploy.yml` から `alchemy deploy --stage <name>` を呼ぶ構成になっている。今回の調査結果を踏まえると、Workers Builds への移行は採らないのが正解である。

### 採用方針

| 項目 | 方針 |
| --- | --- |
| CI/CD の実行点 | GitHub Actions (`deploy.yml`) を維持し、Cloudflare 側の Workers Builds は使わない |
| 環境分離 | `alchemy.run.ts` の `--stage` 引数で prod と staging を分岐し、D1 / R2 / KV のリソース ID を stage ごとに差し替える |
| 固定 preview URL | alchemy が Worker 名を `website-dev` のような stage suffix 付きで生成することで `website-dev.<subdomain>.workers.dev` の固定 URL を得る |
| Workers Builds 用 API token | 必要が出てきた場合のみ `AccountApiToken` リソースで `workers_builds:read/write` スコープ付きで発行できる。ただし現状の oshicolor では発行する用途が無い |

この方針を採る理由は二つある。一つ目に、alchemy 経由でない経路で Workers Builds を有効化すると、Cloudflare 上のリソース状態が alchemy state ファイルと食い違い、`alchemy deploy` 実行時に意図せぬ replace や destroy が発生するリスクがある。二つ目に、oshicolor のブランチ戦略は PR を作らず手元で merge して push する流れであり、Workers Builds の PR コメント機能や branch alias preview の恩恵がそもそも乏しい。

### 借りないほうがよいもの

- Workers Builds の dashboard 経由有効化。alchemy state と Cloudflare の実体が二重管理になる
- alchemy の `AccountApiToken` で `workers_builds` スコープを付与する設計。現状の oshicolor では token 発行の用途が無いため、最小権限の観点から外す

---

## 5. 直接読むべきファイル

このレポートの結論を将来再検証したい場合は、次の順で読むと早い。

1. `library/alchemy/alchemy/src/cloudflare/` のファイル一覧 全体構造を眺めてリソース粒度の網羅範囲を掴む
2. `library/alchemy/alchemy/src/cloudflare/auth.ts` `workers_builds` の唯一の出現箇所を確認する
3. `library/alchemy/alchemy/src/github/` の各ファイル GitHub provider が Cloudflare に repo を connect するリソースを持たないことを確認する
4. `library/alchemy/CHANGELOG.md` CI/CD 言及二件が alchemy 自身のワークフロー文脈であることを確認する
5. `library/alchemy/README.md` examples セクションで Workers Builds 連携の例が一つも無いことを確認する

---

## 6. まとめ

alchemy は Cloudflare Workers Builds を IaC として扱う手段を提供していない。理由は思想レベルで、alchemy が「ユーザー側でデプロイを実行する」モデルを採るのに対し、Workers Builds は「Cloudflare 側が build と deploy を担う」モデルだからである。oshicolor では既存の GitHub Actions + alchemy 構成を維持し、環境分離は `alchemy.run.ts` の stage 分岐で実現するのが整合的な選択になる。
