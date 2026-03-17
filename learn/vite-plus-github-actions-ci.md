---
title: Vite+ を使うプロジェクトで GitHub Actions のデプロイが詰まった話
---

# はじめに

先日、VoidZero から `Vite+ Alpha` が発表された。`Vite+` とは、フロントエンドの各種ツールをワンセットにして管理しやすくした統合ツールチェーンである。

試しに現在作成している個人開発アプリのプロジェクトに導入してみた。このプロジェクトでは GitHub Actions を利用して Cloudflare にデプロイするワークフローが組まれており、Vite+ の導入後に初めて CI を回したところ `Command "vite" not found` というエラーで詰まった。

技術スタックは以下の通り。

- **フレームワーク**: TanStack Start (React)
- **ビルドツール**: Vite+ (`vp`)
- **IaC / デプロイ**: Alchemy (`alchemy deploy`)
- **ホスティング**: Cloudflare Workers

---

# エラー内容

```
ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL  Command "vite" not found

Error: Command failed with exit code 254: pnpm vite build
    at async Website (alchemy/lib/cloudflare/website.js:139:9)
    at async Vite (alchemy/lib/cloudflare/vite/vite.js:38:12)
    at async TanStackStart (alchemy/lib/cloudflare/tanstack-start/tanstack-start.js:9:12)
```

---

# 原因

## Vite+ のバイナリは `node_modules/.bin` に存在しない

Vite+ に移行すると、`package.json` に以下が自動で設定される。

```json
// package.json
"devDependencies": {
    "vite": "npm:@voidzero-dev/vite-plus-core@latest"
},
"pnpm": {
    "overrides": {
        "vite": "npm:@voidzero-dev/vite-plus-core@latest"
    }
}
```

これは Vite+ が意図的に行う設計で、**エコシステム互換性の維持**が目的だ。既存の Vite プラグインやフレームワークは `vite` という名前でパッケージを参照する。`pnpm.overrides` で `vite` を `@voidzero-dev/vite-plus-core` にエイリアスすることで、間接依存を含むすべてのパッケージが自動的に Vite+ のコアを参照するようになり、プラグイン側を一切変更せずに置き換えられる。

ただし `@voidzero-dev/vite-plus-core` は **`node_modules/.bin/vite` というバイナリを登録しない**。Vite+ の CLI である `vp` は別途グローバルに `~/.vite-plus/bin/vp` としてインストールされるものであり、`node_modules/.bin` には存在しない。

## Alchemy が内部で `pnpm vite build` を組み立てる

Alchemy の `TanStackStart` はビルド時にパッケージマネージャーを自動検出し、`pnpm vite build` を実行しようとする（`alchemy/lib/cloudflare/vite/vite.js` の実装による）。

CI には `vp` が未インストールで、かつ `node_modules/.bin/vite` も存在しないため、コマンドが解決できずに失敗する。

```
ローカル: vp は ~/.vite-plus/bin/vp にある → vp build が使える
CI:       vp は未インストール、node_modules/.bin/vite も存在しない → 詰まる
```

---

# `vp build` と `vp run build` の違い

対処に入る前に、混同しやすいコマンドを整理しておく。Vite+ のドキュメントには以下の記載がある。

> Unlike package managers, built-in commands cannot be overwritten. If you are trying to run a `package.json` script use `vp run build` instead.
>
> — Vite+ Troubleshooting

| コマンド       | 実行内容                                     |
| -------------- | -------------------------------------------- |
| `vp build`     | Vite の組み込みビルドを常に実行する          |
| `vp run build` | `package.json` の `scripts.build` を実行する |

Alchemy から呼び出すビルドコマンドには、Vite の組み込みビルドそのものである `vp build` が適切。

---

# 対処

2か所を修正する。

## 1. ワークフローで `voidzero-dev/setup-vp@v1` を使う

Vite+ の公式 CI ガイドでは `voidzero-dev/setup-vp` アクションが提供されている。これ1つで Node.js・パッケージマネージャーのセットアップ・依存キャッシュまで処理でき、`vp` コマンドも使えるようになる。

```yaml
# 変更前
- name: Setup pnpm
  uses: pnpm/action-setup@v4
  with:
    run_install: false
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: "24"
    cache: pnpm
- name: Install dependencies
  run: pnpm install

# 変更後
- name: Setup Vite+
  uses: voidzero-dev/setup-vp@v1
  with:
    node-version: "24"
    cache: true
- name: Install dependencies
  run: vp install
```

## 2. `alchemy.run.ts` でビルドコマンドを上書きする

Alchemy の `TanStackStart` は `build.command` オプションを受け取れる。デフォルトの `pnpm vite build` を `vp build` に上書きする。

```typescript
// 変更前
export const worker = await TanStackStart("website");

// 変更後
export const worker = await TanStackStart("website", {
  build: { command: "vp build" },
});
```

---

# 最終的なワークフロー

```yaml
name: Deploy

on:
  push:
    branches:
      - main
      - dev

env:
  STAGE: ${{ github.ref_name == 'main' && 'prod' || github.ref_name }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - name: Setup Vite+
        uses: voidzero-dev/setup-vp@v1
        with:
          node-version: "24"
          cache: true
      - name: Install dependencies
        run: vp install
      - name: Deploy
        run: pnpm alchemy deploy --stage ${{ env.STAGE }} --adopt
        env:
          ALCHEMY_PASSWORD: ${{ secrets.ALCHEMY_PASSWORD }}
          ALCHEMY_STATE_TOKEN: ${{ secrets.ALCHEMY_STATE_TOKEN }}
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          CLOUDFLARE_EMAIL: ${{ secrets.CLOUDFLARE_EMAIL }}
```

---

# おわりに

Vite+ を採用したプロジェクトの CI では、Node.js やパッケージマネージャーを個別にセットアップするより `voidzero-dev/setup-vp` を使うほうがシンプルかつ確実。

Alchemy のようにビルドコマンドを内部で組み立てるツールを使う場合は、デフォルトのコマンドが自分の環境と合っているか確認し、合わなければ上書きオプションを探すのが近道だった。
