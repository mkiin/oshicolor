# R2 カラースキーム生成（カラーマッピング）

抽出パレットから Neovim カラースキームの HighlightMap を自動生成する機能。

## バージョン履歴

| Ver | 核心アイデア                           | 主な問題 → 次バージョンへ                       |
| --- | -------------------------------------- | ------------------------------------------------ |
| V1  | Hue レンジで抽出色を分類               | 単色 Hue パレットで全グループが同じ色になり崩壊  |
| V2  | C値ランク(Zone A) + 補完色生成(Zone B) | 鮮やかな暗色が bg に来る / パステルで bg 崩壊    |
| V3  | bg neutral 生成 + コンセプトシステム   | k-means 12色では Hue 多様性不足 / C ランク限界   |
| V4  | node-vibrant MMCQ 64色 + mini.hues     | 生成色が浮く / HSL-OkLch 混在の複雑さ / R1 の3軸を活かせていない |
| V5  | 3 seed × tonal palette (HCT) + neutral | 各軸1色では特徴色を逃す / seed スコアリングが OkLch 依存 |
| V6  | 3 target seed (V/DV/LV) × 閾値段階緩和 | seed 数が軸・キャラで 1〜3 にばらつく / tonal palette 以降は未実装 |
| V7  | V + DV/LV 競合選定で seed 数固定化 | node-vibrant HSL ベースで colorthief の Vibrant と不一致 |
| V8  | colorthief 準拠 OkLch Vibrant + Muted | 軸ベースが不必要に複雑 / 上位5色にない特徴色の欠落 / 単調な seed 構成 |
| V9  | ドミナント5色 seed + ハイライトグループ割り当て | neutral 源が無精査 / seed ロール概念なし / アクセント色なし / 全体的に渋い |
| V10 | neutral 源ユーザー選択 + WCAG コントラスト保証 + ロールベース可変長割り当て | V1〜V10 で全自動の構造的限界が証明された。手動 preview の方がバランス良好 |
| V11 | 半自動 象徴色 + 調和色生成。ユーザーが 2〜3 色選択 → 調和色 5〜6 色を生成 → 計 8 色アクセント。スクラップ＆ビルド | 開発中 |

## 設計変遷

```
V1: "Hue レンジで色を分ければ構文色に割り当てられる"
     → 単色パレットで崩壊

V2: "Hue ではなく C 値ランクで割り当てれば崩れない"
     → bg が鮮やかな暗色になる / パステルで bg 崩壊

V3: "bg は抽出色から取らず neutral 生成する（Material You 方式）"
     + コンセプト 3種（darkClassic / darkMuted / lightPastel）
     → k-means の 12色では Hue カバレッジが足りない

V4: "node-vibrant の MMCQ 64色で Hue カバレッジを拡大"
     + mini.hues の等間隔グリッド → 画像色で上書き
     + chroma damping で遠い色相を控えめに
     → 生成色が浮く / R1 の3軸を活かせていない

V5: "R1 の3軸から seed → HCT tonal palette で展開"
     + neutral palette で bg 階層を構造的に生成
     + Tone 差で WCAG AA コントラストを保証
     → 各軸1色では特徴色を逃す

V6: "3 target seed（V/DV/LV）× 閾値段階緩和で軸あたり最大3色"
     + node-vibrant の Vibrant/DarkVibrant/LightVibrant target
     + 色合成フォールバック廃止 → 閾値緩和で軸内の色を使い切る
     → seed 数が 1〜3 でばらつく

V7: "V + DV/LV 競合選定で seed 数を固定 6"
     + 2色目は DV/LV の距離比較で近い方を採用
     + キャラによって DV/LV が自動選択される
     → node-vibrant HSL ベースで colorthief の Vibrant と不一致

V8: "colorthief 準拠 OkLch Vibrant + Muted"
     + colorthief の swatches.ts と同じスコアリング
     + population を正規化加算
     + 範囲フィルタ廃止（軸内少数色に対応）

V9: "ドミナント5色 seed + ハイライトグループ割り当て"
     + 軸ベース廃止 → getPalette(colorCount: 5) のドミナント5色をそのまま seed
     + neutral palette（d1.hue + 極小 chroma + L 9段階）
     + 5 seed → 66 ハイライトグループ割り当て
     → neutral 源が無精査 / seed ロール概念なし / アクセント色なし

V10: "neutral 源ユーザー選択 + WCAG コントラスト保証 + ロールベース可変長割り当て"
     + Muted 系 swatch からユーザーがタブで neutral 源を選択
     + WCAG コントラスト比ベースの動的 L 調整（固定 L clamp 廃止）
     + dominant 5 + Vibrant 系の候補プールからスコアリングで可変長ロール割り当て
     + 各ロールから 3トーン展開（fg / dim / bold）
     → V1〜V10 で全自動の構造的限界が証明された

V11: "半自動 象徴色 + 調和色生成（スクラップ＆ビルド）"
     + 全自動 → 半自動へ転換。ユーザーが象徴色を 2〜3 色タップ
     + 調和色 5〜6 色を生成（同系統 L/C バリエーション + 独立 Hue の調和色）
     + 計 8 色アクセントパレット → syntax ロール + UI 強調に割り当て
     + highlight-mapper 配下はスクラップ＆ビルド（oklch-utils のみ流用）
     + contrast 保証は 2 段構え: 生成時 L 設定 + contrastRatio() 検証
     → 開発中
```

## 現行: V11

[`V11/plan.md`](V11/plan.md)

## VX/ 配下のファイル命名規則

| ファイル        | 役割                                   | 必須 |
| --------------- | -------------------------------------- | ---- |
| `plan.md`       | なぜこの版が必要か + 設計方針 + 変更点 | Yes  |
| `spec.md`       | アルゴリズム/実装の詳細仕様            | Yes  |
| `issues.md`     | この版で判明した課題・限界             | 任意 |
| `research.md`   | 外部調査・業界事例                     | 任意 |
