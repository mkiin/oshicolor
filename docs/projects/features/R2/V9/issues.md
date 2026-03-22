# R2/V9 Issues

## 判明した課題

| #   | 問題                                     | 原因・根拠                                                                                                                       | 重要度 |
| --- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | 生成されたハイライトカラーが全体的に渋い | dominant 5色は population 順 = 面積が大きい = 彩度が低い傾向。fg-adjuster が L のみ調整し C をそのまま使うため、くすんだ fg になる | High   |
| 2   | bg と fg のコントラスト不足              | 茶色系 bg で keyword / function 等が浮かない。L 差だけでは不十分で、同系 hue の bg+fg は視覚的に溶ける                            | High   |
| 3   | seed にロール（用途）の概念がない        | d1 を無条件に neutral 源にしているが、d1 が鮮やかな色の場合は neutral に不向き。5色から neutral にふさわしい色を精査していない     | High   |
| 4   | 個性が出ない                             | nvim-highlite は bg/text/statement/storage 等セマンティックに6色を定義。V9 は population 順にフラット割り当てしており色の意味がない | Medium |
| 5   | 要所にアクセント色がない                 | swatch Vibrant 系（V/DkV/LtV）にはキャラの個性色があるが、dominant のみでは拾えない。V10 で対処予定                               | Medium |

## 具体的な影響キャラ（genshin.svg 目視確認）

amber, aratakiitto, arlecchino, beidou, candace, charlotte, chasca, chiori, collei, cyno, dahilia, dehya, diluc, escoffier, faruza, freminet, gorou, hutao, ifa, kachina, kamisatoAyato, kaveh, kazuha, kirara, klee, kujousara, kansan, lanyan, layla, lyney, marvuika, nahida, navia, ningguang, noelle, rosaria, say, sehtos, sheenhe, shikanoinHeizou, wriothesley, xiangling, xilonen, xinggiu, xinyan, yaemiko, yanfei, yoimiya, zhongli

※ ほぼ半数のキャラに影響 → 個別の問題ではなくアルゴリズムの構造的問題

## V9 で対処する範囲

- **#3**: dominant 5色から C が最も低い色を neutral 源に選定する（population 順ではなく彩度で判断）
- **#1 / #2**: fg-adjuster に MIN_CHROMA を追加し、彩度の底上げ + コントラスト改善を検討

## V10 以降に送る範囲

- **#5**: swatch Vibrant 系（V/DkV/LtV）を keyword 等の要所に差し込み、個性色を出す
- **#4**: nvim-highlite のようなセマンティックロール割り当ての導入

## 参考: nvim-highlite のパレット設計

必須6色がセマンティック（bg / text / error / ok / statement / storage）。`Palette.derive` が80以上のフィールドをフォールバックチェーン（func←statement, constant←storage 等）で自動導出する。V9 との根本的な違いは「色に用途の意味がある」こと。
