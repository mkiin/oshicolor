# Checkpoint: palette-v02-base16-redesign

Date: 2026-04-06 (session end)

## 完了した項目

- V01 issue.md を全面改訂 (ISSUE-1〜9 に再構成)
- V02 plan.md / spec.md を新規作成
- palette-generator を全削除して V02 として再実装
  - 型定義 (VisionResult, Palette, ThemeMood, *Slot)
  - Config (MOOD_PRESET: dark / light-pastel / light)
  - oklch-utils (culori ベース、`{ mode: "oklch" }` で色生成)
  - APCA コントラスト計算 + ensureContrast (light テーマ chroma 補償付き)
  - blend (Catppuccin 準拠 sRGB 線形補間)
  - seed-selection (hueDist × lUsability スコアリング)
  - neutral / syntax / ui / diagnostic 生成
  - generate-palette パイプライン (VisionResult + ThemeMood → Palette)
  - Jotai atoms (visionResult → mood → seeds → neutral/syntax/ui/diagnostic → palette)
  - コンポーネント 4分割 (seed-view, editor, syntax, diagnostic)
- color-analyzer の VisionResultSchema から neutral フィールド削除
- google-ai.adapter の unknown → GenericSchema 修正
- routes/index.tsx に 3ボタン mood 選択 UI 追加
- OSS リサーチ結果を issue.md 参考セクションに追加
- Color.js APCA リサーチ結果を research/ に保存

## 現在の状態

- ブランチ: dev (clean, all committed)
- pnpm lint: 0 errors (1 warning は shared/lib/contrast.ts の既存問題)
- pnpm build: 成功
- 動作確認: 画像入力 → AI 3色抽出 → mood ボタン選択 → パレット生成まで動く

## 判明した事実

- culori の `oklch()` は色空間定義であり色生成関数ではない。`{ mode: "oklch", l, c, h }` を使う
- APCA Lc=75 は dark テーマの syntax fg には厳しすぎる (L=0.85 まで押し上げてパステル化)。Lc=60 が適切
- Syntax の固定 L テーブルは seed の雰囲気を殺す。seed の L/C をベースに jitter する方が良い
- light テーマで ensureContrast が L を下げるだけだとどす黒くなる。chroma 補償が必要
- seed 選定で hue 距離だけ見ると bg/fg に被る極端な L の色を選んでしまう

## 未解決の問題

- パステル問題は改善したが、mood プリセットの数値は要調整 (特に light-pastel の Lc=45 が適切か)
- highlight-mapper (旧) は削除していない (palette-generator に統合予定だが未着手)
- lua-generator との接続が切れている (Palette → HighlightBundle の変換が必要)
- ユニットテスト未作成 (tests/features/palette-generator/)
- 26 キャラでの regression テスト未実施

## 次にやること

1. 複数キャラで dark / light-pastel / light の 3 mood を試し、数値を調整する
2. highlight-mapper を palette-generator に統合する (マッピングテーブルは spec §11 に定義済み)
3. lua-generator を Palette 型に対応させる
4. ユニットテストを tests/ に作成する
5. V01 の 26 キャラ検証データで regression テスト

## キーとなる判断・理由

- **AI の theme_tone 自動判定を廃止し、ユーザー選択制 (ThemeMood) に変更**: AI が出すパレットの雰囲気を制御できず、パステル化が避けられなかったため
- **Syntax の L/C を固定テーブルから seed ベースに変更**: キャラの「深い・鮮やか・淡い」が消えていたため
- **seed 選定に lUsability スコアを追加**: AI が bg/fg 寄りの色を出すことがあり、hue 距離だけでは不十分だったため
- **APCA Lc 閾値を mood 別に設定**: dark=60, light-pastel=45, light=60。一律 75 はパステル化の原因だった

## 次の作業開始時に読むべきドキュメント類

- `docs/projects/features/pipeline-v2/MVP-1/palette-design/V02/spec.md` — 実装仕様の最新版
- `docs/projects/features/pipeline-v2/MVP-1/palette-design/V01/issue.md` — ISSUE-1〜9 + 設計案セクション
- `src/features/palette-generator/usecases/config.ts` — MOOD_PRESET の数値
- `src/features/palette-generator/usecases/contrast.ts` — ensureContrast の chroma 補償ロジック
