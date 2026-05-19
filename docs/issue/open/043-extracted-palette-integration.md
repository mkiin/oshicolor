---
title: ExtractedPalette 型統合と color-extract の公開 API 完成
labels: [feature]
mvp: 1
feature: color-extract
created: 2026-05-19
branch:
---

# ExtractedPalette 型統合と color-extract の公開 API 完成

## 何をやるか

`#035` の salience pipeline、`#041` の kmeans pipeline、`#042` の ansi pipeline の 3 系統を 1 つの中間データ型 `ExtractedPalette` にまとめ、`color-extract` feature の公開 API として `extractPalette(image, style): Promise<ExtractedPalette>` を export する。

```typescript
type ExtractedPalette = {
    kmeans:   { dominantSortedByLightness: Lab[] };       // bg/fg 候補プール
    ansi:     { hueBuckets: Record<HueName, OKLch> };      // syntax 6 + 黒灰
    salience: { topAccents: Cam16UcsJmh[]; background: Cam16UcsJmh }; // 推し色 + bg 候補
    source:   { width: number; height: number; hash: string };
    meta:     { style: Style; extractedAt: string };
};
```

## なぜやるか

`#039 idea` のレビュー #2 で受けた「中間データを公開 API として渡し、palette-design 側に組み立てロジックを委ねる」設計を実現するため。color-extract が最終 16 色まで作ってしまうと割り当てロジックの柔軟性が失われ、palette-design は色を組み直すしかなくなる。

3 系統を並行抽出するときは Web Worker pool を共有して効率化したい (`#035` で salience 用、`#041` で kmeans 用、`#042` で ansi 用にそれぞれ走らせるのは無駄)。本 issue で `extractPalette` を実装するときに pool の共有方針も決める。

## 完了条件

- [ ] `src/features/color-extract/types/extracted-palette.ts` に `ExtractedPalette` 型を定義
- [ ] `src/features/color-extract/usecases/extract-palette.ts` で 3 系統を並行抽出する公開関数を実装
- [ ] Web Worker pool の共有戦略を決め、3 系統で同じ pool を使い回す
- [ ] `src/features/color-extract/index.ts` から `extractPalette` を export
- [ ] 既存の `extractColors` (salience 単独) は維持しつつ、本関数を新規追加
- [ ] 3 系統並行で 1024² 画像が単独抽出 3 回より高速に終わることをベンチで確認
- [ ] 公開 API の E2E テスト (style=dark / light で `ExtractedPalette` 全フィールドが埋まる)

## 関連

- 依存: #035, #041, #042
- 後続: #044 (bg 確定), #045 (衝突解決と割り当て), #046 (WCAG)
- 設計の出発: docs/issue/idea/039-dual-extract-worldview-accent.md レビュー #2
