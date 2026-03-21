# R2/V5 Issues

## 判明した課題

| # | 問題 | 原因・根拠 | 重要度 |
|---|------|-----------|--------|
| 1 | seed が各軸1色ではキャラモチーフの色を逃す | 3 seed（main/sub/accent 各1）だと色相カバレッジが不足。特に main/sub 軸内に複数の重要色相がある場合に片方が落ちる | High |
| 2 | seed スコアリングが OkLch ベース | plan.md は HCT 統一を掲げているが `scoreSeed` は OkLch の L/C を使用 | Low |
| 3 | HCT 実装方法が未決定 | plan.md の未決定事項。material-color-utilities を使うか OkLch で近似するか | Low |
| 4 | tonal palette 以降が未実装 | Step 2〜4（palette 生成→ロール→ハイライト展開）のコアロジックが未着手 | Low |
| 5 | 軸 2 つ以下のフォールバック未実装 | plan.md に記載あるが未着手 | Low |
| 6 | Tone 値の検証パイプラインがない | 目視検証用の仕組みが SVG デバッグスクリプトのみ | Low |

## 限界・トレードオフ

- 3 seed 構造は MCU/xeno を参考にした設計だが、ゲームキャラクターは1軸内に複数の特徴色を持つことが多く、1軸1seed では表現力が不足する
- seed スコアリングの閾値（TARGET_CHROMA=0.15, TARGET_L=0.62）は経験値であり、seed 数を増やす場合は選定ロジック自体の再設計が必要
