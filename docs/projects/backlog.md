# Backlog

GitHub Issues の俯瞰用。詳細は各 Issue を参照。
スプリント計画時に `/sprint-plan` がこのファイルを参照する。

## MVP-1: AI 色抽出+パレット生成

- [x] Vision AI モデル比較検証（Gemini Flash / Flash Lite / Workers AI）
- [ ] AI 出力スキーマの確定（Zod バリデーション）
- [ ] AI 出力 → パレット設計アルゴリズムの実装
- [ ] コントラスト保証（WCAG AA）の組み込み
- [ ] ダーク/ライトテーマ自動判定ロジック
- [ ] neutral（bg/fg）生成ロジック
- [ ] E2E: 画像1枚 → パレット JSON 出力の確認

## MVP-2: Lua 生成+ダウンロード

- [ ] パレット JSON → ハイライトグループ割り当て
- [ ] Lua ファイル生成（pipeline-v1 R4 を流用）
- [ ] ダウンロードボタン UI

## MVP-3: プレビュー

- [ ] Neovim 風プレビュー（pipeline-v1 R5 を流用）
- [ ] パレット変更時のリアルタイム反映

## MVP-4: 配布（未定）

- [ ] 配布方法の調査・決定

## MVP-5: LP・UIデザインシステム

- [ ] デザインテーマの決定（Sentry × Spotify 案を軸に検討）
  - 候補A: Spotify × Linear（achromatic劇場+精密typography）
  - 候補B: Sentry × Spotify（warm purpleダーク+frosted glass）推し
  - 候補C: Sanity × Resend（純黒void+結晶ボーダー）
- [ ] sample-repo/awesome-design-md から選定した DESIGN.md を AI に食わせて LP 生成
- [ ] ヒーローセクション: 画像ドロップ → Vim プレビュー変化のインタラクション
- [ ] ダーク基調 UI（Vim/Neovim ユーザー向け）
- [ ] パレットが主役になる achromatic な器の設計
- [ ] キャッチコピー: 推し色でエディタを染めろ！

## 改善（MVP 後）

- [ ] パレット手動編集 UI
- [ ] ダーク/ライト手動切り替え

## アイデア（いつか）

- [ ] 複数画像からのテーマ生成
- [ ] CSS / JSON / ターミナル向けエクスポート
- [ ] コミュニティギャラリー
- [ ] 多言語対応
