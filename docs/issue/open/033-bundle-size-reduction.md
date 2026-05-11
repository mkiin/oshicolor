---
title: shiki の bundle 肥大を削減
labels: [refactor]
created: 2026-05-12
branch:
---

# shiki の bundle 肥大を削減

## 何をやるか

`pnpm build` 時の chunk warning ("Some chunks are larger than 500 kB") を解消する。主因は shiki の全 bundled languages / themes が初期 import に含まれていることなので、preview feature 内で実際に使う言語とテーマだけに絞り込む。

- preview feature が使う言語を `zig` と `tsx` のみに絞る。bundledLanguages の全載せを止める
- preview feature が使うテーマを `tokyo-night` (フォールバック用) のみに絞る。catppuccin / gruvbox / material-theme などのプリセットテーマは初期 bundle から外す
- shiki の `createHighlighter` を `getSingletonHighlighter` か、`createHighlighter` の `langs` / `themes` を明示的に渡す形に変更する
- 必要に応じて shiki を `shiki/core` + 個別 grammar import の形に切り替えることを検討する
- build 後の最大 chunk が 500 kB を下回ること、または warning 対象が tsx / typescript / wolfram / emacs-lisp 等の言語パック単体ではなくアプリ本体 chunk のみになることを目標にする

## なぜやるか

現状の `pnpm build` 出力では `emacs-lisp` 779 kB、`cpp` 626 kB、`wasm` 622 kB、`wolfram` 262 kB など、oshicolor が利用しない言語パックが大量に同梱されている。preview feature の `useShikiTokens` は `zig` か `tsx` だけしか使わず、テーマも palette 由来のカスタムテーマか `tokyo-night` フォールバックの 2 系統だけ。利用していないパックが Worker bundle に乗ると Cloudflare Workers の deploy 上限 (10 MB) と初期 ロード時間の両方を圧迫する。preview ページに到達するまでに不要なパースが走るのは UX も損なう。

## 完了条件

- [ ] preview feature の shiki 利用箇所が `zig` と `tsx` のみを bundle する形になっている
- [ ] preview feature が初期 bundle するテーマは `tokyo-night` フォールバックのみで、他は lazy load か削除されている
- [ ] `pnpm build` 出力で 500 kB を超える chunk が言語パック単体ではない (アプリ本体 chunk のみ) 状態になっている
- [ ] preview ページが従来どおり描画される (zig コードと tsx コードのシンタックスハイライトが正しく表示される)

## 実装方針

<!-- 着手時に feature-design skill が埋める (HOW を書く)。trivial な bug fix では着手者が直接埋めてよい -->
<!-- WHAT (feature 仕様・API・型・アルゴリズム) は docs/features/<feature>/spec.md に書く。ここには書かない -->
<!-- 各小節は該当しなければ「該当なし」と書く。小粒な issue では各 1〜2 行で十分 -->

### 設計アプローチ

### 触るファイル

### 構造・命名・責務分離

### 使用ライブラリ

### テスト戦略

## 関連

- 依存: docs/issue/done/029-rename-src-features.md (preview feature の rename 完了後に着手する)
- 参考: src/features/preview/hooks/use-shiki-tokens.ts (shiki 利用箇所)
