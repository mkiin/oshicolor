# Checkpoint: palette-design-v01-spec

Date: 2026-04-05 01:30

## 完了した項目

- MVP-1/palette-design V01 の plan.md 作成（隙間充填アルゴリズム方針）
- MVP-1/palette-design V01 の spec.md 作成（全 11 セクション）
- issue.md のレビュー反映（P0-1,2,3 / P1-6 / P2-7,9 の 6 件）
- test-vision-ai.ts に SVG 出力機能を追加（コミット済み: 13eecc7）
- テスト対象キャラ 24 体を選定（色相環 12 色 × genshin/starrail）
- kanagawa.nvim / tokyonight.nvim の UI 配色分析

## 現在の状態

- 作業中のファイル:
  - `docs/projects/features/pipeline-v2/MVP-1/palette-design/V01/plan.md`（未コミット）
  - `docs/projects/features/pipeline-v2/MVP-1/palette-design/V01/spec.md`（未コミット）
- ブランチ: dev

## 判明した事実

- 等間隔色相グリッドは AI 3 色との相性が悪い → 隙間充填方式を採用
- ensureContrast は dark 専用だった → light 対応の双方向版が必要
- sRGB gamut 外の色が生成される可能性 → chroma reduction 優先の gamutClamp が必要
- color8 (error) は C に下限 0.12 が必要（淡いキャラでも目立つように）
- UI 配色分析から: tokyonight は accent (blue) を TabLineSel/FolderName/CursorLineNr に繰り返し配置し一体感を出す
- kanagawa は gutter 専用 bg を持ち、editor bg との段差で空間分離を表現
- Valibot を新規コードで採用（Zod からの全体移行は別タスク）

## 未解決の問題

- bg_gutter を neutral 派生に追加するか（kanagawa 方式）
- TabLineSel を反転表示（tokyonight 式: accent bg + black fg）にするか控えめ（kanagawa 式）にするか
- fg 系 neutral の C を bg.c（無彩色）にするか min(fg.c, 0.03) にするか → 24 キャラ SVG 検証後に判断
- NvimTree / neo-tree 等の file tree ハイライトグループの追加範囲

## 次にやること

- 未解決の UI 配色判断を決定し、spec.md に追記
- plan.md / spec.md をコミット
- 24 キャラ分の AI Vision 実行（test-vision-ai.ts で JSON + SVG 生成）
- palette-generator の実装開始（hue-gap.ts → accent-palette.ts → neutral-palette.ts の順）
- ユニットテスト作成（computeGaps, fillGaps を優先）

## キーとなる判断・理由

- **隙間充填 > 等間隔グリッド:** AI 3 色が色相環上でどんな配置でも、残りの色が最大限に散る。等間隔グリッドは AI 色との上書き衝突が起きる
- **chroma reduction 優先:** gamut mapping で色相と明度を保ちたい。彩度を犠牲にする方が知覚的な色の変化が小さい
- **tokyonight 式の accent 繰り返し:** UI の「額縁」に color1 を反復配置するとキャラらしさが出る（友人レビューの核心）
- **Valibot 採用:** tree-shaking が Zod より優れている（Cloudflare Workers のバンドルサイズに影響）

## 次の作業開始時に読むべきドキュメント類(重点を絞って)

- `docs/projects/features/pipeline-v2/MVP-1/palette-design/V01/spec.md` — 実装仕様の全体
- `docs/projects/features/pipeline-v2/MVP-1/palette-design/V01/issue.md` — レビュー指摘と対応状況
- `docs/projects/features/pipeline-v2/MVP-1/ai-vision/V01/plan.md` — AI 出力スキーマの定義
