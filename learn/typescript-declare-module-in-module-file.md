# TypeScript: モジュールファイル内の `declare module` は機能しない

## 問題

型定義のないサードパーティパッケージに対して `declare module` を書いたのに、エラーが消えない。

```typescript
// src/types/env.d.ts
import type { worker } from "../alchemy.run.ts"; // importがある

export type CloudflareEnv = typeof worker.Env;

declare module "@robzzson/silhouette" {
    // ← 効かない
    export default function silhouette(
        data: number[][],
        labels: number[],
    ): number;
}
```

```
Could not find a declaration file for module '@robzzson/silhouette'.
implicitly has an 'any' type. ts(7016)
```

## 原因

TypeScript のファイルは2種類に分類される。

| 種類                   | 条件                       | `declare module` の扱い                          |
| ---------------------- | -------------------------- | ------------------------------------------------ |
| **スクリプトファイル** | `import` / `export` がない | グローバルなアンビエント宣言として機能する       |
| **モジュールファイル** | `import` / `export` がある | 既存モジュールへの augmentation として解釈される |

`env.d.ts` は `import type { worker }` と `export type CloudflareEnv` があるため**モジュールファイル**として扱われる。モジュールファイル内の `declare module 'X'` は「既存の型定義を拡張する augmentation」として解釈されるため、型定義が存在しない `@robzzson/silhouette` には適用されない。

## 解決: `import` / `export` を持たない独立した `.d.ts` に分離する

```typescript
// src/types/vendor.d.ts（importなし = スクリプトファイル）
declare module "@robzzson/silhouette" {
    export default function silhouette(
        data: number[][],
        labels: number[],
    ): number;
}
```

`tsconfig.json` の `include` に `src/**/*.ts` が含まれていれば自動的に取り込まれる。

## まとめ

- `declare module 'X'` はスクリプトファイル（import/exportなし）に書く
- 既存の `.d.ts` に `import` があるなら、ambient module 宣言は別ファイルに切り出す
- 型定義なしパッケージの補完用ファイルは `vendor.d.ts` などの独立したファイルにまとめる
