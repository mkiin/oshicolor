---
name: coding-standards
description: >
  oshicolor のコーディング規約。CLAUDE.md を補強する詳細なパターン集。
  コード編集時、レビュー時、新しいファイル作成時に自動的に参照される。
  「コーディング規約」「命名規則」「パターン」といった文脈で有効。
user-invocable: false
---

# oshicolor コーディング規約（詳細）

CLAUDE.md の規約を補強する。CLAUDE.md と矛盾する場合は CLAUDE.md が優先。

## Feature 実装パターン

### Server Function

```typescript
// src/features/<feature>/<feature>.server.ts
import { createServerFn } from "@tanstack/start";

export const getThemeData = createServerFn({ method: "GET" })
  .validator((input: unknown) => zodSchema.parse(input))
  .handler(async ({ data }) => {
    // DB アクセスなどのサーバーサイドロジック
  });
```

### Jotai Atoms

```typescript
// src/features/<feature>/<feature>.atoms.ts
import { atom } from "jotai";

// primitive atom: UI 状態のみ
export const isEditorOpenAtom = atom(false);

// サーバーデータは TanStack Query で管理。Jotai にコピーしない
```

### コンポーネント

```typescript
// src/features/<feature>/components/theme-editor.tsx
import type React from "react";

type ThemeEditorProps = {
  themeId: string;
  onSave: (data: ThemeData) => void;
};

export const ThemeEditor: React.FC<ThemeEditorProps> = ({ themeId, onSave }) => {
  // handleXxx でイベントハンドラを定義
  const handleSave = () => { /* ... */ };

  return (/* JSX */);
};
```

## インポート順序

1. React / 外部ライブラリ
2. `@/` エイリアス（共通モジュール）
3. 同一 feature 内の相対 import
4. 型 import (`import type`)

## エラーハンドリング

- Server Function: Zod でバリデーション → 適切な HTTP エラーを返す
- クライアント: TanStack Query の `isError` / `error` で捕捉
- 予期しないエラー: TanStack Router の `errorComponent` で捕捉

## 避けるべきパターン

- `any` 型の使用（やむを得ない場合は `// biome-ignore` + 理由）
- `as` による型アサーション（型ガードか Zod パースを優先）
- サーバーデータの Jotai へのコピー
- 1000行を超えるファイル（分割を検討）
- `console.log` の放置（デバッグ後に削除）
- `interface` の使用（declaration merging が必要な場合のみ）
