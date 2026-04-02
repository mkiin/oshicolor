# R2/V10 Issues

## 実験で判明した知見

### MCU QuantizerCelebi + Score は象徴色を拾えない

MCU の Score アルゴリズムは Hue 分散と高 Chroma を優先するが、キャラクターの象徴色とは無関係な色を選ぶ。RaidenShogun で目視確認し、キャラらしさが失われたため却下。

**教訓**: ColorThief / node-vibrant / MCU のいずれも「画像の支配色」を抽出するものであり、「キャラの象徴色」を抽出するために設計されていない。ユーザー選択フローが将来的に必要（R2 のスコープ外、別フィーチャーとして検討）。

### dominant 5色の共通化が個性の無さに繋がっている

population 順の dominant 5色はキャラクター間で似た色構成になりやすい（肌色系、暗色系が上位に来る傾向）。Vibrant 系 swatch を候補プールに混ぜることで差異が生まれる。

### Vibrant を d1 (accent) に入れるとキャラらしさが明確に出る

RaidenShogun の例: dominant 5色は全て紫系だが、Vibrant `#bc2462`（ピンク赤）を accent に入れることで「紫 + 赤」のキャラクター性が表現された。
