# R2/V6 課題

## 未実装

- **tonal palette 生成（Step 2）**: 各 seed の hue/chroma を保ち HCT Tone 0〜100 のスケールを生成する処理。neutral palette 含む
- **ロール割り当て（Step 3）**: palette × Tone 値で syntax / UI ロールを決定する関数
- **ハイライトマッピング（Step 4）**: ロールから HighlightMap への展開

## チューニング

- **閾値パラメータ**: `INITIAL_THRESHOLD = 0.4` / `THRESHOLD_STEP = 0.2` は仮値。SVG 出力を見ながら調整が必要
- **target 優先順**: 現在 V → DV → LV の固定順。軸ロール（main/sub/accent）によって優先順を変えるべきか未検討

## 移植

- 現在の実装は `scripts/gen-palette-svg-sharp.ts`（デバッグスクリプト）のみ。本番コード `src/features/` への移植が必要
