# node-vibrant コード解析ドキュメント

写真・画像から代表的なカラーパレットを抽出するライブラリ `node-vibrant` の内部ロジック解析まとめ。

## ドキュメント一覧

| ファイル | 内容 |
|---|---|
| [architecture.md](./architecture.md) | パッケージ構成・全体アーキテクチャ |
| [code-map.md](./code-map.md) | コードマップガイド（ファイル・クラス・関数の対応表） |
| [algorithm.md](./algorithm.md) | アルゴリズム詳細解説（MMCQ・Generator） |
| [data-flow.md](./data-flow.md) | データフロー・処理の流れ |

## 一言まとめ

```
画像 → スケールダウン → フィルタリング → MMCQ量子化 → パレット生成 → 6色のSwatch
```

MMCQ（Modified Median Cut Quantization）というアルゴリズムでRGB色空間を再帰的に分割し、
各領域の代表色を抽出。その後 HSL 属性でスコアリングして
`Vibrant / DarkVibrant / LightVibrant / Muted / DarkMuted / LightMuted`
の6スロットに割り当てる。
