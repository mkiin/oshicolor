# Checkpoint: palette-v01-pipeline-refinement

Date: 2026-04-06 深夜

## 完了した項目

- 論文ベースの改善 6 件を test-palette-v01.ts に実装
  - stabilizeHue (低彩度→Tinted Gray)、enforceMinHueGap (ΔH≥30°)、Luminance Jittering、gamutClamp→culori clampChroma、Oklab距離によるUI選択、checkDiscrimination (ΔE≥0.08)
- fixDiscrimination 自動修正を実装 (BUG-1, BUG-2, WARN-1 修正済み)
- Gemini で 22 キャラの AI 入力データ取得 (合計 26 キャラ)
- test-vision-ai.ts を Google GenAI SDK + valibot Structured Output に書き換え
- ダーク固定化 → ユーザー判断で撤回、dark/light 両対応に戻した
- light テーマ bg の lMax を 0.98→0.95 に修正
- neutral bg 階層の ΔL 改善 (cursor_line: 0.03→0.05, visual: 0.06→0.08)
- bg_cursor_line に C+0.01、bg_visual に navigation hue + C=0.04 を導入
- UI ロール割り当てを刷新: navigation=primary(ensureContrast済み)、attention=primary との距離×彩度最大
- theme_tone の AI 判定理由を「ユーザー体験ベース」に変更
- 出力ディレクトリ構造を `{game}/json/` + `{game}/svg/` に統一
- plan.md, spec.md, issue.md をすべて更新

## 現在の状態

- 作業中のファイル: scripts/test-palette-v01.ts, scripts/test-vision-ai.ts
- working tree clean (全コミット済み)

## 判明した事実

- AI の tertiary は大半が低彩度（ゴールド、白、暗灰）で有彩色は少数派
- 26 キャラ中 17 キャラで primary が ensureContrast により変色する (dark bg との CR < 4.5)
- tokyonight の navigation (blue) は C=0.13 で彩度を落としていない。落ち着いて見えるのは blue という色相の特性
- tokyonight の bg 階層: bg→highlight ΔL=0.08, visual は別系統の色 (blue0)
- light テーマの bg は L=0.97-0.98 だと眩しすぎる。catppuccin-latte (0.958) 程度が妥当

## 未解決の問題

- Aglaea / Kafka で弁別性不足ペアが残る（AI 3 色の色相が極端に近い）
- frame / search_bg / pmenu_sel の定数値は暫定（24 キャラ検証後に調整）
- vision SVG 生成関数がスクリプトに残っている（使わないなら削除）

## 次にやること

- 26 キャラの SVG 出力を目視レビューし、色の品質を確認
- 弁別性不足キャラ (Aglaea, Kafka) の対策検討
- src/features/palette-generator/ への本実装
- ユニットテスト作成

## キーとなる判断・理由

- navigation = primary そのまま (C 調整なし): tokyonight の blue が C=0.13 で彩度を落としていないことを確認。彩度を落とすと「支える色」ではなく「鈍い色」になる
- attention = primary との距離×彩度最大: 距離だけだと暗い茶色が選ばれる問題を解消
- bg_visual に navigation hue を使用: tokyonight が visual に blue0 を使っているのと同じ発想。キャラのアイデンティティを選択範囲にも反映
- theme_tone 判定: AI に「大半は dark、パステル系のみ light」と指示 (D案)

## 次の作業開始時に読むべきドキュメント類

- docs/projects/features/pipeline-v2/MVP-1/palette-design/V01/issue.md — 未解決問題の一覧
- docs/projects/features/pipeline-v2/MVP-1/palette-design/V01/spec.md — 最新仕様
- scripts/test-palette-v01.ts — 現在のパイプライン実装
- scripts/test-vision-ai.ts — AI Vision スクリプト (GenAI SDK + valibot)
