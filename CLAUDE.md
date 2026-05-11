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

- `docs/issue/idea/` はアイデア段階で実装するか不確かなものを置く
- `docs/issue/open/` は実装意思あり、次以降の sprint で取り組む候補を置く
- `docs/issue/current/` は今取り組んでいる issue を置く。1〜3 件までを目安にする
- `docs/issue/done/` は完了アーカイブとする

ファイル名は `<3桁番号>-<kebab-case-title>.md` の形式に統一する。番号は idea / open / current / done を横断して通し番号で振る。新規作成は `/create-issue` スキルを使う。

### feature のドキュメント

`docs/features/<feature>/spec.md` は今こうなっているという現状の仕様を表す。`docs/features/<feature>/review.md` はアーキテクチャ・アルゴリズム・設計に対する外部レビューのログを表す。新規 feature や既存 feature の大きな変更に着手する前は `feature-design` skill を経由して spec.md の初版を書く。実装後の現状追従は `/spec-write`、review の追記は `/review-record` を使う。

### 状態遷移

物理的な mv を状態遷移のトリガーにすることで、現在の状態が一目で分かる構造にしている。

- アイデアを採用するときは `idea/<NNN>-*.md` を `open/<NNN>-*.md` に mv する
- 今 sprint に入れるときは `open/<NNN>-*.md` を `current/<NNN>-*.md` に mv する。`current/` は 1〜3 件までを目安にする
- 着手するときは frontmatter `branch:` を埋める
- 完了したら `current/<NNN>-*.md` を `done/<NNN>-*.md` に mv する

新規 Claude セッションで実装を始めるときは、まず `ls docs/issue/current/` を確認して着手対象を特定する。

### ブランチ戦略

main を本番リリースブランチ、dev を統合ブランチとする 2 環境構成にする。PR は作らず手元で merge して push する。

- `main`: push で Cloudflare Workers の production にデプロイされる
- `dev`: `features/*` のマージ先。push で preview (staging) 環境にデプロイされる
- `features/<labels[0]>/<NNN>-<title-kebab>`: 作業ブランチ。issue ごとに切る。ローカル開発とテストはここで完結させる

実装フローは `features/* → dev`（統合確認）→ `dev → main`（リリース）の順で進める。

## TypeScript の実行・型チェック

- `tsc` コマンドは使わない。型チェックは Oxlint が担う
- Node.js 24 は TypeScript を直接実行できる。`tsx` や `ts-node` も不要
- スクリプト実行は `node scripts/foo.ts` の形で書く

## コーディング規約

### 命名

- 変数・関数・引数は camelCase で書く。型とコンポーネントは PascalCase で書く
- Props 型には `~Props` サフィックスを付ける
- 定数と環境変数は UPPER_SNAKE_CASE で書く。ファイルとディレクトリは kebab-case で書く
- boolean は `is~`、`has~`、`should~`、`can~` のいずれかで始める
- イベントハンドラは定義側を `handle~`、Props 側を `on~` にする。たとえば `handleClick` を `onClick={...}` で渡す
- ファイル種別のサフィックスとして `*.test.ts`、`*.functions.ts`、`*.server.ts` はそのまま使う

### 型定義

- `type` を基本とする。`interface` は declaration merging が必要なときか、Port の契約を定義するときに限る
- `any` は原則禁止。やむを得ない場合は `// oxlint-disable` と理由をコメントする
- `as` による型アサーションは最小限にとどめる。型ガードか Zod parse を優先する
- マジックナンバーは定数に切り出す
- 型のプレフィックス `I~` や `T~` は付けない

### 関数スタイル

React コンポーネントは `React.FC<Props>` を使い arrow function で書く。それ以外のユーティリティやハンドラも arrow function で書く。

### 状態管理

- サーバー状態は TanStack Query が扱う
- クライアント状態は Jotai が扱う
- URL に反映すべき状態は TanStack Router の search params で扱う
- サーバーデータを Jotai にコピーしない。TanStack Query のキャッシュを信頼する

## ディレクトリ構成

Feature-based とレイヤー分離を組み合わせた構成にする。`src/features/` の中身を見るだけで「何をするアプリか」が伝わる状態を保つ。

```
src/
├── core/             # 起動に必要な基盤。API クライアント、認証、設定、グローバル状態の初期化
├── infrastructures/  # 外部リソースへのアクセス。DB、IaC、外部 API
├── shared/           # 汎用部品。ドメインを持たない
├── features/         # 機能単位の自己完結モジュール
│   └── <feature>/
│       ├── components/
│       ├── hooks/
│       ├── usecases/    # React に依存しない純粋関数。テスト最優先
│       ├── repositories/
│       ├── stores/
│       ├── types/
│       └── index.ts     # 公開 API。外部はここからのみ import する
├── pages/            # features を組み立てる薄い層
├── db/, styles/, main.tsx
```

### import の方向

`pages → features → shared, core` の一方向を保つ。`shared/` と `core/` から `features/` を import しない。feature 同士の import は許可するが、循環依存は作らない。

### feature の公開 API

各 feature は `index.ts` から export する。内部ファイルへの直接 import は禁止する。

```typescript
// OK
import { extractPalette } from "@/features/color-extract";

// NG
import { extractPalette } from "@/features/color-extract/usecases/kmeans-extractor";
```

### shared と features の判断

「そのコードから文脈を抜いて、別プロジェクトでもそのまま使えるか」で決める。Yes なら `shared/` に置き、No なら `features/<feature>/` に置く。複数 feature で使い回す場合でも、特定のドメインに紐づくなら feature 内に置く。

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
