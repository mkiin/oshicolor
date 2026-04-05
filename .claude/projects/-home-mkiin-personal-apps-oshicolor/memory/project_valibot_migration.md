---
name: Valibot migration
description: Project is migrating from Zod to Valibot for schema validation
type: project
---

バリデーションライブラリを Zod から Valibot に移行中。
新規コード（palette-generator 等）は Valibot で書く。既存の Zod 使用箇所（env.ts 等）は順次移行。

**Why:** Valibot への移行がプロジェクト方針として決定済み。
**How to apply:** 新規スキーマ定義は必ず Valibot を使う。Zod を新たに追加しない。CLAUDE.md のバリデーション欄もいずれ更新が必要。
