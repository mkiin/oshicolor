# claude.md - oshicolor プロジェクトルール

## プロジェクト概要

キャラクターイラストからカラーパレットを抽出し、Neovim カラースキームを生成する Web アプリケーション。詳細は `docs/overview.md` を参照する。

## 技術スタック

| カテゴリ             | 採用                       |
| -------------------- | -------------------------- |
| フレームワーク       | TanStack Start (React)     |
| ランタイム           | Cloudflare Workers         |
| DB                   | Cloudflare D1 (SQLite)     |
| ORM                  | Drizzle ORM                |
| ストレージ           | Cloudflare R2              |
| IaC                  | Alchemy                    |
| 非同期状態管理       | TanStack Query             |
| クライアント状態管理 | Jotai                      |
| スタイリング         | Tailwind CSS               |
| バリデーション       | Zod                        |
| フォーマッター       | Oxfmt                      |
| リンター             | Oxlint                     |
| パッケージマネージャー | pnpm                       |
| ビルド / dev         | Vite                       |
| テスト               | Vitest                     |

## 開発ワークフロー

GitHub Issues は使わず、すべてローカルの `docs/issue/` 配下の Markdown で管理する。サーバー同期は行わない。ブラウザを開かずに作業を完結させるためにこの形を取っている。

### Issue の置き場所

- `docs/issue/open/` は実装意思のあるものを置く。今やる issue は frontmatter `sprint:` で表現する
- `docs/issue/idea/` はアイデア段階で実装するか不確かなものを置く
- `docs/issue/done/` は完了アーカイブとする

ファイル名は `<3桁番号>-<kebab-case-title>.md` の形式に統一する。番号は idea / open / done を横断して通し番号で振る。新規作成は `/create-issue` スキルを使う。

### feature のドキュメント

`docs/features/<feature>/spec.md` は今こうなっているという現状の仕様を表す。`docs/features/<feature>/review.md` はアーキテクチャ・アルゴリズム・設計に対する外部レビューのログを表す。spec の生成と更新は `/spec-write`、review の追記は `/review-record` を使う。

### 状態遷移

issue に着手するときは frontmatter `branch:` を埋め、`open/` 内に置いたまま作業する。完了したら `done/` に mv する。アイデアから着手するときは `idea/` から `open/` に mv する。物理的な mv を状態遷移のトリガーにすることで、現在の状態が一目で分かる構造にしている。

## TypeScript の実行・型チェック

- `tsc` コマンドは使わない。型チェックは Oxlint が担う
- Node.js 24 は TypeScript を直接実行できる。`tsx` や `ts-node` も不要
- スクリプト実行は `node scripts/foo.ts` の形で書く

## テスト

- 新機能の実装は `/unit-test` スキルで TDD サイクルを回す。失敗テスト先行が原則で、後付けは許さない
- 実装完了後の最終確認は `/e2e-test` スキルを使う。build と lint と全テストを順に通す

## コミット

- Conventional Commits 形式に従う
- 1 コミット = 1 論理的変更
- コミット作業は `/commit` スキルに任せる。スキルが stat ベースで種別判定とメッセージ生成を行う

## コメント

書かないのを基本とする。書くのは次の場合に限る。

- 隠れた制約や不変条件を伝えるとき
- 直感に反する挙動の理由を残すとき
- 特定バグへの回避策を残すとき
- なぜ自然な別案を採らなかったかという whynot を残すとき

書く場合の制約は次のとおり。

- 1 コメント = 1 行 1 文
- 括弧を本文に含めない
- コードの内容を言い換えるだけのコメントは書かない。たとえば `// x を返す` のような類は不要

## ドキュメントの執筆

`docs/` 以下の Markdown ファイルを新規作成または更新するときは、必ず `/write-sentence` スキルを呼び出してそのルールに従う。体言止めの禁止、見出しの丸カッコの禁止、章冒頭の主張宣言、WHY の明記など、自然な日本語のためのルールが定義されている。

## 外部ライブラリの調査

ライブラリの設計思想やアルゴリズムを調査するときは `/library-research` スキルを使う。結果は `docs/references/<lib>/` 配下に保存する。oshicolor への展開方針まで書くことを必須とする。
