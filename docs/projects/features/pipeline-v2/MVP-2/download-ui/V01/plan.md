# MVP-2/download-ui/V01 Lua ファイルダウンロード UI

## 概要

生成した Lua ファイルをブラウザからダウンロードできるボタンを実装する。

## 設計方針

- Blob + URL.createObjectURL でクライアントサイドダウンロード
- ファイル名: `{character_name}.lua`（AI 出力の character_name を使用）

## やること

- [ ] ダウンロードボタンコンポーネント
- [ ] Lua 文字列 → Blob → ダウンロード処理
