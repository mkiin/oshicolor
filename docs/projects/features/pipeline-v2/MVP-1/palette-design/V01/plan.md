# MVP-1/palette-design/V01 AI 3色からの隙間充填パレット生成

## 概要

ai-vision の出力（象徴色 3 色 + theme_tone + neutral bg/fg）を受け取り、
色相環の隙間充填アルゴリズムで残り色を導出し、Neovim カラースキーム用パレット JSON を生成する。

## 設計方針

- AI の 3 色（primary / secondary / tertiary）はそのまま color1〜3 に割り当てる
- 残り 5 色は **色相環上の最大ギャップを動的に分割** して導出する（隙間充填）
- 等間隔グリッドは使わない。AI 3 色がどんな配置でも色相が最大限に散る
- L（明度）と C（彩度）は AI 3 色の統計値から機械的に揃える
- color8（error 用）は hue 固定。意味色なのでキャラに依存させない
- neutral 派生は AI 提案の bg/fg を OKLCH で検証・補正し、L オフセットで生成

## AI 出力スキーマ（入力）

```json
{
  "impression": {
    "primary": { "hex": "#xxxxxx", "reason": "string" },
    "secondary": { "hex": "#xxxxxx", "reason": "string" },
    "tertiary": { "hex": "#xxxxxx", "reason": "string" }
  },
  "theme_tone": "dark | light",
  "neutral": {
    "bg_base_hex": "#xxxxxx",
    "fg_base_hex": "#xxxxxx"
  }
}
```

## パレット生成アルゴリズム

### Step 1: AI 3 色を OKLCH に変換し、直接割り当て

```
primary.hex   → OKLCH (H_p, C_p, L_p) → color1 (keyword)
secondary.hex → OKLCH (H_s, C_s, L_s) → color2 (function)
tertiary.hex  → OKLCH (H_t, C_t, L_t) → color3 (constant)
```

### Step 2: 色相環の隙間充填で color4〜7 を導出

```
1. AI 3 色の色相 [H_p, H_s, H_t] を色相環 (0°〜360°) にプロットする
2. 3 色間の角度ギャップを計算する（時計回りで 3 区間）
3. ギャップを大きい順にソートする
4. 最大ギャップの中間に color4 を配置する
5. 次に大きいギャップ（color4 で分割された区間を含む）の中間に color5 を配置する
6. 同様に color6, color7 を配置する
```

例（Albedo: H_p=40°, H_s=230°, H_t=80°）:

```
色相環上: 40° --- 80° --- 230° --- (360°/0°) --- 40°
ギャップ: 40°→80° = 40°, 80°→230° = 150°, 230°→40° = 170°

最大ギャップ 230°→40° (170°) → 中間 315° → color4
次のギャップ 80°→230° (150°) → 中間 155° → color5
残りの区間を分割 → color6, color7
```

### Step 3: color8 は hue 固定

```
color8 = hue 25° (赤系) → error / diagnostic 用
```

error は「赤 = 危険」という意味色。キャラの色とは独立に固定する。

### Step 4: L と C の調整（color4〜8）

導出した色相に対して、明度と彩度を統一的に設定する:

```
C_target = median(C_p, C_s, C_t) × 0.9
  → AI 3 色の中央値の 9 割。派手すぎず馴染む

dark theme:
  L_target = 0.75（bg L=0.14 との WCAG AA コントラスト確保圏内）

light theme:
  L_target = 0.45（bg L=0.95 との WCAG AA コントラスト確保圏内）

最終的に ensureContrast() で bg とのコントラスト比 4.5 以上を保証する
```

### Step 5: variant 生成

```
color1_variant = color1 の C を 0.6 倍（彩度を落として tag 用）
color3_variant = color3 の L を +0.08 (dark) / -0.08 (light)（明度違いで number 用）
```

## 8 色の割り当て

| slot | 生成元 | syntax role | 色相の決め方 |
|---|---|---|---|
| color1 | AI primary | keyword, statement | そのまま |
| color2 | AI secondary | function | そのまま |
| color3 | AI tertiary | constant, boolean | そのまま |
| color4 | 隙間充填 1 | string, character | 最大ギャップの中間 |
| color5 | 隙間充填 2 | type | 次のギャップの中間 |
| color6 | 隙間充填 3 | special, builtin | 残りギャップ |
| color7 | 隙間充填 4 | preproc, parameter | 残りギャップ |
| color8 | hue 固定 25° | error, diagnostic | 固定 |

## neutral 派生ルール

### AI 出力の検証・補正

```
bg_base_hex → OKLCH に変換
  dark:  L が 0.10〜0.18 外なら補正、C > 0.02 なら 0.015 に補正
  light: L が 0.92〜0.98 外なら補正、C > 0.02 なら 0.015 に補正
  H はそのまま（AI が選んだ色相を尊重）

fg_base_hex → OKLCH に変換
  dark:  L が 0.82〜0.92 外なら補正
  light: L が 0.15〜0.25 外なら補正
  H はそのまま
```

### 派生色の生成

```
bg_base → bg
  bg_surface     = bg の L +0.02
  bg_cursor_line = bg の L +0.03
  bg_visual      = bg の L +0.06
  bg_popup       = bg の L +0.04

fg_base → fg
  comment   = L 0.45
  line_nr   = L 0.40
  border    = L 0.30
  delimiter = L 0.60
```

## 出力スキーマ（パレット JSON）

```json
{
  "theme_tone": "dark | light",
  "neutral": {
    "bg": "#xxxxxx",
    "fg": "#xxxxxx",
    "bg_surface": "#xxxxxx",
    "bg_cursor_line": "#xxxxxx",
    "bg_visual": "#xxxxxx",
    "bg_popup": "#xxxxxx",
    "comment": "#xxxxxx",
    "line_nr": "#xxxxxx",
    "border": "#xxxxxx",
    "delimiter": "#xxxxxx"
  },
  "accent": {
    "color1": "#xxxxxx",
    "color1_variant": "#xxxxxx",
    "color2": "#xxxxxx",
    "color3": "#xxxxxx",
    "color3_variant": "#xxxxxx",
    "color4": "#xxxxxx",
    "color5": "#xxxxxx",
    "color6": "#xxxxxx",
    "color7": "#xxxxxx",
    "color8": "#xxxxxx"
  },
  "ui": {
    "navigation": "#xxxxxx",
    "attention": "#xxxxxx",
    "frame": "#xxxxxx",
    "search_bg": "#xxxxxx",
    "pmenu_sel_bg": "#xxxxxx"
  }
}
```

## ui 色の導出

AI 3 色の「象徴色の順位」は「UI 映えする順位」とは限らない。
bg/fg とのコントラスト比で UI に使える色を判定し、彩度順にロールを割り当てる。

```
Step 1: assignUiRoles()
  3 色それぞれについて bg/fg とのコントラスト比を算出
  UI 適格条件: bgCR >= 3.0 AND fgCR >= 2.0
  適格色を C(彩度) 降順でソート → navigation, attention に割り当て

Step 2: deriveUiColors()
  ui.navigation  = roles で選ばれた色（TabLineSel, FolderName, RootFolder）
  ui.attention   = roles で選ばれた色（CursorLineNr, Git dirty）
  ui.frame       = navigation 色の低彩度派生（FloatBorder, WinSeparator）
  ui.search_bg   = navigation 色の L を 0.30 (dark) / 0.85 (light) に
  ui.pmenu_sel_bg = bg_visual と同値
```

frame の派生定数は暫定値。24 キャラの SVG 検証後に調整する。

## やること

- [ ] 色相環ギャップ計算ユーティリティ
- [ ] 隙間充填アルゴリズム実装
- [ ] AI 3 色の L/C 統計から target L/C を算出
- [ ] neutral 検証・補正ロジック
- [ ] neutral 派生色生成
- [ ] variant 生成
- [ ] UI ロール割り当て（assignUiRoles: コントラスト判定 + 彩度順）
- [ ] ui 色導出（deriveUiColors: frame = navigation 派生）
- [ ] コントラスト保証（WCAG AA）
- [ ] パレット JSON の Valibot スキーマ定義
- [ ] テスト用 SVG 出力で視覚検証
