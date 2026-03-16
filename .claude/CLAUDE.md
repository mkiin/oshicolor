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
- **フォーマッタ / リンター**: Biome
- **パッケージマネージャー**: vite-plus(vp)
- **ツールチェーン**: vite-plus (`vp`)

### vp (vite-plus) の使い方

`vp` は Vite ビルド・テスト・リント・dev server を統合する CLI。バイナリは `~/.vite-plus/bin/vp` にある。

| 用途             | コマンド   |
| ---------------- | ---------- |
| 開発サーバー起動 | `vp dev`   |
| ビルド           | `vp build` |
| テスト           | `vp test`  |
| リント           | `vp lint`  |

### コメント・ドキュメンテーション

[TSDoc](https://tsdoc.org/) 形式に従う。

## 命名規則

- 変数・引数・関数: camelCase（`themeData`, `extractColors`）
- 定数・環境変数: UPPER_SNAKE_CASE（`MAX_COLOR_COUNT`, `DATABASE_URL`）
- 型・コンポーネント: PascalCase（`ThemeData`, `ThemeEditor`）
- Props 型: `~Props` サフィックス（`ThemeEditorProps`）
- ファイル・ディレクトリ: kebab-case（`theme-editor.tsx`, `color-utils/`）
- ファイル種別サフィックス: そのまま（`*.test.ts`, `*.functions.ts`, `*.server.ts`）
- boolean: `is~`（状態）/ `has~`（存在）/ `should~`（条件）/ `can~`（権限）
- イベントハンドラ: 定義側は `handle~`、Props側は `on~`（例: `handleClick` / `onClick`）

## 型定義

- **`type` を基本とする**。`interface` は外部ライブラリの型拡張（declaration merging）が必要な場合のみ使用する
- 型のプレフィックス `I~` や `T~` は付けない

## 関数スタイル

- React コンポーネント: `React.FC<Props>` + arrow function
- それ以外（ユーティリティ・ハンドラ・Server Functions）: arrow function

## ディレクトリ構成

- features-based 構成。機能固有は `src/features/<機能名>/`、共通モジュールは `src/` 直下に置く。
- Route は薄く保つ。ビジネスロジックは feature 側に書く

```bash
src/
├── routes/       # ファイルベースルーティング（薄く保つ）
├── components/   # 共通 UI コンポーネント
├── hooks/        # 共通フック
├── stores/       # 共通 Jotai アトム
├── lib/          # 共通ユーティリティ
├── types/        # 共通型定義
├── db/           # スキーマ・DB クライアント
├── styles/       # グローバルスタイル
└── features/
    └── <feature>/
        ├── components/           # UI コンポーネント
        ├── core/                 # ドメインロジック（ファイルが2つ以上になったら作成）
        ├── <feature>.types.ts    # feature 共通の型定義
        ├── <feature>.atoms.ts    # Jotai atoms
        ├── <feature>.functions.ts
        └── <feature>.server.ts
```

### feature 内のファイル命名規則

- **feature 横断のファイル**: `<機能名>.<種別>.ts`（例: `color-extractor.types.ts`, `color-extractor.atoms.ts`）
- **サブドメイン固有のロジック**: `<サブドメイン名>.ts`（例: `color-axes.ts`）
    - サフィックスなし = そのドメイン概念のコアロジック
    - サブドメインにも型や atoms が必要になった場合は `<サブドメイン名>.<種別>.ts` で拡張する
- ドメインロジックのファイルが **2つ以上** になったら `core/` ディレクトリに格上げする

## 状態管理の使い分け

- サーバー状態: TanStack Query（フェッチ・キャッシュ・再検証）
- クライアント状態: Jotai（UI 状態、エディタ設定）
- URL 状態: TanStack Router（ページネーション、フィルタ）
- サーバーデータを Jotai にコピーしない。TanStack Query のキャッシュを信頼する
- URL に反映すべき状態は Router の search params を使う

## DB / ORM

- Drizzle ORM を使用し、スキーマは `app/db/schema.ts` に定義する
- マイグレーションは `drizzle-kit` で管理する
- 生 SQL は原則使わない（Drizzle の型安全なクエリビルダーを使う）

## エラーハンドリング

- Server Functions 内のエラーは適切な HTTP ステータスコードとメッセージを返す
- クライアント側では TanStack Query の `isError` / `error` を使ってハンドリングする
- 予期しないエラーは TanStack Router の `errorComponent` で捕捉する

## コミット

- コミットメッセージは Conventional Commits に従う
- `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`
- 1 コミット = 1 論理的変更

## その他

- [Effective TypeScript](https://effectivetypescript.com/) 準拠: シグネチャに型アノテーション、本体のローカル変数は型推論に任せる
- `any` 型は原則禁止。やむを得ない場合は `// biome-ignore` + 理由をコメントする
- `as` による型アサーションは最小限にする。型ガードや Zod パースを優先する
- マジックナンバーは定数に切り出す
- 未使用のインポート・変数は Biome が自動で検出する。放置しない
