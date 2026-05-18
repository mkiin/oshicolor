---
title: kmeans 世界観 / ansi 構文 / salience 推し色の 3 系統割り当てと WCAG コントラストループ
labels: [idea, feature]
feature: color-extract
created: 2026-05-19
branch:
---

# kmeans 世界観 / ansi 構文 / salience 推し色の 3 系統割り当てと WCAG コントラストループ

## 何をやるか

同じ画像から `kmeans` `ansi` `salience` の 3 系統で並行に色抽出し、Neovim カラースキームの各グループに対して役割ごとに別系統の色を割り当てる。各色は最終段で WCAG 21 コントラストループに通して可読性を担保する。

役割と系統の割り当ては次のとおり。

| 役割 | 割り当てる色 | 由来 |
|---|---|---|
| 背景・前景・UI ベース (`bg`, `fg`, statusline base, bufferline, line numbers, NormalNC, FloatBorder ほか) | 世界観色 | `kmeans` の支配色 (面積比) |
| 構文・セマンティック (`Keyword`, `Function`, `String`, `Type`, `Constant`, `Comment`, LSP semantic tokens ほか) | hue 6 色 + 黒灰 | `ansi` の hue 6 バケット |
| 推し色アクセント (`Cursor`, `Visual`, `Search`, `IncSearch`, statusline active, `DiagnosticError` 等のハイライト系) | 顕著色 | `salience` の上位 1〜2 色 |

WCAG コントラスト補正は `bg` を基準として、すべての色に対して背景比 4.5:1 以上を満たすまで最大 10 回の lighten/darken をループでかける (wallust の `check_contrast = true` 相当)。

## なぜやるか

### 単一抽出のトレードオフ

wallust v4 の 3 つの Palette を単一で使うと、画像種別によらず次のトレードオフから逃げられないことが Dorothy, Cinderella 2, Red Hood, Scarlet の 4 キャラのチューニングで判明した。

- `kmeans` は面積比で代表色を取るため白基調の画像で世界観を素直に出せる。一方で「瞳の赤」のような面積の小さい特徴色を dedup の網にかけて潰してしまう
- `salience` は CAM16 顕著性で「目立つ色」を拾えるため特徴色は残るが、大面積の支配色 (白〜銀のグラデ) を単色まで潰して世界観のニュアンスが失われる
- `ansi` は hue 6 バケットに必ず色を割り当てるので構文区別は強いが、画像にない色を合成するため単独では推し色感が薄れる

3 系統を役割で使い分ければ、それぞれの長所が活きて短所を相殺できる。

### 複雑なルールベースより mini.hues 流の単純化

当初は「画像の colorfulness 分散で salience と kmeans を切り替える」「hue 分散が閾値未満なら ansi にフォールバック」のような **画像特性ベースの分岐ルール** を考えていたが、判定閾値のチューニングと回帰防止のコストが高い。

代わりに既存の Neovim カラースキームジェネレータ `mini.hues` の設計を参考にする。mini.hues は accent 1 色だけ入力としてもらい、残り 7 色を 60 度ずつの hue 回転で機械的に補完する設計で、これで十分に実用的なテーマを大量生成できている。oshicolor の ansi は「画像から各 hue バケットの平均色を信頼率 0.5 で取って既定値と合成する」ため、mini.hues よりも画像由来度が高い (1 色分対 6 色分)。

つまり「画像特性で抽出方法を切り替える」よりも「**抽出方法は固定し、役割ごとに別系統の色を当てる**」方が実装が単純で、しかも mini.hues という前例が実用性を保証している。

### WCAG コントラストループは bg 基準を確定させた後に走らせる

`check_contrast` は前景と背景のコントラスト比を 10 回まで lighten/darken でループ補正する後処理だが、**比較対象となる `bg` が確定していないと走らせられない**。3 系統並行抽出だと「kmeans の支配色を bg とする」ステップが必須で、ここを抽出パイプラインの最初のフェーズに据える必要がある。

`bg` の選び方は次の 2 段階で決める。

1. 画像の平均輝度から `style` を `dark` (低輝度) か `light` (高輝度) かに判定する
2. `style = light` なら kmeans 重心のうち lightness 最大、`dark` なら lightness 最小を `bg` とする

salience の顕著色や ansi の hue 6 色は、この `bg` 確定後にコントラストループの対象になる。

### Neovim ユーザーが期待する体験との整合

oshicolor の本質的なゴールは「推し画像から推し テーマを生成する」だが、ユーザー体験の優先順位を分解すると次のようになる。

1. 推し色 (1〜2 色) がテーマの主役として認識できる
2. Neovim が読める (構文区別が破綻しない、コントラストが取れている)
3. 16 色すべてが画像由来であること (※必須ではない)

3 の優先度が想定より低い。1 は salience が、2 は ansi + check_contrast が、3 は kmeans が担当する形で 1 と 2 を確実に満たせる。

## 完了条件

- [ ] PoC として 3 系統並行抽出のスクリプトを書く (`wallust run -p kmeans` `-p ansi` `-p salience` を同じ画像に対して並行実行する薄いラッパー)
- [ ] `bg` 確定ロジック (画像平均輝度判定 + style 切替 + kmeans 重心からの選択) を実装する
- [ ] 3 系統 + bg を入力として、Neovim ハイライトグループへの割り当てを行う変換層を書く
- [ ] WCAG コントラストループを bg 基準で全色にかける後処理を入れる
- [ ] 5〜10 枚のキャラ画像 (白基調、暗背景、カラフル、ミニマルなど性質の異なるもの) で生成し、`mini.hues` ベースのテーマと比較して oshicolor の優位性を評価する
- [ ] spec に役割割り当てマッピングを書く

## 実装方針

<!-- 着手時に feature-design skill が埋める -->
<!-- idea 段階のため未着手 -->

### 設計アプローチ

該当なし (idea 段階)

### 触るファイル

該当なし (idea 段階)

### 構造・命名・責務分離

該当なし

### 使用ライブラリ

該当なし

### テスト戦略

該当なし

## 関連

- 参考: docs/references/wallust/overview.md (`oshicolor への展開` の段)
- 参考: docs/references/wallust/v4-changes.md (Palette enum の整理、Ansi モードの hue バケット仕様、Kmeans モード)
- 参考: [mini.hues](https://github.com/echasnovski/mini.hues) (accent 1 色 + hue 60 度回転による Neovim テーマ生成の前例)
- 依存: #035 color-extract salience pipeline
- 関連: 着手時に salience の `cols.len() < 6` での panic に対する fallback も検討する (Alice の検証で発覚)
