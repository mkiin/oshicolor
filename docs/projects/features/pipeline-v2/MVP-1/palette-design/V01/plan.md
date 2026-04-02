# MVP-1/palette-design/V01 AI 出力からパレット JSON を生成

## 概要

ai-vision の出力（象徴色+テーマトーン+neutral bg/fg）を受け取り、Neovim カラースキーム用のパレット JSON を生成する。

## AI 出力スキーマ（入力）
```json
{
  "impression": {
    "primary": { "hex": "#xxxxxx", "reason": "string" },
    "secondary": { "hex": "#xxxxxx", "reason": "string" },
    "tertiary": { "hex": "#xxxxxx", "reason": "string or null" }
  },
  "theme_tone": "dark | light",
  "neutral": {
    "bg_base_hex": "#xxxxxx",
    "fg_base_hex": "#xxxxxx"
  }
}
```

## パレット生成プラン

### プラン A: mini.hues アルゴ移植 + AI 色上書き

primary の色相を起点に 8 色相グリッドを生成し、AI の impression 色で一部を上書きする。

```
AI primary.hex → 色相を抽出 → 基準色相
基準色相から等間隔に 8 色相を配置（mini.hues のロジック）
ただし primary/secondary/tertiary の色相に最も近い色を AI の色で上書き
残りの色はアルゴが生成
明度・彩度は bg の明度に応じて OKLCH で調整
```

**8 色の割り当て:**

| 色名 | 生成元 | syntax role |
|---|---|---|
| color1 | **AI primary** | keyword |
| color2 | **AI secondary** | function |
| color3 | **AI tertiary** | constant |
| color4 | アルゴ生成 | string, character |
| color5 | アルゴ生成 | type, className(@property) |
| color6 | アルゴ生成 | special, builtin |
| color7 | アルゴ生成 | preproc, parameter |
| color8 | アルゴ生成 | error, diagnostic |

**派生色（8色から明度/彩度を変えて生成）:**

| 派生色 | 元の色 | 変化 | syntax role |
|---|---|---|---|
| color1_variant | color1 (AI primary) | 彩度を下げる or 明度をずらす | tag |
| color3_variant | color3 (AI tertiary) | 明度を変える | number |

**メリット:**
- キャラの象徴色が keyword/function/constant に入り、個性が出る
- 残りの色は色相グリッドで自動補完される
- mini.hues の実績あるアルゴリズム（OKLCH ベース）を活用

**課題:**
- mini.hues は Lua なので TypeScript に移植が必要
- AI 色とアルゴ生成色の調和（彩度・明度のバランス）を調整する必要がある

### プラン B: （検討中）

（サブプランとして別の方針を検討する場合ここに追記）

### プラン C: （検討中）

（同上）

---

## ハイライトグループ リンク定義（全プラン共通）

どのプランを採用しても、最終的に 8 色 + neutral 系を以下の約 66 グループにマッピングする。

### パレット → Vim デフォルトグループ（20）

| グループ | パレット色 | 備考 |
|---|---|---|
| Normal | fg / bg | メインテキスト |
| Comment | neutral.comment | fg_mid2 相当、italic |
| Constant | color3 | AI tertiary |
| String | color4 | アルゴ生成 |
| Character | → String | link（文字リテラルは文字列の仲間） |
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
| PreProc | color7 | アルゴ生成 |
| Include | → PreProc | link |
| Define | → PreProc | link |
| Macro | → PreProc | link |
| Type | color5 | アルゴ生成 |
| StorageClass | → Type | link |
| Structure | → Type | link |
| Typedef | → Type | link |
| Special | color6 | アルゴ生成 |
| SpecialChar | → Special | link |
| Tag | color1_variant | AI primary の派生（keyword と同系色だが区別可能） |
| Delimiter | neutral.delimiter | 低彩度 |
| Error | color8_bg | 背景版 |
| Todo | accent / accent_bg, bold | |

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
| @diff.plus | color4 | string と同色（green 系） |
| @diff.minus | color8 | error と同色（red 系） |
| @diff.delta | color5 | type と同色 |
| @markup.heading | color1, bold | 見出し |
| @markup.strong | bold | |
| @markup.italic | italic | |
| @markup.link.url | → Underlined | |
| @markup.raw | → String | |

### パレット → Diagnostic + Diff（16）

| グループ | 色 | 備考 |
|---|---|---|
| DiagnosticError | color8 | red 系 |
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

### パレット → UI（Neutral 系）

| グループ | 色 | 備考 |
|---|---|---|
| CursorLine | neutral.bg_cursor_line | |
| CursorLineNr | neutral.fg, bold | |
| LineNr | neutral.line_nr | |
| Visual | neutral.bg_visual | |
| Search | ui.search_bg | |
| IncSearch | ui.search_bg 反転 | |
| Pmenu | neutral.bg_popup / fg | |
| PmenuSel | ui.pmenu_sel_bg | |
| NormalFloat | neutral.bg_popup | |
| FloatBorder | neutral.border | |
| StatusLine | neutral.bg_surface / fg | |
| WinSeparator | accent | |
| NonText | neutral.bg_mid | |
| Whitespace | neutral.bg_mid | |

---

## neutral 派生ルール

### Step 1: AI 出力の検証・補正（ハイブリッド方式）

AI が提案した bg/fg を OKLCH に変換し、L（明度）と C（彩度）を検証する。
H（色相）は AI の判断を尊重し、そのまま使う。

```
bg_base_hex → OKLCH に変換
  dark の場合: L が 0.10〜0.18 の範囲外なら補正、C が 0.02 以上なら 0.015 に補正
  light の場合: L が 0.92〜0.98 の範囲外なら補正、C が 0.02 以上なら 0.015 に補正
  H はそのまま（AI が画像全体の雰囲気から選んだ色相を活かす）

fg_base_hex → OKLCH に変換
  dark の場合: L が 0.82〜0.92 の範囲外なら補正
  light の場合: L が 0.15〜0.25 の範囲外なら補正
  H はそのまま
```

### Step 2: 派生色の生成

```
補正済み bg → bg_base
bg_base から OKLCH で明度をずらして派生:
  bg_surface     → bg より L +0.02
  bg_cursor_line → bg より L +0.03
  bg_visual      → bg より L +0.06
  bg_popup       → bg より L +0.04

補正済み fg → fg_base
fg_base から彩度・明度を下げて派生:
  comment        → fg の L を 0.45 程度に
  line_nr        → fg の L を 0.40 程度に
  border         → fg の L を 0.30 程度に
  delimiter      → fg の L を 0.60 程度に
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
    "accent": "#xxxxxx",
    "search_bg": "#xxxxxx",
    "pmenu_sel_bg": "#xxxxxx"
  }
}
```

## やること

- [ ] プラン A の検証（mini.hues アルゴの TypeScript 移植 + AI 色上書き）
- [ ] サブプラン（B, C）の検討
- [ ] OKLCH 変換ユーティリティ（pipeline-v1 から流用可）
- [ ] neutral 派生色生成
- [ ] コントラスト保証（WCAG AA）
- [ ] パレット JSON の Zod スキーマ定義
