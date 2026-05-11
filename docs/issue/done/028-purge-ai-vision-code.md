---
title: AI Vision 系コードの一掃
labels: [refactor]
mvp: 1
feature:
sprint:
created: 2026-05-07
branch: features/refactor/028-purge-ai-vision-code
---

# AI Vision 系コードの一掃

## 何をやるか

旧 AI Vision 路線で実装されたコードを削除する。対象は次のとおり。

- `src/features/color-analyzer/` を全削除する
- `src/infrastructures/ai/` の中で AI Vision 関連を削除する。具体的には `google-ai.adapter.ts` などが該当する
- `src/routes/index.tsx` から `analyzeColorMutationAtom` の呼び出しを剥がし、placeholder のページに置き換える

## なぜやるか

wallust ベースのパレット生成路線に方針転換したため、AI Vision 用のコードは不要になった。残しておくと MVP-1 着手時の見通しが悪く、import 解決のノイズにもなる。

## 完了条件

- [x] `src/features/color-analyzer/` が存在しない
- [x] `src/infrastructures/ai/` から AI Vision 系が削除されている
- [x] `src/routes/index.tsx` が AI Vision に依存しない状態になっている
- [x] build が通る。画像処理パイプラインは一時的に placeholder で良い

## 実装方針

### 設計アプローチ

AI Vision 路線の deletion 専念タスク。`src/features/color-analyzer/` を丸ごと削除、`src/infrastructures/ai/` も全削除（中身が google-ai.adapter.ts のみで全て AI Vision 用途のため）、`src/routes/index.tsx` を画像アップロード後に「分析機能は準備中」を表示する placeholder に書き換える。`@google/genai` 依存を `package.json` から外し、`pnpm build` が通ることを最終確認する。

### 触るファイル

- `src/features/color-analyzer/` ディレクトリ全削除
- `src/infrastructures/ai/` ディレクトリ全削除
- `src/routes/index.tsx` placeholder 化
- `package.json` から `@google/genai` 依存を削除
- `.env.example` から `GEMINI_API_KEY` を削除（残っていれば）

### 構造・命名・責務分離

routes/index.tsx は Dropzone と ImagePreview のみを保持する形にし、palette-generator や vim-preview への依存は維持する。AnalysisResults コンポーネントは丸ごと削除し、画像アップロード時の placeholder メッセージで置き換える。029 で palette-generator / vim-preview を rename するので、import パスはここではいじらない。

### 使用ライブラリ

新規追加なし。`@google/genai` を依存から外すのみ。

### テスト戦略

自動テストなし。`pnpm build` が成功すること、`pnpm dev` でトップページが表示され画像アップロード時に placeholder が出ることを手動確認する。

## 関連

- 後続: 029 src/features を docs 命名に rename
