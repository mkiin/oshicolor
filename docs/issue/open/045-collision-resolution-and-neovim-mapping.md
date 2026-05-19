---
title: 系統間衝突解決と Neovim ハイライトグループへの割り当て
labels: [feature]
mvp: 2
feature: palette-design
created: 2026-05-19
branch:
---

# 系統間衝突解決と Neovim ハイライトグループへの割り当て

## 何をやるか

`ExtractedPalette` と確定済みの `bg` を入力に、salience の `topAccents`、kmeans の `dominantSortedByLightness`、ansi の `hueBuckets` から色を取り出して Neovim ハイライトグループに割り当てる。割り当て前に bg と他色の衝突をチェックし、近接する色は次点に繰り上げる。

役割割り当て表 (`#039 idea` で定義済み):

| 役割 | 系統 |
|---|---|
| `bg` / `fg` / Comment / LineNr / NormalNC / FloatBorder | kmeans (世界観層) |
| Keyword / Function / String / Type / Constant / etc | ansi (構文層) |
| Cursor / Visual / Search / IncSearch / statusline active / DiagnosticError | salience (推し色) |

衝突解決ロジック (wallust の `constrain_col_against_cols` を移植):

```
1. accent 候補を bg との sal_i 距離で降順ソート
2. 上位から取り、既出 accent との sal_i 距離 < THRESHOLD_ACCENT なら次点へ
3. ansi の hue 6 色も bg / accent との sal_i 距離をチェックして近接していたら hue バケットの第 2 候補を使う
```

## なぜやるか

3 系統を並行抽出しても、最終色を Neovim グループに割り当てる前に衝突を解消しないと「Cursor が bg に埋没」「Search 色が Visual 色と同じ」のような UX 破綻が起きる。`#039 idea` のレビュー #3 で「衝突解決ルールが定義されていない」と指摘されており、これを wallust 由来のロジックで埋めるのが本 issue になる。

割り当て表自体は #039 で固めてあるので、本 issue は実装に集中する。

## 完了条件

- [ ] `src/features/palette-design/usecases/conflict-resolution.ts` に sal_i 距離による繰り上げロジック
- [ ] `src/features/palette-design/usecases/assignment.ts` に Neovim グループへの割り当て関数
- [ ] `THRESHOLD_ACCENT` を 1 箇所に集約 (出発点は wallust の `C0_MIN_SAL_BG = 1.0`)
- [ ] sal_i は `#035` で実装した CAM16 ベースの距離関数を再利用
- [ ] 5〜10 枚のキャラ画像で「accent と bg が知覚的に区別できる」テスト
- [ ] 単体テスト: 既知の衝突パターン (bg と accent が近接) で繰り上げが動く

## 関連

- 依存: #043 (ExtractedPalette), #044 (bg 確定)
- 後続: #046 (WCAG コントラストループ)
- 移植元: library/wallust/src/histogram/salience.rs:419-490
- 出発: docs/issue/idea/039-dual-extract-worldview-accent.md レビュー #3
