# MVP-1/palette-design/V01 AI 3色からの隙間充填パレット生成

## 概要

ai-vision の出力（象徴色 3 色 + theme_tone + neutral bg/fg）を受け取り、
色相環の隙間充填アルゴリズムで残り色を導出し、Neovim カラースキーム用パレット JSON を生成する。

## 設計方針

- AI の 3 色（primary / secondary / tertiary）はそのまま color1〜3 に割り当てる
- 残り 5 色は **色相環上の最大ギャップを動的に分割** して導出する（隙間充填）
- 等間隔グリッドは使わない。AI 3 色がどんな配置でも色相が最大限に散る
- L（明度）は **Luminance Jittering** で gap-filled 色ごとに分散させる（O'Donovan 2011）
- C（彩度）は AI 3 色の統計値から機械的に揃える
- 低彩度入力 (C < 0.015) は hue 不定として primary の hue を借用する（Tinted Gray）
- 隣接色相の最小距離 ≥ 30° を保証する（Cohen-Or 2006 簡易適用）
- accent 色間の弁別性 ΔE_ok ≥ 0.08 を検証する（Gramazio 2017 Colorgorical）
- color8（error 用）は hue 固定。意味色なのでキャラに依存させない
- neutral 派生は AI 提案の bg/fg を OKLCH で検証・補正し、L オフセットで生成
- gamut mapping は culori の clampChroma を使用（Ottosson 2020 Oklab）
- UI ロール割り当ては Oklab 距離で bg からの知覚的距離を考慮する

## 理論的根拠

| 論文 / リサーチ | 適用箇所 |
|---|---|
| Ottosson (2020) "A perceptual color space for image processing" | Oklab/OKLCH 色空間、gamut mapping、距離計算 |
| Cohen-Or et al. (SIGGRAPH 2006) "Color Harmonization" | 色相テンプレート → 最小色相距離 ≥ 30° |
| O'Donovan et al. (SIGGRAPH 2011) "Color Compatibility From Large Datasets" | 調和パレットは lightness variance が高い → L 分散 |
| Gramazio et al. (2017) "Colorgorical" | accent 間 ΔE_ok ≥ 0.08 で弁別性保証 |
| Solarized (Schoonover) | 数学的 L ステップ均等設計の実例 |
| JND in Oklab: ΔE_ok ≈ 0.02 | 低彩度閾値 C < 0.015 の根拠 |

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

### Step 0: 低彩度入力の補正 (stabilizeHue)

```
AI 3 色を OKLCH に変換
primary は常にそのまま
secondary / tertiary の C < 0.015 の場合:
  → hue を primary.h に置換（知覚的に hue 不定のため）
  → C を 0.025 に引き上げ（Tinted Gray 化）
```

**根拠:** Oklab の JND (ΔE_ok ≈ 0.02) から、C < 0.015 では色相の変化は知覚不可能。
真の無彩色を配置すると同時対比による錯覚が発生するため、意図的に着色する。

### Step 1: AI 3 色を OKLCH に変換し、直接割り当て

```
primary.hex   → OKLCH (H_p, C_p, L_p) → color1 (keyword)
secondary.hex → OKLCH (H_s, C_s, L_s) → color2 (function)
tertiary.hex  → OKLCH (H_t, C_t, L_t) → color3 (constant)
※ Step 0 で低彩度補正済みの値を使用
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

### Step 2.5: 最小色相距離保証 (enforceMinHueGap)

```
gap-fill 後、全色相ペア（seed + filled）が ΔH ≥ 30° を満たすか検証
30° 未満のペアがあれば、filled 色のみを互いに離れる方向に押す
seed（AI 入力）は固定、filled のみ調整対象
最大 10 回イテレーション
```

**根拠:** Cohen-Or (2006) の色相テンプレート理論の簡易適用。
近接色相は知覚的に区別しにくいため、最小距離を保証する。

### Step 3: L と C の調整（color4〜8）

導出した色相に対して、彩度と明度を設定する:

```
C_target = median(C_p, C_s, C_t) × 0.9
  → AI 3 色の中央値の 9 割。派手すぎず馴染む

L は Luminance Jittering で色ごとに分散させる:
  dark:  [0.68, 0.76, 0.72, 0.80] — 中心 0.74
  light: [0.42, 0.50, 0.46, 0.38] — 中心 0.44

color8 (error): L は dark=0.72, light=0.45 固定

最終的に ensureContrast() で bg とのコントラスト比 4.5 以上を保証する
```

**なぜ L を分散させるか (O'Donovan 2011):**
全 gap-filled 色を同一 L にすると単調になり、弁別性が低下する。
O'Donovan の研究で「調和的なパレットは lightness variance が高い」ことが示されている。
隣接 ΔL=0.04、非隣接 ΔL≥0.08 で視覚的区別を確保する。

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
  light: L が 0.92〜0.95 外なら補正、C > 0.02 なら 0.015 に補正
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
  bg_cursor_line = bg の L +0.05
  bg_visual      = bg の L +0.08
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

## ハイライトグループ マッピング定義

最終的に accent 10 色 + neutral 系 + ui 系を以下のグループにマッピングする。

### パレット → Vim デフォルトグループ（20）

| グループ | パレット色 | 備考 |
|---|---|---|
| Normal | fg / bg | メインテキスト |
| Comment | neutral.comment | italic |
| Constant | color3 | AI tertiary |
| String | color4 | 隙間充填 1 |
| Character | → String | link |
| Number | color3_variant | color3 の明度違い |
| Boolean | color3, bold | AI tertiary + 太字で区別 |
| Float | → Number | link |
| Identifier | fg | 通常テキスト色 |
| Function | color2 | AI secondary |
| Statement | color1, bold | AI primary |
| Keyword | → Statement | link |
| Conditional | → Statement | link |
| Repeat | → Statement | link |
| Label | → Statement | link |
| Exception | → Statement | link |
| Operator | fg | 前景色 |
| PreProc | color7 | 隙間充填 4 |
| Include | → PreProc | link |
| Define | → PreProc | link |
| Macro | → PreProc | link |
| Type | color5 | 隙間充填 2 |
| StorageClass | → Type | link |
| Structure | → Type | link |
| Typedef | → Type | link |
| Special | color6 | 隙間充填 3 |
| SpecialChar | → Special | link |
| Tag | color1_variant | keyword の低彩度派生 |
| Delimiter | neutral.delimiter | 低彩度 |
| Error | color8_bg | 背景版 |
| Todo | ui.navigation, bold | |

### パレット → Treesitter グループ（30+）

| グループ | リンク先 / 色 | 備考 |
|---|---|---|
| @variable | fg | 通常テキスト |
| @variable.builtin | → Special | self/this |
| @variable.parameter | color7 | parameter |
| @variable.member | → Identifier | フィールド |
| @constant | → Constant | |
| @constant.builtin | → Special | true/nil |
| @constant.macro | → Macro | |
| @string | → String | |
| @string.escape | → SpecialChar | |
| @string.regexp | color6 | special 系 |
| @string.special.url | → Underlined | |
| @number | → Number | |
| @number.float | → Float | |
| @boolean | → Boolean | |
| @function | → Function | |
| @function.builtin | → Special | |
| @function.call | → Function | |
| @function.method | → Function | |
| @function.method.call | → Function | |
| @function.macro | → Macro | |
| @constructor | → Special | |
| @keyword | → Keyword | |
| @keyword.function | → Keyword | function/def |
| @keyword.return | color1, bold | 強調 |
| @keyword.conditional | → Conditional | |
| @keyword.repeat | → Repeat | |
| @keyword.import | → Include | |
| @keyword.operator | → Operator | and/or/not |
| @keyword.exception | → Exception | |
| @operator | → Operator | |
| @type | → Type | |
| @type.builtin | → Special | |
| @property | → Identifier | className |
| @module | → Identifier | namespace |
| @label | → Label | |
| @attribute | → Special | decorator |
| @punctuation.delimiter | → Delimiter | , ; |
| @punctuation.bracket | → Delimiter | () [] {} |
| @punctuation.special | → Special | テンプレート ${} |
| @tag | → Tag | HTML/JSX（color1_variant） |
| @tag.attribute | → Identifier | HTML 属性 |
| @tag.delimiter | → Delimiter | < > / |
| @comment | → Comment | |
| @comment.documentation | → Comment | |
| @diff.plus | color4 | string と同色 |
| @diff.minus | color8 | error と同色 |
| @diff.delta | color5 | type と同色 |
| @markup.heading | color1, bold | 見出し |
| @markup.strong | bold | |
| @markup.italic | italic | |
| @markup.link.url | → Underlined | |
| @markup.raw | → String | |

### パレット → Diagnostic + Diff（16）

| グループ | 色 | 備考 |
|---|---|---|
| DiagnosticError | color8 | hue 25° 固定 |
| DiagnosticWarn | color4 方向で暖色 | yellow 系 |
| DiagnosticInfo | color5 方向 | blue 系 |
| DiagnosticHint | color6 方向 | cyan 系 |
| DiagnosticOk | color4 | green 系 |
| DiagnosticUnderlineError | sp=color8, underline | |
| DiagnosticUnderlineWarn | sp=warn色, underline | |
| DiagnosticUnderlineInfo | sp=info色, underline | |
| DiagnosticUnderlineHint | sp=hint色, underline | |
| DiagnosticVirtualText* | → 各 Diagnostic | link |
| DiagnosticFloating* | → 各 Diagnostic | link |
| DiagnosticSign* | → 各 Diagnostic | link |
| DiffAdd | color4_bg | green 系背景 |
| DiffChange | color5_bg | blue 系背景 |
| DiffDelete | color8_bg | red 系背景 |
| DiffText | color4_bg 明るめ | 変更箇所のテキスト |

### パレット → UI

| グループ | 色 | 備考 |
|---|---|---|
| CursorLine | neutral.bg_cursor_line | |
| CursorLineNr | **ui.attention**, bold | キャラの色でカーソル位置を示す |
| LineNr | neutral.line_nr | |
| SignColumn | neutral.bg | editor bg と同一 |
| Visual | neutral.bg_visual | |
| Search | ui.search_bg | navigation 色の背景版 |
| IncSearch | ui.search_bg 反転 | |
| Pmenu | neutral.bg_popup / fg | |
| PmenuSel | ui.pmenu_sel_bg | |
| NormalFloat | neutral.bg_popup | |
| FloatBorder | **ui.frame** | navigation の低彩度派生 |
| StatusLine | neutral.bg_surface / fg | |
| StatusLineNC | neutral.bg_surface / neutral.line_nr | |
| TabLine | neutral.line_nr / neutral.bg | 非アクティブタブ |
| TabLineSel | **ui.navigation** / neutral.bg_surface | キャラの色でアクティブタブを示す |
| TabLineFill | neutral.bg | |
| WinSeparator | **ui.frame** | navigation の低彩度派生 |
| NonText | neutral.border | |
| Whitespace | neutral.border | |

### パレット → File Tree（NvimTree / neo-tree）

| グループ | 色 | 備考 |
|---|---|---|
| NvimTreeNormal / NeoTreeNormal | fg / neutral.bg_surface | sidebar は surface bg |
| NvimTreeFolderName | **ui.navigation** | キャラの色でフォルダを彩る |
| NvimTreeFolderIcon | **ui.navigation** | |
| NvimTreeRootFolder / NeoTreeRootName | **ui.navigation**, bold | |
| NvimTreeOpenedFolderName | **ui.navigation**, bold | |
| NvimTreeFileName | fg | 通常テキスト色 |
| NvimTreeIndentMarker | neutral.border | |
| NvimTreeGitDirty / NeoTreeGitModified | **ui.attention** | 変更ファイル |
| NvimTreeGitNew / NeoTreeGitAdded | color4 方向 | green 系 |
| NvimTreeGitDeleted / NeoTreeGitDeleted | color8 | red 系 |
| NvimTreeSpecialFile | color6 | special 系 |

---

## ui 色の導出

AI 3 色の「象徴色の順位」は「UI 映えする順位」とは限らない。
bg/fg とのコントラスト比と **Oklab 距離**で UI に使える色を判定する。

```
Step 1: assignUiRoles()
  3 色それぞれについて bg/fg とのコントラスト比を算出
  UI 適格条件: bgCR >= 3.0 AND fgCR >= 2.0
  適格色を Oklab 距離（bg からの知覚的距離）降順でソート
  → navigation = bg から最も遠い色, attention = 次に遠い色

Step 2: deriveUiColors()
  ui.navigation  = roles で選ばれた色（TabLineSel, FolderName, RootFolder）
  ui.attention   = roles で選ばれた色（CursorLineNr, Git dirty）
  ui.frame       = navigation 色の低彩度派生（FloatBorder, WinSeparator）
  ui.search_bg   = navigation 色の L を 0.30 (dark) / 0.85 (light) に
  ui.pmenu_sel_bg = bg_visual と同値
```

**なぜ Oklab 距離か:** chroma (彩度) のみだと、bg と L が近い高彩度色が選ばれる場合がある。
Oklab 距離は L/a/b の総合的な知覚差を測るため、「bg 上で最も目立つ色」を正確に選択できる。

frame の派生定数は暫定値。24 キャラの SVG 検証後に調整する。

## 弁別性検証 (checkDiscrimination)

パレット生成後、accent 8 色の全ペア (28 通り) の Oklab 距離を計算し、
ΔE_ok < 0.08 のペアを警告する。

**根拠:** Gramazio et al. (2017) Colorgorical の知見。
シンタックスハイライトのような細い文字では ΔE_ok > 0.08〜0.10 が弁別に必要。
現在は警告のみだが、将来的に L/C 自動調整を追加する可能性がある。

## やること

- [x] 色相環ギャップ計算ユーティリティ (computeGaps)
- [x] 隙間充填アルゴリズム実装 (fillGaps)
- [x] 低彩度入力の補正 (stabilizeHue)
- [x] 最小色相距離保証 (enforceMinHueGap, ΔH ≥ 30°)
- [x] AI 3 色の L/C 統計から target L/C を算出 (computeTargetLC + L Jittering)
- [x] neutral 検証・補正ロジック (clampNeutral)
- [x] neutral 派生色生成 (deriveNeutralPalette)
- [x] variant 生成 (generateVariants)
- [x] UI ロール割り当て（assignUiRoles: コントラスト判定 + Oklab 距離）
- [x] ui 色導出（deriveUiColors: frame = navigation 派生）
- [x] コントラスト保証（WCAG AA — ensureContrast）
- [x] gamut mapping (culori clampChroma)
- [x] 弁別性検証 (checkDiscrimination, ΔE_ok ≥ 0.08)
- [x] テスト用 SVG 出力で視覚検証 (test-palette-v01.ts)
- [x] 弁別性警告の自動修正 (fixDiscrimination — L ±0.03 双方向試行)
- [x] error hue が primary hue と近い場合のずらしロジック (resolveErrorHue)
- [ ] パレット JSON の Valibot スキーマ定義
- [ ] 24 キャラの SVG 検証
- [ ] src/features/ への本実装
- [ ] ユニットテスト
