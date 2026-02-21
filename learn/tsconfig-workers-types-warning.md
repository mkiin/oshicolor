---
title: tsconfig.json に存在しないパッケージを types 指定したときの警告
---

# tsconfig.json に存在しないパッケージを types 指定したときの警告

## 問題

`tsconfig.json` の `compilerOptions.types` に `@cloudflare/workers-types` を指定しているにもかかわらず、エディタ上に以下の警告が表示される。

```
Cannot find type definition file for '@cloudflare/workers-types'.
```

## 原因

`compilerOptions.types` に列挙したパッケージは、TypeScript がグローバルスコープに型を注入するために参照する。パッケージが `node_modules` に存在しない場合、この警告が発生する。

今回は `@cloudflare/vite-plugin` のみがインストールされており、`@cloudflare/workers-types` は依存関係に含まれていなかった。

```json
// tsconfig.json（修正前）
"types": ["vite/client", "@cloudflare/workers-types", "./src/types/env.d.ts"]
```

## 対処方

プロジェクトの `env.d.ts` が `alchemy.run.ts` から `Env` 型を派生させる構成であり、`@cloudflare/workers-types` のグローバル型を直接使用していないことを確認したうえで、`types` から該当エントリを削除した。

```json
// tsconfig.json（修正後）
"types": ["vite/client", "./src/types/env.d.ts"]
```

なお、`KVNamespace` や `R2Bucket` など Cloudflare Workers ランタイム API の型をコード内で直接参照している場合は削除せず、`pnpm add -D @cloudflare/workers-types` でパッケージをインストールするほうが適切。

## まとめ

| 状況 | 対処 |
|---|---|
| Cloudflare Workers API の型を直接使っていない | `types` から `@cloudflare/workers-types` を削除 |
| `KVNamespace` 等を直接参照している | `pnpm add -D @cloudflare/workers-types` でインストール |

`compilerOptions.types` に書いたパッケージが `node_modules` に存在しないと警告になる。使っていないなら削除、使っているなら入れる、がシンプルな判断基準。
