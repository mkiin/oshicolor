# Neovim カラースキーム設計マスタードキュメント

> 参照リポジトリ: `sample-repo/nvim-themes/kanagawa.nvim`, `sample-repo/nvim-themes/tokyonight.nvim`, `sample-repo/nvim-themes/catppuccin/`（catppuccin/nvim）
> 作成日: 2026-02-23
> 対象: kanagawa.nvim / tokyonight.nvim / catppuccin.nvim の設計分析統合

---

## 1. 3テーマの位置づけ

| テーマ         | 基調               | 設計思想            | oshicolor との関係   |
| -------------- | ------------------ | ------------------- | -------------------- |
| **kanagawa**   | 日本的・渋い暗色   | 3層分離・専用色     | 設計パターンの手本   |
| **tokyonight** | モダン・明快な暗色 | 直接参照・シンプル  | 全グループ網羅の参考 |
| **catppuccin** | パステル・アニメ調 | 高 L 値・Hue 全活用 | 色の明るさ設計の手本 |

---

## 2. ハイライト階層アーキテクチャ

### Kanagawa: 7層構造（セマンティック層あり）

```
Layer 0: PaletteColors (colors.lua)
  │  実際の RGB hex 色を詩的な名前で定義
  │  例: springGreen=#98BB6C, crystalBlue=#7E9CD8
  ▼
Layer 1: ThemeColors (themes.lua)  ← ★ Kanagawa 固有のセマンティック層
  │  Palette 色を「用途」にマッピング
  │  syn.string=springGreen, syn.fun=crystalBlue, syn.keyword=oniViolet
  │  wave / dragon / lotus テーマごとにマッピングが異なる
  ▼
Layer 2: editor.lua ─── エディタ UI (Normal, CursorLine, Pmenu, Diagnostic...)
Layer 3: syntax.lua ─── Vim 標準構文 (Comment, String, Function, Keyword...)
Layer 4: treesitter.lua ── TreeSitter (@variable, @keyword.return, @constructor...)
Layer 5: lsp.lua ──── LSP セマンティック (@lsp.type.*, @lsp.typemod.*)
Layer 6: plugins.lua ── プラグイン (GitSigns, Telescope, NvimTree...)
  │
  │  Layer 2～6 はすべて Layer 1 の theme.syn.* / theme.ui.* を参照
  ▼
Layer 7: config.overrides() ── ユーザーカスタマイズ
```

### TokyoNight: 6層構造（セマンティック層なし）

```
Layer 0: Palette (colors/night.lua 等)
  │  例: green=#9ece6a, blue=#7aa2f7, magenta=#bb9af7
  ▼
Layer 0.5: on_colors() ── ユーザーによるパレット上書き
  ▼                       ★ セマンティック層がない（Palette → 直接ハイライト定義）
Layer 1: base.lua ──── エディタ UI + Vim 標準構文を一括定義
Layer 2: treesitter.lua ── TreeSitter 拡張
Layer 3: semantic_tokens.lua ── LSP セマンティック
Layer 4: kinds.lua ──── LSP 補完シンボル種別（LspKind*）
Layer 5: plugins/* ──── プラグイン
  ▼
Layer 6: on_highlights() ── ユーザーカスタマイズ
```

### Catppuccin: 3層構造（フレーバー分離）

```
Layer 0: palettes/*.lua (mocha / macchiato / frappe / latte)
  │  14 アクセント色 + 12 段階ニュートラル
  │  全フレーバーで色名・Hue 不変、L と C だけが変わる
  ▼
Layer 1: groups/editor.lua + syntax.lua + treesitter.lua + lsp.lua
  │  パレット名（mauve, blue, green 等）を直接参照
  ▼
Layer 2: ユーザーカスタマイズ
```

---

## 3. 構文ハイライト Hue マッピング（3テーマ比較）

### 3-A. ダークテーマ基準の構文色配置

| 構文ロール                 | Kanagawa wave                | TokyoNight night         | Catppuccin Mocha         | 業界標準 Hue              |
| -------------------------- | ---------------------------- | ------------------------ | ------------------------ | ------------------------- |
| **@variable**              | `"none"` ← fujiWhite         | `"none"` ← c.fg          | `"none"` ← text          | **none（最重要）**        |
| **Function**               | crystalBlue `#7E9CD8` 220°   | c.blue `#7aa2f7` 218°    | blue `#89b4fa` 218°      | **218-220°（青）**        |
| **Keyword/Statement**      | oniViolet `#957FB8` 280°     | c.cyan `#7dcfff` 190°    | mauve `#cba6f7` 270°     | **270-280°（紫）**        |
| **String**                 | springGreen `#98BB6C` 130°   | c.green `#9ece6a` 125°   | green `#a6e3a1` 125°     | **125-130°（緑）**        |
| **Type/StorageClass**      | waveAqua2 `#7AA89F` 180°     | c.blue1 `#2ac3de` 195°   | **yellow `#f9e2af` 45°** | 180° or **45°（分岐点）** |
| **Constant/Number**        | surimiOrange `#FFA066` 30°   | c.orange `#ff9e64` 25°   | peach `#fab387` 25°      | **25-30°（橙）**          |
| **Identifier/Member**      | carpYellow `#E6C384` 60°     | c.green1 `#73daca` 180°  | lavender `#b4befe` 240°  | 60° or 180°（分岐）       |
| **Operator**               | boatYellow2 `#C0A36E` 50°    | c.blue5 `#89ddff` 190°   | sky `#89dceb` 190°       | 50° or 190°（分岐）       |
| **Comment**                | fujiGray `#727169` 無彩色    | c.comment `#565f89` 245° | overlay2 `#9399b2` 265°  | 低 L・低 C                |
| **Special/PreProc**        | springBlue `#7FB4CA` 200°    | c.blue1 `#2ac3de` 195°   | **pink `#f5c2e7` 325°**  | **Catppuccin 独自**       |
| **Delimiter/@punctuation** | springViolet2 `#9CABCA` 220° | c.blue5 `#89ddff` 190°   | overlay2 `#9399b2` 265°  | —                         |

### 3-B. Hue の合意・分岐まとめ

```
合意（3テーマ一致）:
  function   : 218-220°（青）
  string     : 125-130°（緑）
  constant   : 25-30°（橙）

分岐（テーマにより異なる）:
  keyword    : kanagawa/catppuccin = 270-280°（紫） vs tokyonight = 190°（シアン）
  type       : kanagawa/tokyonight = 180-195°（水色） vs catppuccin = 45°（黄）
  identifier : kanagawa = 60°（黄） vs tokyonight = 180°（水色） vs catppuccin = 240°（薄青紫）
  special    : catppuccin のみ 325°（ピンク）を使う独自設計
```

### 3-C. Catppuccin が「アニメ調」に見える理由

ダークテーマにおける構文色の L 値比較：

| ロール    | Catppuccin Mocha            | Kanagawa wave                | 差    |
| --------- | --------------------------- | ---------------------------- | ----- |
| Function  | blue `#89b4fa` L≈**0.74**   | crystalBlue `#7E9CD8` L≈0.62 | +0.12 |
| String    | green `#a6e3a1` L≈**0.85**  | springGreen `#98BB6C` L≈0.71 | +0.14 |
| Type      | yellow `#f9e2af` L≈**0.89** | waveAqua2 `#7AA89F` L≈0.65   | +0.24 |
| Keyword   | mauve `#cba6f7` L≈**0.77**  | oniViolet `#957FB8` L≈0.63   | +0.14 |
| Normal.fg | text `#cdd6f4` L≈**0.82**   | fujiWhite `#DCD7BA` L≈0.86   | -0.04 |

**構文色が Normal.fg とほぼ同等 or それ以上の L を持つ**のが Catppuccin の最大の特徴。
これがアニメのイラストと同じ「明るく清潔な色使い」に直結している。

Catppuccin Mocha の構文色 C（彩度）は概ね 0.13〜0.24 の範囲：

```
mauve: C≈0.24（最高・keyword 用）
blue:  C≈0.20（中程度・function）
yellow: C≈0.19（中程度・type）
green: C≈0.13（控えめ・string は脇役）
```

---

## 4. パレット・ニュートラルスケール設計

### Kanagawa wave の bg 階調（7段階）

```lua
sumiInk0  = "#16161D"  -- 最暗（WinSeparator）
sumiInk1  = "#1F1F28"  -- Normal.bg に近い暗背景
sumiInk2  = "#2A2A37"  -- StatusLine bg
sumiInk3  = "#363646"  -- CursorLine, ColorColumn
sumiInk4  = "#54546D"  -- LineNr, SignColumn
sumiInk5  = "#727169"  -- Comment（L≈0.46）
fujiWhite = "#DCD7BA"  -- Normal.fg（L≈0.86）
```

### Catppuccin Mocha ニュートラル 12段階

```
crust    #11111b  L≈0.08  ← 最暗・WinSeparator
mantle   #181825  L≈0.10  ← FloatBorder bg
base     #1e1e2e  L≈0.12  ← Normal.bg（主背景）
surface0 #313244  L≈0.22  ← ColorColumn, PmenuSel bg
surface1 #45475a  L≈0.32  ← CursorLine, LineNr
surface2 #585b70  L≈0.40  ← higher surface
overlay0 #6c7086  L≈0.48  ← NonText, LspCodeLens
overlay1 #7f849c  L≈0.55
overlay2 #9399b2  L≈0.62  ← Comment / Delimiter ★
subtext0 #a6adc8  L≈0.69  ← 補助前景
subtext1 #bac2de  L≈0.75  ← 補助前景（明）
text     #cdd6f4  L≈0.82  ← Normal.fg
```

Catppuccin の Comment は `overlay2`（C≈0.08, H≈265°）。
bg の Hue（Mocha は紫系）を引き継ぎながら視認性を保つ設計。

### Catppuccin フレーバー間 L 設計原理

```
Latte  (bg L≈0.94): アクセント L≈0.40〜0.55（暗め）
Frappe (bg L≈0.19): アクセント L≈0.72〜0.85
Mocha  (bg L≈0.12): アクセント L≈0.74〜0.89

法則: アクセント色と bg のコントラスト差 ≈ 0.55〜0.70 を維持
```

---

## 5. Diagnostic 色の設計方針

### Kanagawa: 構文色と完全に分離した専用色

```lua
samuraiRed  → diag.error のみ（構文には使わない）
roninYellow → diag.warning のみ（構文には使わない）
```

### Catppuccin: 構文色を流用

| 種別            | 使用色           | 構文との重複               |
| --------------- | ---------------- | -------------------------- |
| DiagnosticError | red `#f38ba8`    | = @variable.builtin と同色 |
| DiagnosticWarn  | yellow `#f9e2af` | = **Type と同色！**        |
| DiagnosticInfo  | sky `#89dceb`    | = Operator と同色          |
| DiagnosticHint  | teal `#94e2d5`   | = Character と同色         |

**Catppuccin は Diagnostic に専用色を持たない**が実用上問題が少ない理由：

- エラーは「行・undercurl」とセットで表示される
- 色だけでなくアイコンや下線が意味を補助する

---

## 6. ハイライトグループ完全対応表

### 6-A. Vim 標準ハイライトグループ

| グループ         | Kanagawa (wave)                         | TokyoNight (night)        | Catppuccin (Mocha) |
| ---------------- | --------------------------------------- | ------------------------- | ------------------ |
| **Comment**      | fujiGray `#727169` / italic             | `#565f89` / italic        | overlay2 `#9399b2` |
| **Constant**     | surimiOrange `#FFA066`                  | `#ff9e64`                 | peach `#fab387`    |
| **String**       | springGreen `#98BB6C`                   | `#9ece6a`                 | green `#a6e3a1`    |
| **Character**    | link → String                           | link → String             | link → String      |
| **Number**       | sakuraPink `#D27E99`                    | `#ff9e64`                 | peach `#fab387`    |
| **Boolean**      | surimiOrange / bold                     | link → Number             | peach `#fab387`    |
| **Float**        | link → Number                           | link → Number             | link → Number      |
| **Identifier**   | carpYellow `#E6C384`                    | `#bb9af7` (magenta)       | flamingo `#f2cdcd` |
| **Function**     | crystalBlue `#7E9CD8` / bold            | `#7aa2f7`                 | blue `#89b4fa`     |
| **Statement**    | oniViolet `#957FB8` / bold              | `#bb9af7`                 | mauve `#cba6f7`    |
| **Conditional**  | link → Statement                        | link → Statement          | link → mauve       |
| **Repeat**       | link → Statement                        | link → Statement          | link → mauve       |
| **Operator**     | boatYellow2 `#C0A36E`                   | `#89ddff` (blue5)         | sky `#89dceb`      |
| **Keyword**      | oniViolet `#957FB8` / italic            | `#7dcfff` (cyan) / italic | mauve `#cba6f7`    |
| **Exception**    | waveRed `#E46876`                       | link → Statement          | red `#f38ba8`      |
| **PreProc**      | waveRed `#E46876`                       | `#7dcfff`                 | pink `#f5c2e7`     |
| **Type**         | waveAqua2 `#7AA89F`                     | `#2ac3de` (blue1)         | yellow `#f9e2af`   |
| **StorageClass** | link → Type                             | link → Type               | yellow `#f9e2af`   |
| **Structure**    | link → Type                             | link → Type               | yellow `#f9e2af`   |
| **Typedef**      | link → Type                             | link → Typedef            | yellow `#f9e2af`   |
| **Special**      | springBlue `#7FB4CA`                    | `#2ac3de` (blue1)         | pink `#f5c2e7`     |
| **SpecialChar**  | link → Special                          | link → Special            | link → Special     |
| **Delimiter**    | springViolet2 `#9CABCA`                 | link → Special            | overlay2 `#9399b2` |
| **Tag**          | link → Special                          | link → Label              | sapphire `#74c7ec` |
| **Error**        | samuraiRed `#E82424`                    | `#db4b4b`                 | red `#f38ba8`      |
| **Todo**         | fg: ui.fg_reverse, bg: diag.info / bold | bg: `#e0af68`, fg: bg     | bg: blue, fg: base |

### 6-B. TreeSitter グループ（@variable 系）

| グループ                | Kanagawa (wave)               | TokyoNight (night)       | Catppuccin (Mocha)       |
| ----------------------- | ----------------------------- | ------------------------ | ------------------------ |
| **@variable**           | fujiWhite `#DCD7BA`（= none） | c.fg `#c0caf5`（= none） | text `#cdd6f4`（= none） |
| **@variable.builtin**   | waveRed `#E46876` / italic    | `#f7768e` (red)          | red `#f38ba8`            |
| **@variable.parameter** | oniViolet2（薄紫）            | `#e0af68` (yellow)       | maroon `#eba0ac`         |
| **@variable.member**    | carpYellow `#E6C384`          | `#73daca` (green1)       | lavender `#b4befe`       |

### 6-C. TreeSitter グループ（@string 系）

| グループ                  | Kanagawa (wave)  | TokyoNight (night)  | Catppuccin (Mocha) |
| ------------------------- | ---------------- | ------------------- | ------------------ |
| **@string**               | link → String    | link → String       | link → String      |
| **@string.regexp**        | syn.regex        | `#b4f9f8` (blue6)   | pink `#f5c2e7`     |
| **@string.escape**        | syn.regex / bold | `#bb9af7` (magenta) | pink `#f5c2e7`     |
| **@string.documentation** | —                | `#e0af68` (yellow)  | —                  |

### 6-D. TreeSitter グループ（@function 系）

| グループ              | Kanagawa (wave)      | TokyoNight (night)  | Catppuccin (Mocha) |
| --------------------- | -------------------- | ------------------- | ------------------ |
| **@function**         | link → Function      | link → Function     | link → Function    |
| **@function.builtin** | —                    | link → Special      | link → Special     |
| **@function.call**    | —                    | link → @function    | link → Function    |
| **@function.method**  | —                    | link → Function     | link → Function    |
| **@constructor**      | springBlue `#7FB4CA` | `#bb9af7` (magenta) | flamingo `#f2cdcd` |

### 6-E. TreeSitter グループ（@keyword 系）

| グループ               | Kanagawa (wave)             | TokyoNight (night)  | Catppuccin (Mocha) |
| ---------------------- | --------------------------- | ------------------- | ------------------ |
| **@keyword**           | link → Keyword              | `#9d7cd8` / italic  | link → Keyword     |
| **@keyword.function**  | —                           | `#bb9af7` (magenta) | link → Keyword     |
| **@keyword.operator**  | boatYellow2 / bold          | link → @operator    | link → Keyword     |
| **@keyword.return**    | peachRed `#FF5D62` / italic | link → @keyword     | link → Keyword     |
| **@keyword.exception** | peachRed `#FF5D62` / bold   | link → Exception    | red `#f38ba8`      |
| **@keyword.import**    | link → PreProc              | link → Include      | link → Include     |

### 6-F. TreeSitter グループ（@type 系）

| グループ             | Kanagawa (wave) | TokyoNight (night) | Catppuccin (Mocha) |
| -------------------- | --------------- | ------------------ | ------------------ |
| **@type**            | link → Type     | link → Type        | link → Type        |
| **@type.builtin**    | —               | blend(blue1, 0.8)  | mauve `#cba6f7`    |
| **@type.definition** | —               | link → Typedef     | —                  |
| **@attribute**       | link → Constant | link → PreProc     | link → PreProc     |
| **@module**          | —               | link → Include     | link → Include     |
| **@label**           | —               | `#7aa2f7` (blue)   | sapphire `#74c7ec` |

### 6-G. TreeSitter グループ（@punctuation 系）

| グループ                   | Kanagawa (wave)         | TokyoNight (night)  | Catppuccin (Mocha) |
| -------------------------- | ----------------------- | ------------------- | ------------------ |
| **@punctuation.delimiter** | springViolet2 `#9CABCA` | `#89ddff` (blue5)   | overlay2 `#9399b2` |
| **@punctuation.bracket**   | springViolet2 `#9CABCA` | `#a9b1d6` (fg_dark) | overlay2 `#9399b2` |
| **@punctuation.special**   | springBlue `#7FB4CA`    | `#89ddff` (blue5)   | overlay2 `#9399b2` |

**注目**: Catppuccin は punctuation をすべて overlay2 で統一。「低優先グループ」の視覚的統一。

### 6-H. LSP セマンティックトークン（重要なもの）

| グループ                       | Kanagawa                   | TokyoNight                 | Catppuccin                 |
| ------------------------------ | -------------------------- | -------------------------- | -------------------------- |
| @lsp.type.variable             | `{}` 空（TS に委ねる）     | `{}` 空（TS に委ねる）     | —                          |
| @lsp.type.keyword              | link → @keyword            | link → @keyword            | link → @keyword            |
| @lsp.type.parameter            | link → @variable.parameter | link → @variable.parameter | link → @variable.parameter |
| @lsp.type.namespace            | link → @module             | link → @module             | link → @module             |
| @lsp.mod.readonly              | link → Constant            | link → @constant           | —                          |
| @lsp.typemod.function.readonly | syn.fun / bold             | —                          | —                          |

---

## 7. oshicolor v4 への示唆

### 7-A. 最重要: `@variable = "none"` の徹底

3テーマすべてで `@variable` は `none`（Normal.fg を継承）。
最頻出グループへのアクセント色は「目の疲れ」を引き起こすため排除する。
oshicolor でも **`variable` スロットは生成しない**。

### 7-B. 構文色 L 値の設定

| 設定            | v4 当初案  | Catppuccin 実績 | 推奨修正                  |
| --------------- | ---------- | --------------- | ------------------------- |
| 構文色 L_target | 0.62〜0.78 | 0.74〜0.89      | **0.72〜0.85 に上方修正** |
| Comment C       | 0.04       | overlay2: ≈0.08 | **0.06〜0.08 に上方修正** |

**アニメ感が出る構文色 L の目安は 0.78〜0.85**（bg L=0.12 のダークテーマ基準）。

### 7-C. Type = 黄（45°）は設計として成立する

kanagawa/tokyonight の `Type = 水色（180-195°）` が「唯一解」ではない。
Catppuccin は `Type = 黄（45°）` で広く受け入れられている。
oshicolor でも image の色が自然に黄系の場合、Type に割り当てて問題ない。

### 7-D. ピンクゾーン（300°〜340°）は使える

kanagawa/tokyonight にない独自性。Special/PreProc に pink（325°）を使う設計。
サブカル・アニメ系の色使いと相性が良く、14アクセント色の全 Hue を活用できる。

### 7-E. Diagnostic の扱い

Catppuccin 方式（構文色流用）が検討に値する。
専用色を持たなくても、undercurl や sign アイコンが意味を補助するため実用上問題は少ない。
oshicolor では **DiagnosticError = 赤系固定値**、他は構文色流用またはシフトで対応できる。

### 7-F. Comment/Delimiter の統一

Catppuccin は `Comment = Delimiter = @punctuation.* = overlay2` で統一。
「低優先グループ」を同色にまとめることで視覚的な静けさが生まれる。
v4 の `special = function C × 0.6` より、**`special = comment と同じ低 C ニュートラル`** の方がシンプル。

### 7-G. フレーバー = oshicolor のコンセプトシステムに対応

```
Mocha   ≒ darkClassic  (bg L≈0.12, accent L≈0.74〜0.89)
Frappe  ≒ darkMuted    (bg L≈0.19, accent L≈0.72〜0.85)
Latte   ≒ lightPastel  (bg L≈0.94, accent L≈0.40〜0.55)
```

コントラスト差（≈0.55〜0.70）を維持することが各コンセプトの設計根拠になる。

---

## 付録: カラースキーム設計チェックリスト

設計時に確認すべき最低限の項目：

- [ ] `@variable` は `none`（Normal.fg 継承）になっているか
- [ ] `Function` は 218-220°（青系）か
- [ ] `Keyword/Statement` は 270-285°（紫系）か ← tokyonight は 190° でも可
- [ ] `String` は 125-130°（緑系）か
- [ ] `Constant` は 25-30°（橙系）か
- [ ] `Comment` の L は Normal.fg より低く（0.45〜0.65 程度）、C は小さいか（0.06〜0.10）
- [ ] 構文色の L が bg との十分なコントラスト差（≧0.55）を持つか
- [ ] `DiagnosticError` は赤系で `String`（緑）と混同しないか
- [ ] `@punctuation.*` は低 C ニュートラルか（構文色と競合しない）
