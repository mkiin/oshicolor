# MVP-2/lua-gen/V01 パレット JSON から Neovim Lua ファイルを生成

## 概要

MVP-1 で生成したパレット JSON を受け取り、Neovim で `:colorscheme` で読み込める Lua ファイルを生成する。

## 設計方針

- pipeline-v1 の R4/V01（テンプレート文字列による Lua 生成）を流用・改修
- パレット JSON のスキーマに合わせて入力インターフェースを変更

## やること

- [ ] pipeline-v1 R4 の Lua 生成ロジックを新スキーマ対応に改修
- [ ] ダークテーマ/ライトテーマ両対応
- [ ] 生成した Lua の Neovim 読み込みテスト
