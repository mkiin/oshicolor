# カラー抽出ロジック解説

sample-repo に収録された2つの実装を読み解く。

- `anicolors/nextjs/src/components/palette/color-extractor.ts` — anicolors プロジェクト独自実装
- `extract-colors/` — npm パッケージ `extract-colors` の実装

それぞれアルゴリズムの設計思想が異なるため、対比しながら読むと参考になる。

---

## 目次

1. [anicolors 実装](./anicolors-color-extractor.md)
2. [extract-colors ライブラリ](./extract-colors-lib.md)
3. [2つの実装の比較](./comparison.md)
