# R2 カラースキーム生成（カラーマッピング）

抽出パレットから Neovim カラースキームの HighlightMap を自動生成する機能。
抽出パレットから Neovim カラースキームの HighlightMap を自動生成する機能。

## バージョン履歴

| Ver | 核心アイデア                           | 主な問題 → 次バージョンへ                       |
| --- | -------------------------------------- | ------------------------------------------------ |
| V1  | Hue レンジで抽出色を分類               | 単色 Hue パレットで全グループが同じ色になり崩壊  |
| V2  | C値ランク(Zone A) + 補完色生成(Zone B) | 鮮やかな暗色が bg に来る / パステルで bg 崩壊    |
| V3  | bg neutral 生成 + コンセプトシステム   | k-means 12色では Hue 多様性不足 / C ランク限界   |
| V4  | node-vibrant MMCQ 64色 + mini.hues     | 生成色が浮く / HSL-OkLch 混在の複雑さ / R1 の3軸を活かせていない |
| V5  | 3 seed × tonal palette (HCT) + neutral | 各軸1色では特徴色を逃す / seed スコアリングが OkLch 依存 |
| V6  | 明度2分割 seed (Vibrant/DarkVibrant) × tonal palette | デバッグ SVG のみ実装。tonal palette 生成・ロール割り当て・HighlightMap は未実装 |

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

V6: "明度2分割 seed（Vibrant/DarkVibrant）で軸あたり2色"
     + node-vibrant target 方式でスコアリング
     + bright → syntax、dark → UI アクセントの用途分担
     → デバッグ SVG のみ。tonal palette 以降は未実装
```

## 現行: V6

[`V6/spec.md`](V6/spec.md)

## VX/ 配下のファイル命名規則

| ファイル        | 役割                                   | 必須 |
| --------------- | -------------------------------------- | ---- |
| `plan.md`       | なぜこの版が必要か + 設計方針 + 変更点 | Yes  |
| `spec.md`       | アルゴリズム/実装の詳細仕様            | Yes  |
| `issues.md`     | この版で判明した課題・限界             | 任意 |
| `research.md`   | 外部調査・業界事例                     | 任意 |
