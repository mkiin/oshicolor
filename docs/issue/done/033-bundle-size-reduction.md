---
title: shiki の bundle 肥大を削減
labels: [refactor]
created: 2026-05-12
branch: features/refactor/033-bundle-size-reduction
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

- [x] preview feature の shiki 利用箇所が `zig` と `tsx` のみを bundle する形になっている
- [x] preview feature が初期 bundle するテーマは `tokyo-night` フォールバックのみで、他は lazy load か削除されている
- [x] `pnpm build` 出力で 500 kB を超える chunk が言語パック単体ではない (アプリ本体 chunk のみ) 状態になっている
- [x] preview ページが従来どおり描画される (zig コードと tsx コードのシンタックスハイライトが正しく表示される)

## 実装方針

### 設計アプローチ

shiki のトップレベル import (`import("shiki")`) は内部で `bundledLanguages` と `bundledThemes` 全てを参照しており、これが言語パック全載せの原因。`shiki/core` に切り替えて `createHighlighterCore` を直接呼び出し、`langs` と `themes` には個別 import の Promise を直接渡す形に変える。`shiki/engine/oniguruma` の `createOnigurumaEngine` で正規表現エンジンを初期化する。preview feature が必要とする zig / tsx の grammar、tokyo-night theme は静的 import で先読みし、palette 由来のカスタムテーマは引き続き runtime で構築する。

### 触るファイル

- `src/features/preview/hooks/use-shiki-tokens.ts` shiki/core ベースに書き換え
- `src/features/preview/components/vim-preview.tsx` theme 渡しの型変更を反映

### 構造・命名・責務分離

`use-shiki-tokens.ts` は shiki の bundled API から切り離し、`shiki/core` の `createHighlighterCore` を使う。langs と themes は `() => import("@shikijs/langs/zig")` のような callable lazy loader を渡す形にして、rolldown が個別 chunk として code-split する状態を狙う。`vim-preview.tsx` で theme 名を string で渡している箇所も、tokyo-night は固定 import に変える。fallback color の定数 (FALLBACK_COLORS) は変更しない。

### 使用ライブラリ

shiki は既存依存をそのまま使う。`shiki` パッケージ内の `shiki/core`、`shiki/engine/oniguruma`、`@shikijs/langs/*`、`@shikijs/themes/*` サブパス export を活用する (新規 package 追加不要)。

### テスト戦略

自動テストなし。`pnpm build` で 500 kB 超 chunk がアプリ本体 (`main`、`routes`、`preview`) 以外に存在しないことを確認する。手動確認として `pnpm dev` で preview ページの zig と tsx の syntax highlight が以前と同じ見た目で表示されることを確認する。

## 関連

- 依存: docs/issue/done/029-rename-src-features.md (preview feature の rename 完了後に着手する)
- 参考: src/features/preview/hooks/use-shiki-tokens.ts (shiki 利用箇所)
