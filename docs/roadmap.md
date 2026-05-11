# oshicolor ロードマップ

## ゴール

画像 1 枚から、キャラクターの色調に合ったテーマ（ダーク/ライト自動判定）の Neovim Lua ファイルをダウンロードできる状態にする。

## MVP 段階

| MVP | 概要 | 依存 | 状態 |
|---|---|---|---|
| MVP-1 | 画像から色抽出 → パレット設計 → JSON 出力 | なし | 未着手 |
| MVP-2 | パレット JSON → Neovim カラーマッピング → Lua ファイル生成 + ダウンロード | MVP-1 | 未着手 |
| MVP-3 | ブラウザ上でプレビュー表示 | MVP-2 | 未着手 |
| MVP-4 | ユーザー環境への配布方法 | MVP-3 | 未定 |
| MVP-5 | LP・UI デザインシステム | 並行可 | 未着手 |

## MVP-1: 色抽出 + パレット設計

wallust の Backend (Kmeans) + ColorSpace (LchAnsi/Salience) を参考に、画像から ANSI 順序を保つ 8 色を抽出し、Neovim ハイライトグループに割り当てるパレット JSON を生成する。

- Kmeans (K=8-12) + 背景マスキングで主要色抽出
- CIEDE2000 dedup + 動的しきい値で色数調整
- LchAnsi hue バケットで色相欠損を補完
- Salience スコアで推し色を強調
- WCAG AA コントラスト保証

詳細: `docs/features/color-extract/`, `docs/features/palette-design/`
参考: `docs/references/wallust/overview.md`

## MVP-2: Lua 生成 + ダウンロード

パレット JSON → Neovim ハイライトグループ割り当て → Lua ファイル出力 + ダウンロード UI。

詳細: `docs/features/lua-gen/`, `docs/features/download-ui/`

## MVP-3: プレビュー

ブラウザ上に Neovim 風コードビューアを表示。パレット変更時のリアルタイム反映。

詳細: `docs/features/preview/`

## MVP-4: 配布（未定）

Neovim プラグイン連携、GitHub Gist 出力、その他の手段を調査・決定。

詳細: `docs/features/distribution/`

## MVP-5: LP・UI デザインシステム

Sentry × Spotify ベースのダーク基調 LP。ヒーローセクションの画像ドロップ → Vim プレビュー変化が目玉。

参考: `docs/design/DESIGN-A.md`, `B.md`, `C.md`

## MVP 後の方向性

MVP が動いたら、実際に自分で使ってフィードバックを得る。改善は Issue ベースで優先順位をつけてから着手する。

候補は `docs/issue/open/` の MVP 紐付かないもの、および `docs/issue/idea/` を参照。
