---
title: vp fmt が遅い原因を突き止めた話
---

## はじめに

最近 Web 開発の統合ツールチェインと銘打って登場した Vite+ ですが、やたらとフォーマット・リンターが遅いなぁと感じていました。はじめに申し上げますと、原因は分かったんですが解決はできていない状況です。

## なんか遅いなと感じていた

Vite+ を使用する前は、Biome というフォーマッター・リンターを使用していました。別段遅いと感じたことはなく、やっぱ Rust 早いなぁと弱々プログラマーらしく Rust の権威に頭をひれ伏していました。

Vite+ に乗り換えて...

`vp migrate` で既存のコードベースに沿った移行作業をしてくれます。この時すでにある程度の設定は終わった状態です。とりあえず試しでフォーマットとリンターをまとめて行ってくれる `vp check` を実行しました。

で実行時間は？

```bash
❯ vp check
VITE+ - The Unified Toolchain for the Web

pass: All 114 files are correctly formatted (1798ms, 16 threads)
pass: Found no warnings, lint errors, or type errors in 61 files (2.1s, 16 threads)
```

え？遅くね？ **114 ファイルを 16 threads で 2 秒かかってんだけど。Rust 使ってるんだよね？**

プラス、git hook に `vp check` が登録されているので、コミットするたびに 2 秒の待ち時間が発生します。

## 時間がかかっている箇所の調査

### とりあえず実測

`vp check` は中で `oxfmt` と `oxlint` をラップして実行します。切り分けとしてフォーマットの方を調査していくことにしました。

`vp fmt` を実行することで、フォーマットオンリーで実行できます。`oxfmt` を直接実行とどれくらい差分があるかを確認してみました。

```bash
❯ /usr/bin/time -v vp fmt test.ts
Finished in 1282ms on 1 files using 16 threads.
Elapsed (wall clock) time: 0:02.78
```

```bash
❯ /usr/bin/time -v ./node_modules/.pnpm/node_modules/.bin/oxfmt test.ts
Finished in 75ms on 1 files using 16 threads.
Elapsed (wall clock) time: 0:00.19
```

一目瞭然ですね。比べるまでもないです。

単一ファイルに 1 秒以上かかっているこの状況なんなんだ、ということで調査をしました。

### vp fmt のアーキテクチャを把握する

まず `vp fmt` が内部で何をしているか、プロセスツリーを確認しました。`vp fmt` は数秒かかるので、バックグラウンドで起動して子プロセスが立ち上がったタイミングで `ps` を叩きます。

```bash
❯ vp fmt test.ts & sleep 0.5 && ps --forest -o pid,args -g $$
  PID COMMAND
  vp fmt test.ts
   \_ /home/.../.vite-plus/js_runtime/node/24.14.0/bin/node .../vite-plus/dist/bin.js fmt test.ts
```

`vp`（Rust バイナリ）は Node.js を子プロセスとして起動し、`dist/bin.js` に処理を委譲していました。つまり実行フローはこう:

```
vp (Rust binary)
  → Node.js (dist/bin.js)
    → NAPI binding (Rust)
      → oxfmt (子プロセス)
```

### レイヤーを一枚ずつ剥がして差分を取る

プロセスが多段になっているので、外側のレイヤーから順にスキップして実行し、各レイヤーのコストを差分で割り出しました。

```bash
# A. vp fmt（全レイヤー）
❯ /usr/bin/time -v vp fmt test.ts
Elapsed: 0:02.76

# B. Node.js bin.js を直接実行（Rust ランチャーをスキップ）
❯ /usr/bin/time -v node dist/bin.js fmt test.ts
Elapsed: 0:02.75

# C. oxfmt 直接（Node.js + bin.js もスキップ）
❯ /usr/bin/time -v oxfmt test.ts
Elapsed: 0:00.17
```

| 比較  | 差分  | 意味                                             |
| ----- | ----- | ------------------------------------------------ |
| A - B | 0.01s | Rust ランチャーのコスト → ほぼゼロ               |
| B - C | 2.58s | bin.js 内部の処理コスト → **ここがボトルネック** |

Rust ランチャーが遅いと最初は疑ったが、計測で即座に否定されました。問題は bin.js の中にある。

### bin.js の中で何が遅いのか

bin.js の内部では、NAPI binding 経由で複数の JS resolver 関数が呼ばれます。各 resolver にタイマーを仕込んだところ、犯人は一発で特定できました。

```
[resolver] fmt(): 0 ms
[resolver] resolveUniversalViteConfig(): 1318 ms   ← ★
run() total: 2758 ms
```

`resolveUniversalViteConfig()` が **1.3 秒**。Vite+ のソースを読むと、この関数は `vite.config.ts` から `fmt` プロパティを取得するために Vite の `resolveConfig()` をフル実行していました。**`fmt` の設定を読みたいだけなのに、`vite.config.ts` に書かれた全プラグイン 82 個を import・初期化している。**

裏を取るため `vite.config.ts` の `plugins` を空にして再計測:

```bash
# プラグインあり (82個)
❯ /usr/bin/time -v vp fmt test.ts
Elapsed: 0:02.76

# プラグインなし
❯ /usr/bin/time -v vp fmt test.ts
Elapsed: 0:00.56
```

**2.76s → 0.56s。** 2.2 秒はプラグインのロードでした。

## 原因まとめ

`vp fmt` の実行で発生するコスト:

| フェーズ                    | 所要時間  | 内容                                                |
| --------------------------- | --------- | --------------------------------------------------- |
| Rust ランチャー             | ~0.01s    | ローカル bin.js を探して Node.js を起動             |
| import (binding, resolvers) | ~0.01s    | NAPI binding と各 resolver のロード                 |
| `fmt()` resolver            | ~0ms      | oxfmt バイナリのパス解決                            |
| **`resolveConfig()`**       | **~1.2s** | **Vite config のフル解決（82 プラグインの初期化）** |
| oxfmt 実行                  | ~1.3s     | 実際のフォーマット（内部で "Finished in 1288ms"）   |
| **合計**                    | **~2.8s** |                                                     |

**根本原因**: `vp fmt` は `vite.config.ts` から `fmt` 設定を読むために Vite の `resolveConfig()` をフル実行する。この関数はプラグインの import と初期化を含むため、ビルド用プラグインが多いプロジェクトほど遅くなる。`fmt`/`lint` の設定だけ取りたいのにビルドパイプライン全体をロードする設計になっている。

## 対策

1. **conform.nvim では oxfmt を直接呼ぶ** - `.oxfmtrc.json` に設定を書けば oxfmt が自動検出する (0.17s)
2. **`vp fmt` は CI やターミナル用と割り切る** - 数秒かかっても実害がない場面で使う
3. **upstream に改善を提案** - `fmt`/`lint` 設定の取得時にプラグインをロードしない軽量パスの導入
