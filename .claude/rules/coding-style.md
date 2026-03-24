---
paths:
  - "src/**/*.{ts,tsx}"
  - "scripts/**/*.ts"
---

# コーディング規約

## コメント・ドキュメンテーション

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

## TypeScript

- [Effective TypeScript](https://effectivetypescript.com/) 準拠: シグネチャに型アノテーション、本体のローカル変数は型推論に任せる
- `any` 型は原則禁止。やむを得ない場合は `// biome-ignore` + 理由をコメントする
- `as` による型アサーションは最小限にする。型ガードや Zod パースを優先する
- マジックナンバーは定数に切り出す
- 未使用のインポート・変数は Biome が自動で検出する。放置しない

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
