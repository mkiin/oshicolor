---
title: 役割別 WCAG コントラストループによる可読性補正
labels: [feature]
mvp: 2
feature: palette-design
created: 2026-05-19
branch:
---

# 役割別 WCAG コントラストループによる可読性補正

## 何をやるか

割り当て完了後の `FinalPalette` に対し、`bg` を基準として全色のコントラスト比をチェックし、不足分は lightness を最大 10 回ループで動かして補正する。閾値は役割別に分け、推し色 (accent 由来) の hue を保つために緩和する。

| 役割 | 対象グループ | 閾値 |
|---|---|---|
| Syntax | ansi 由来 (Keyword / Function / String / Type / Constant 等) | 4.5:1 厳格 |
| Accent | salience 由来 (Cursor / Visual / Search / DiagnosticError 等) | 3:1 緩和 |
| UI base | kmeans 由来 (bg / fg / Comment / LineNr 等) | 補正なし |

## なぜやるか

`#039 idea` のレビュー #4 で「全色一律 4.5:1 だと推し色の hue が壊れる」と指摘された。salience で拾った瞳の赤や髪のピンクなどは、4.5:1 を強制すると lightness を大きく動かす必要があり、推し色感が失われる。3:1 まで緩和すれば視認は可能で、UX 優先順位 1 (推し色がテーマの主役) を守れる。

UI base (kmeans 由来) は補正しない理由は、kmeans の支配色は元画像内で隣接して使われているので、補正なしでも自然に読める想定にある。これは仮説なのでテストで検証する。

## 完了条件

- [ ] `src/features/palette-design/usecases/contrast.ts` (既存) に役割別の補正関数を追加
- [ ] WCAG 21 のコントラスト比計算は既存実装を使う (`#019 dark-tone-ui` 等で既に存在する想定)
- [ ] ループは最大 10 回で打ち切り、それでも閾値未達なら警告ログを出す
- [ ] 補正は lightness を 5% 刻みで動かす (wallust 流)
- [ ] 5〜10 枚のキャラ画像で WCAG 達成率 (syntax 6 色のうち 4.5:1 を満たす割合) を計測
- [ ] 単体テスト: 低コントラスト色が補正後に閾値を満たす、accent は hue が保たれる

## 関連

- 依存: #045 (割り当て後の FinalPalette が必要)
- 後続: #047 (評価指標で WCAG 達成率を測る)
- 出発: docs/issue/idea/039-dual-extract-worldview-accent.md レビュー #4
- 参考: library/wallust/src/colors.rs:407 (`check_contrast_all` の役割範囲)
