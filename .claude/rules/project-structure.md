---
paths:
  - "src/**/*.{ts,tsx}"
---

# ディレクトリ構成

Feature-based + レイヤー分離のハイブリッド構成。
ファイルを「どの機能に属しているか（ドメイン）」でグループ化し、各グループ内は技術的種別（type-based）で整理する。

## 叫ぶアーキテクチャ

フォルダ構成は「何のアプリか」を伝えるべき。`features/` を見れば「色抽出・テーマ生成・プレビューをするアプリだ」と分かるようにする。

## 全体構成

```
src/
├── core/                  # アプリ全体の基盤処理（初期化・設定・認証）
│   ├── api/               # API クライアント設定
│   ├── auth/              # 認証処理
│   ├── config/            # 環境設定
│   ├── error/             # 共通エラーハンドリング
│   └── store/             # グローバル状態の初期化
│
├── infrastructures/           # 外部リソースへのアクセス（API, DB, IaC）
│   ├── alchemy/               # Cloudflare IaC（alchemy.run.ts）
│   └── db/                    # スキーマ・DB クライアント（Drizzle ORM）
│
├── shared/                # 共通の再利用部品（ドメインを持たない）
│   ├── components/        # 汎用 UI（Button, Modal 等。別プロジェクトでも使える）
│   ├── hooks/             # 汎用フック（useDebounce 等）
│   ├── lib/               # 汎用ユーティリティ（日付、配列操作等）
│   ├── constants/         # 定数
│   └── types/             # 共通型定義
│
├── features/              # 機能単位で分離（内部は type-based）
│   ├── color-extractor/   # 画像から色を抽出する
│   ├── theme-generator/   # 象徴色からカラーテーマを生成する
│   ├── neovim-preview/    # Neovim のプレビューを表示する
│   └── lua-generator/     # Lua カラースキームを出力する
│
├── pages/                 # 複数 features を組み合わせる画面（薄く保つ）
│
├── db/                    # スキーマ・DB クライアント
├── styles/                # グローバルスタイル
└── main.tsx               # エントリーポイント
```

## core / shared / features の責務

| ディレクトリ       | 責務                         | 何を置くか                                                 | 何を置かないか                        |
| ------------------ | ---------------------------- | ---------------------------------------------------------- | ------------------------------------- |
| `core/`            | アプリ全体の基盤             | API クライアント設定、認証、環境設定、グローバル状態初期化 | 機能固有のロジック、UI コンポーネント |
| `shared/`          | 横断的な再利用部品           | 汎用 UI、汎用フック、ユーティリティ、定数、共通型          | ビジネスロジック、機能固有のコード    |
| `features/`        | 機能単位の自己完結モジュール | UI・状態・ロジックを機能ごとにまとめる                     | アプリ全体の基盤処理                  |
| `infrastructures/` | 外部リソースへのアクセス     | DB（Drizzle）、IaC（Alchemy）、外部 API クライアント実装   | ビジネスロジック、UI                  |

### core と shared の違い

- **`core/`**: アプリが起動するために必要なもの。設定・初期化・認証。他の全てが依存する基盤
- **`shared/`**: あると便利な再利用部品。なくてもアプリは起動する。ドメインを知らない純粋な部品

## feature 内の構成（type-based）

各 feature 内は技術的種別で整理する。ロジックと UI を分離し、テストしやすくする。

```
features/<feature>/
├── components/    # この feature 内の UI コンポーネント
├── hooks/         # この feature 内のカスタムフック（状態取得・副作用）
├── usecases/      # アプリケーションロジック（React に依存しない純粋関数。テスト最優先）
├── repositories/  # API 呼び出し・外部リソースアクセス
├── stores/        # この feature 内の状態管理（Jotai atoms 等）
├── types/         # この feature 内の型定義
├── index.ts       # 公開 API（外部はここからのみ import）
```

## ルール

### コロケーション

関連性が高いもの（一緒に変化するもの）は物理的に近くに置く。

- feature 固有のコンポーネント → `features/<feature>/components/`
- feature 固有のロジック → `features/<feature>/logics/`
- feature 固有の型 → `features/<feature>/types/`

### 共通 vs feature の判断基準

「そのコードから文脈を抜いたとき、別プロジェクトでもそのまま使えるか？」

- **YES → `shared/`**（汎用部品。ドメインを知らない）
- **NO → `features/<feature>/`**（機能部品。特定のドメインに紐づく）

複数の feature で使い回す場合でも、特定のドメインに紐づくなら feature 内に置く。

### import の方向

```
pages → features → shared, core
                      ↑
               features 間は一方向を保つ
```

- `pages/` は薄く。features の組み立てのみ
- `features/` は `shared/`, `core/` を import できる
- `shared/`, `core/` は `features/` を import **しない**
- feature 間の import は許可するが、循環依存を作らない

### ファイル命名

ドメインベース。技術的な名前ではなく、何についてのコードかで命名する。

```
# NG
types.ts, utils.ts, helpers.ts

# OK
palette.ts, contrast.ts, neutral-scale.ts
```

### ネスト制限

3〜4 階層まで（React 旧ドキュメント推奨）。

### 公開 API

各 feature は `index.ts` を通じて export する。内部ファイルの直接 import は禁止。

```typescript
// OK
import { ColorHarmonyService } from "@/features/theme-generator";

// NG（内部ファイルを直接 import）
import { ColorHarmonyService } from "@/features/theme-generator/logics/color-harmony";
```
