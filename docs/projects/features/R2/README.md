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
| V8  | colorthief 準拠 OkLch Vibrant + Muted | — |
| V9  | ハイライトグループ割り当て（66グループ） | 開発中 |

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

V9: "ハイライトグループ割り当て（66グループ）"
     + neutral palette（main-V.hue + 極小 chroma + L 9段階）
     + seed → fg 色変換（L 調整でコントラスト保証）
     + diagnostic 色（固定 hue + tone 合わせ）
     → 開発中
```

## 現行: V9

[`V9/plan.md`](V9/plan.md)

## VX/ 配下のファイル命名規則

| ファイル        | 役割                                   | 必須 |
| --------------- | -------------------------------------- | ---- |
| `plan.md`       | なぜこの版が必要か + 設計方針 + 変更点 | Yes  |
| `spec.md`       | アルゴリズム/実装の詳細仕様            | Yes  |
| `issues.md`     | この版で判明した課題・限界             | 任意 |
| `research.md`   | 外部調査・業界事例                     | 任意 |
