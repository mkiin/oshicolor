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
- **パッケージマネージャー**: pnpm

## 言語

- 変数名・関数名・型名はすべて **英語** で記述する
- **コメントは日本語を許可** する
- ユーザー向けの文字列リソース（UI テキスト等）は日本語・英語の両方を扱う
- コミットメッセージは日本語でも英語でもよい

## コメント・ドキュメンテーション

[TSDoc](https://tsdoc.org/) 形式に従う。

### 公開 API・エクスポート関数

エクスポートされる関数・型・定数には TSDoc コメントを付ける。

```typescript
/**
 * 画像データからドミナントカラーを抽出する
 *
 * @param imageData - Canvas から取得した ImageData
 * @param count - 抽出する色の数（デフォルト: 5）
 * @returns 抽出されたカラーポイントの配列
 */
export const extractColors = (
  imageData: ImageData,
  count = 5,
): ColorPoint[] => {
  // ...
};
```

### インラインコメント

- 「なぜ（Why）」を書く。「何を（What）」はコード自体で表現する
- 自明な処理にはコメントを付けない

```typescript
// Good: 理由を説明
// 明度が極端な色はエディタテーマで使いにくいため除外する
if (brightness < 30 || brightness > 225) continue;

// Bad: コードの繰り返し
// brightness が 30 未満または 225 より大きい場合はスキップ
if (brightness < 30 || brightness > 225) continue;
```

### TODO / FIXME

```typescript
// TODO: ギャラリーのページネーション実装時に対応する
// FIXME: Safari で色が微妙にズレる問題の修正が必要
```

## 命名規則

### 変数・関数

| 対象 | ケース | 例 |
|---|---|---|
| 変数・引数 | camelCase | `themeData`, `colorPoints` |
| 関数 | camelCase | `extractColors`, `generateLua` |
| 定数（イミュータブル値） | UPPER_SNAKE_CASE | `MAX_COLOR_COUNT`, `DEFAULT_PALETTE_SIZE` |
| 環境変数 | UPPER_SNAKE_CASE | `DATABASE_URL`, `CF_BUCKET` |

### boolean

boolean 値には必ずプレフィックスを付ける。

- `is~`: 状態を表す (`isLoading`, `isPublished`)
- `has~`: 所有・存在を表す (`hasError`, `hasUnsavedChanges`)
- `should~`: 条件判定を表す (`shouldRefetch`, `shouldShowPreview`)
- `can~`: 能力・権限を表す (`canEdit`, `canPublish`)

### イベントハンドラ

- **定義側（実装）**: `handle` プレフィックス → `handleClick`, `handleColorChange`
- **Props 側（受け渡し）**: `on` プレフィックス → `onClick`, `onColorChange`

```tsx
// 定義側
function ThemeEditor() {
  const handleColorChange = (color: string) => {
    // ...
  };

  return <ColorPicker onColorChange={handleColorChange} />;
}

// Props 側
type ColorPickerProps = {
  onColorChange: (color: string) => void;
};
```

### 型・コンポーネント

| 対象 | ケース | 例 |
|---|---|---|
| 型 (type) | PascalCase | `ThemeData`, `ColorPoint` |
| React コンポーネント | PascalCase | `ThemeEditor`, `GalleryCard` |
| Props 型 | `~Props` サフィックス | `ThemeEditorProps` |

### ファイル・ディレクトリ

| 対象 | ケース | 例 |
|---|---|---|
| ファイル名 | kebab-case | `theme-editor.tsx`, `color-utils.ts` |
| ディレクトリ名 | kebab-case | `server-functions/`, `ui-components/` |
| テストファイル | `~.test.ts` | `color-utils.test.ts` |
| 型定義ファイル | `~.d.ts` | `env.d.ts` |
| Server Function | `~.functions.ts` | `gallery.functions.ts` |
| サーバー専用ヘルパー | `~.server.ts` | `gallery.server.ts` |

ドット区切りサフィックス（`.test.ts`, `.d.ts`, `.functions.ts`, `.server.ts`）はファイルの種別を示す慣習であり、ケバブケースのルールとは別枠として扱う。ファイル名本体部分はケバブケースを守る（例: `theme-export.functions.ts`）。

## 型定義

- **`type` を基本とする**。`interface` は外部ライブラリの型拡張（declaration merging）が必要な場合のみ使用する
- 型のプレフィックス `I~` や `T~` は付けない

```typescript
// Good
type ThemeData = {
  id: string;
  name: string;
  palette: ColorPoint[];
};

// Bad - interface を不必要に使わない
interface IThemeData {
  id: string;
  name: string;
}
```

## 関数スタイル

### React コンポーネント: function 宣言

```tsx
// Good - function 宣言 + named export
export function GalleryCard({ theme }: GalleryCardProps) {
  return <div>{theme.name}</div>;
}
```

### routes/ 内のコンポーネントはエクスポートしない

`src/routes/` 配下のコンポーネントは Route オブジェクトの `component` プロパティに渡すだけで役目を終えるため、エクスポートしない。

```tsx
// Good - Route 内でのみ使うコンポーネントは非エクスポート
function GalleryPage() {
  const themes = Route.useLoaderData();
  return <ThemeGrid themes={themes} />;
}

export const Route = createFileRoute("/gallery")({
  loader: () => getThemes({ data: { page: 1 } }),
  component: GalleryPage,
});
```

```tsx
// Bad - Route 用コンポーネントを不必要にエクスポートしない
export function GalleryPage() { ... }
```

### それ以外: arrow function

```typescript
// ユーティリティ関数
export const extractColors = (imageData: ImageData): ColorPoint[] => {
  return [];
};

// Server Functions
const getThemes = createServerFn({ method: "GET" })
  .validator((params: { page: number }) => params)
  .handler(async ({ data }) => {
    return [];
  });

// フック内のハンドラ・コールバック
const handleSubmit = () => {
  // ...
};
```

### return スタイル

arrow function では **明示的な return を基本** とする。

```typescript
// Good - 明示的な return
const double = (n: number): number => {
  return n * 2;
};

// Bad - 暗黙の return は使わない
const double = (n: number): number => n * 2;
```

## インポート順序

Biome の `organizeImports` に従う。手動で書く場合は以下の順序を意識する。

```typescript
// 1. Node / Cloudflare ビルトイン
import { env } from "cloudflare:workers";

// 2. 外部ライブラリ
import { useQuery } from "@tanstack/react-query";
import { atom, useAtom } from "jotai";

// 3. プロジェクト内のエイリアスパス（~ は src/ を指す）
import { db } from "~/db";
import { themes } from "~/db/schema";

// 4. 相対パス
import { extractColors } from "../utils/color-extractor";
import type { ColorPoint } from "./types";
```

- `type` のみのインポートには `import type` を使う
- 名前空間インポート (`import * as`) は原則使わない

## ディレクトリ構成

features-based 構成を採用する。機能横断の共通モジュールは `src/` 直下に、各機能固有のモジュールは `src/features/` 配下にまとめる。

```
oshicolor/
├── alchemy.run.ts              # Alchemy IaC 定義
├── wrangler.jsonc               # Cloudflare Workers 設定
├── biome.json                   # Biome 設定
├── drizzle.config.ts            # Drizzle ORM 設定
├── vite.config.ts               # Vite + Cloudflare プラグイン
├── src/
│   ├── routes/                  # TanStack Router ファイルベースルーティング
│   ├── components/              # 機能非依存の共通 UI コンポーネント
│   ├── hooks/                   # 機能非依存の共通フック
│   ├── stores/                  # 共通 Jotai アトム
│   ├── lib/                     # 共通ユーティリティ・ヘルパー
│   ├── types/                   # 共通型定義
│   ├── db/
│   │   ├── schema.ts            # Drizzle スキーマ定義
│   │   └── index.ts             # DB クライアント初期化
│   ├── styles/                  # グローバルスタイル
│   └── features/                # 機能別モジュール
│       └── editor/              # 例: カラーエディタ機能
│           ├── components/
│           ├── hooks/
│           ├── stores/
│           ├── types/
│           ├── editor.functions.ts
│           └── editor.server.ts
├── public/                      # 静的アセット
└── test/                        # テスト
```

### 配置ルール

- **その機能でしか使わないモジュール** → `features/<機能名>/` 配下に置く
- **複数機能から参照されるモジュール** → `src/` 直下の共通ディレクトリに置く
- 各 feature 内のサブディレクトリ（components, hooks, stores, types）は必要に応じて作成する。全 feature で揃える必要はない
- Route ファイル（`src/routes/`）は薄く保ち、loader での Server Function 呼び出しとコンポーネントの配置に留める。ビジネスロジックは feature 側に書く

## Server Functions（RPC 層）

- tRPC は使わない。TanStack Start の `createServerFn` を RPC 層として使用する
- バリデーションには `.validator()` + Zod を使う
- Server Functions は静的インポートが安全（ビルド時に RPC スタブに置換される）。動的インポートは使わない

### ファイル編成

サーバーサイドコードは以下の3種のファイルに分離する。

| サフィックス | 役割 | インポート可能な場所 |
|---|---|---|
| `~.functions.ts` | `createServerFn` のラッパー定義 | どこからでも（クライアント含む） |
| `~.server.ts` | サーバー専用ヘルパー（DB クエリ、内部ロジック） | `.functions.ts` の handler 内のみ |
| `~.ts`（サフィックスなし） | クライアント安全なコード（型、スキーマ、定数） | どこからでも |

```typescript
// src/features/gallery/themes.server.ts - サーバー専用ヘルパー
import { db } from "~/db";
import { themes } from "~/db/schema";
import { desc, eq } from "drizzle-orm";

export const findPublishedThemes = async (page: number) => {
  return db
    .select()
    .from(themes)
    .where(eq(themes.published, true))
    .orderBy(desc(themes.createdAt))
    .limit(20)
    .offset((page - 1) * 20);
};
```

```typescript
// src/features/gallery/themes.functions.ts - Server Function ラッパー
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { findPublishedThemes } from "./themes.server";

export const getThemes = createServerFn({ method: "GET" })
  .validator(z.object({ page: z.number().min(1) }))
  .handler(async ({ data }) => {
    return findPublishedThemes(data.page);
  });
```

### Server Routes

ファイルベースの API エンドポイントが必要な場合は、Route 定義内に `server.handlers` を追加する。Server Functions で十分な場合は不要。

```typescript
// src/routes/api/webhooks.ts
export const Route = createFileRoute("/api/webhooks")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json();
        // webhook 処理
        return Response.json({ ok: true });
      },
    },
  },
});
```

## 状態管理の使い分け

| 種類 | ツール | 用途 |
|---|---|---|
| サーバー状態 | TanStack Query | API データのフェッチ・キャッシュ・再検証 |
| クライアント状態 | Jotai | UI 状態、カラーエディタ、テーマプレビュー設定 |
| URL 状態 | TanStack Router | ページネーション、フィルタ、検索パラメータ |

- サーバーから取得したデータを Jotai アトムにコピーしない。TanStack Query のキャッシュを信頼する
- URL に反映すべき状態（ページ番号、検索条件）は Router の search params を使う

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

### Effective TypeScript 準拠

本プロジェクトは [Effective TypeScript](https://effectivetypescript.com/) の原則に準拠する。

特に以下のモットーを重視する:

> 理想的な TypeScript コードは、関数やメソッドのシグネチャには型アノテーションがあるが、それらの本体のローカル変数にはない。

```typescript
// Good - シグネチャに型、本体は推論に任せる
export const extractColors = (
  imageData: ImageData,
  count: number,
): ColorPoint[] => {
  const pixels = collectPixels(imageData);
  const quantized = quantizeColors(pixels, count);
  const sorted = sortByFrequency(quantized);
  return sorted;
};

// Bad - ローカル変数に冗長な型アノテーション
export const extractColors = (
  imageData: ImageData,
  count: number,
): ColorPoint[] => {
  const pixels: Pixel[] = collectPixels(imageData);
  const quantized: QuantizedColor[] = quantizeColors(pixels, count);
  const sorted: ColorPoint[] = sortByFrequency(quantized);
  return sorted;
};
```

### その他のルール

- `any` 型は原則禁止。やむを得ない場合は `// biome-ignore` + 理由をコメントする
- `as` による型アサーションは最小限にする。型ガードや Zod パースを優先する
- マジックナンバーは定数に切り出す
- 未使用のインポート・変数は Biome が自動で検出する。放置しない
