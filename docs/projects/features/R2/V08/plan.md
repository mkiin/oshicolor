# R2/V8 colorthief 準拠 Vibrant + Muted スコアリング

## なぜ V8 が必要か

V7（V + DV/LV 競合選定）は node-vibrant の HSL ベーススコアリングを使用していたが、colorthief の実際のソースコードを確認したところ、colorthief は OkLch ベースで Vibrant/Muted を選定していることが判明した。

node-vibrant 方式では colorthief が画像全体で選ぶ Vibrant と、軸内で選ぶ Vibrant が一致しないケースがあった（例: Nilou の accent 軸で #c75f3f が Vibrant に選ばれない）。

## 前版との変更対照表

| 項目 | V7 | V8 |
| ---- | ---- | ------ |
| スコアリング色空間 | HSL (saturation/luma) | OkLch (L/C) |
| target | node-vibrant 方式 (V/DV/LV) | colorthief 方式 (Vibrant/Muted) |
| スコア方向 | 距離が小さいほど良い | スコアが高いほど良い |
| population | 未使用 → 後付け減算 | colorthief 準拠で正規化加算 |
| 範囲フィルタ | なし | 廃止（colorthief は持つが軸内少数色では厳しすぎる） |

## 設計方針

colorthief の `swatches.ts` のスコアリングロジックを軸内に適用する。2色目の選定を DV/LV 競合から Muted target に変更し、Vibrant（鮮やか）+ Muted（控えめ）の 2 seed 構成にする。
