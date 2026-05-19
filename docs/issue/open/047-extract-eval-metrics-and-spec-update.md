---
title: 抽出パレットの評価指標スクリプトと spec 更新
labels: [research]
mvp: 3
feature: color-extract
created: 2026-05-19
branch:
---

# 抽出パレットの評価指標スクリプトと spec 更新

## 何をやるか

`extractPalette` と最終的な `FinalPalette` の品質を機械的に評価する 3 指標のスクリプトを書く。5〜10 枚のキャラ画像で計測し、`mini.hues` や wallust 単独抽出と数値比較したうえで、spec.md に結果と運用方針を書き込む。

3 指標は次のとおり。

- **WCAG 達成率**: bg に対して 4.5:1 を満たす syntax 色 (color1-6) の割合
- **推し色再現率**: 入力画像 salience 上位 1 色と生成パレットの最も近い色との CIEDE2000 距離
- **構文区別性**: syntax 6 色間の最小 hue 角差 (60 度に近いほど良い)

## なぜやるか

`#039 idea` のレビュー #5 で「mini.hues との比較指標が主観に依存していて回帰テストに転用できない」と指摘された。3 指標を数値化することで、本実装の品質判定と他テーマジェネレータとの比較を機械化できる。

3 系統並行抽出が単一抽出より優れているかどうかも、これらの指標で検証できる。指標で勝てなければアイデア (#039) を棄却する判断にもつながる。

## 完了条件

- [ ] `scripts/eval/extract-quality.ts` で 3 指標の計算スクリプトを実装 (Node 24 直接実行)
- [ ] 5〜10 枚のキャラ画像 (Dorothy, Cinderella, Red Hood, Scarlet, Snow_White ほか) で計測
- [ ] mini.hues / wallust 単独抽出 (kmeans のみ / salience のみ) との比較表を作成
- [ ] 結果を `docs/references/color-extract/eval.md` に記録
- [ ] `docs/features/color-extract/spec.md` に「品質指標と目標値」を追記
- [ ] CI で回せるかは別途検討 (依存が重ければ手動実行)

## 関連

- 依存: #043 (ExtractedPalette), #046 (WCAG 補正後の FinalPalette)
- 出発: docs/issue/idea/039-dual-extract-worldview-accent.md レビュー #5
