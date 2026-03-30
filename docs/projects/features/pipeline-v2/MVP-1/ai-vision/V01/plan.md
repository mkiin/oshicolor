# MVP-1/ai-vision/V01 Gemini Flash による色抽出+ラベリング

## 概要

キャラクターイラストから Gemini Flash (Vision) を使って色を抽出し、象徴色判定+テーマトーン判定+neutral 提案を行う。

## 設計方針

- AI の役割は**色抽出+ラベリング+テーマ判定**に絞る
- パレット設計（OKLCH 変換、コントラスト保証、色相グリッド生成）はアルゴリズム側で行う
- モデル: `gemini-flash-latest`（無料枠で十分、精度も高い）
- Gemini の構造化出力（JSON mode）を活用し、出力の信頼性を担保する

## AI 出力スキーマ

```json
{
  "impression": {
    "primary": { "hex": "#xxxxxx", "part": "eye | hair | outfit | accessory", "reason": "string" },
    "secondary": { "hex": "#xxxxxx", "part": "eye | hair | outfit | accessory", "reason": "string" },
    "tertiary": { "hex": "#xxxxxx", "part": "eye | hair | outfit | accessory", "reason": "string" }
  },
  "theme_tone": "dark | light",
  "neutral": {
    "bg_base_hex": "#xxxxxx",
    "fg_base_hex": "#xxxxxx"
  }
}
```

### フィールド説明

**impression**: キャラクターの象徴色 3 色。palette-design の入力として使用する。
- primary: 最も象徴的な色
- secondary: 2 番目に印象的な色
- tertiary: 3 番目の色（**必須。必ず 3 色抽出する**）
- part: 色の出典パーツ（参考値。palette-design では使用しない）

**part の許可値（4 種）**: eye, hair, outfit, accessory
- 1 エントリにつき part は 1 つだけ（複合禁止）

**theme_tone**: キャラクターの全体的な色調からダーク/ライトテーマを自動判定。

**neutral**: エディタの背景/前景色の提案値。
- bg_base_hex: テーマトーンに応じた暗色 or 明色。キャラの色相で微かに色づく
- fg_base_hex: bg の対となるテキスト色
- 注: AI の出力は参考値。palette-design 側で OKLCH 調整する可能性あり（V02 以降で検討）

## プロンプト設計

- 英語プロンプト（モデルの精度が高い）
- tertiary は必須であることを明記
- part の許可値を明示し、複合記述を禁止する指示を含める
- Gemini の `responseMimeType: "application/json"` + `responseSchema` で構造化出力を使用

## 検証結果（リサーチ済み）

| モデル | キャラ認識 | 色精度 | 速度 | コスト |
|---|---|---|---|---|
| gemini-flash-latest | 高（キャラ名特定可） | 高 | ~11秒 | 無料枠内 |
| gemini-flash-lite-latest | 中 | 中 | ~5秒 | 無料枠内 |
| llama-4-scout-17b (Workers AI) | 低 | 低（ハルシネーション多） | ~10秒 | 無料枠内 |

→ **gemini-flash-latest を採用**

テスト済みキャラ: Acheron, Amber, Albedo, Alhaitham, Hyacine
- dark/light 判定: Hyacine（ピンク系）で light が正しく出力された
- neutral: bg がキャラの色味を帯びている（Acheron=紫がかった黒、Amber=暖色がかった黒）

## エラーハンドリング方針

- 429 (rate limit) / 503 (一時エラー): 1 回リトライ（exponential backoff）
- コンテンツフィルタブロック: エラーとしてユーザーに通知
- JSON パースエラー: Zod バリデーションで検出し、ユーザーに通知

## やること

- [x] Vision AI モデル比較検証
- [x] プロンプトの基本設計
- [x] theme_tone 判定の検証
- [ ] AI 出力スキーマの Zod バリデーション定義
- [ ] Gemini API クライアント実装（JSON mode 対応）
- [ ] プロンプトの確定（part 4 種、tertiary 必須）
- [ ] エラーハンドリング実装
