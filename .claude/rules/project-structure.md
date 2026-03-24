---
paths:
  - "src/**/*.{ts,tsx}"
---

# ディレクトリ構成

features-based 構成。機能固有は `src/features/<機能名>/`、共通モジュールは `src/` 直下に置く。
Route は薄く保つ。ビジネスロジックは feature 側に書く。

```
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

## feature 内のファイル命名規則

- **feature 横断のファイル**: `<機能名>.<種別>.ts`（例: `color-extractor.types.ts`, `color-extractor.atoms.ts`）
- **サブドメイン固有のロジック**: `<サブドメイン名>.ts`（例: `color-axes.ts`）
  - サフィックスなし = そのドメイン概念のコアロジック
  - サブドメインにも型や atoms が必要になった場合は `<サブドメイン名>.<種別>.ts` で拡張する
- ドメインロジックのファイルが **2つ以上** になったら `core/` ディレクトリに格上げする
