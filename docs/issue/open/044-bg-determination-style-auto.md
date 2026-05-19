---
title: 画像平均輝度から style を判定し kmeans 重心から bg を確定する
labels: [feature]
mvp: 1
feature: palette-design
created: 2026-05-19
branch:
---

# 画像平均輝度から style を判定し kmeans 重心から bg を確定する

## 何をやるか

`palette-design` feature の最初のフェーズとして、入力画像から `Style` (`dark` か `light`) を自動判定し、その style に応じて `ExtractedPalette.kmeans.dominantSortedByLightness` から `bg` 色を 1 つ確定する。`bg` は後段の WCAG コントラスト補正の基準色になるので、本 issue で fix される。

判定ロジックは次のとおりにする。

```
1. 画像 RGB の平均輝度 L̄ を計算 (Rec. 709 重み)
2. L̄ >= 0.55 なら style = "light", L̄ < 0.55 なら "dark"
3. style = "light" なら kmeans 重心のうち lightness 最大、"dark" なら最小を bg に
```

## なぜやるか

`#039 idea` のレビュー #4 で「WCAG コントラスト補正の前段に bg 確定フェーズが必須」と整理した。手動で `style` を渡すのではなく画像から自動推定する仕組みは、oshicolor の UX (画像をアップロードするだけで推しテーマができる) を実現するために必要になる。

`bg` を kmeans 由来にするのは、面積比で取られた支配色が「画像の世界観」を最も素直に反映するため。salience の bg 候補は colorfulness で動かされている可能性があり、UI ベースとして使うには動的すぎる。

## 完了条件

- [ ] `src/features/palette-design/usecases/style-detection.ts` に平均輝度判定を実装
- [ ] `src/features/palette-design/usecases/bg-selection.ts` に kmeans からの bg 選択ロジック
- [ ] 閾値 0.55 を `const STYLE_DETECTION_LUMINANCE_THRESHOLD = 0.55` で 1 箇所に集約
- [ ] 5〜10 枚のキャラ画像で「人間の直感と一致するか」を確認するテスト (Dorothy: light, Red Hood: dark など)
- [ ] 単体テスト (Vitest): 既知の輝度ベクトルに対する判定結果

## 関連

- 依存: #043 (`ExtractedPalette` 公開後でないと kmeans 重心を取れない)
- 後続: #045 (bg を基準に accent / syntax の衝突解決)
- 出発: docs/issue/idea/039-dual-extract-worldview-accent.md
