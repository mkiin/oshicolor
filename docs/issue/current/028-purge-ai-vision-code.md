---
title: AI Vision 系コードの一掃
labels: [refactor]
mvp: 1
feature:
sprint:
created: 2026-05-07
branch:
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

- [ ] `src/features/color-analyzer/` が存在しない
- [ ] `src/infrastructures/ai/` から AI Vision 系が削除されている
- [ ] `src/routes/index.tsx` が AI Vision に依存しない状態になっている
- [ ] build が通る。画像処理パイプラインは一時的に placeholder で良い

## 関連

- 後続: 029 src/features を docs 命名に rename
