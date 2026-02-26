# Neovim カラースキーム設計マスタードキュメント

> 参照リポジトリ: `sample-repo/nvim-themes/kanagawa.nvim`, `sample-repo/nvim-themes/tokyonight.nvim`, `sample-repo/nvim-themes/catppuccin/`（catppuccin/nvim）
> 作成日: 2026-02-23
> 対象: kanagawa.nvim / tokyonight.nvim / catppuccin.nvim の設計分析統合

---

## 1. 3テーマの位置づけ

| テーマ | 基調 | 設計思想 | oshicolor との関係 |
|---|---|---|---|
| **kanagawa** | 日本的・渋い暗色 | 3層分離・専用色 | 設計パターンの手本 |
| **tokyonight** | モダン・明快な暗色 | 直接参照・シンプル | 全グループ網羅の参考 |
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

| 構文ロール | Kanagawa wave | TokyoNight night | Catppuccin Mocha | 業界標準 Hue |
|---|---|---|---|---|
| **@variable** | `"none"` ← fujiWhite | `"none"` ← c.fg | `"none"` ← text | **none（最重要）** |
| **Function** | crystalBlue `#7E9CD8` 220° | c.blue `#7aa2f7` 218° | blue `#89b4fa` 218° | **218-220°（青）** |
| **Keyword/Statement** | oniViolet `#957FB8` 280° | c.cyan `#7dcfff` 190° | mauve `#cba6f7` 270° | **270-280°（紫）** |
| **String** | springGreen `#98BB6C` 130° | c.green `#9ece6a` 125° | green `#a6e3a1` 125° | **125-130°（緑）** |
| **Type/StorageClass** | waveAqua2 `#7AA89F` 180° | c.blue1 `#2ac3de` 195° | **yellow `#f9e2af` 45°** | 180° or **45°（分岐点）** |
| **Constant/Number** | surimiOrange `#FFA066` 30° | c.orange `#ff9e64` 25° | peach `#fab387` 25° | **25-30°（橙）** |
| **Identifier/Member** | carpYellow `#E6C384` 60° | c.green1 `#73daca` 180° | lavender `#b4befe` 240° | 60° or 180°（分岐） |
| **Operator** | boatYellow2 `#C0A36E` 50° | c.blue5 `#89ddff` 190° | sky `#89dceb` 190° | 50° or 190°（分岐） |
| **Comment** | fujiGray `#727169` 無彩色 | c.comment `#565f89` 245° | overlay2 `#9399b2` 265° | 低 L・低 C |
| **Special/PreProc** | springBlue `#7FB4CA` 200° | c.blue1 `#2ac3de` 195° | **pink `#f5c2e7` 325°** | **Catppuccin 独自** |
| **Delimiter/@punctuation** | springViolet2 `#9CABCA` 220° | c.blue5 `#89ddff` 190° | overlay2 `#9399b2` 265° | — |

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

| ロール | Catppuccin Mocha | Kanagawa wave | 差 |
|---|---|---|---|
| Function | blue `#89b4fa` L≈**0.74** | crystalBlue `#7E9CD8` L≈0.62 | +0.12 |
| String | green `#a6e3a1` L≈**0.85** | springGreen `#98BB6C` L≈0.71 | +0.14 |
| Type | yellow `#f9e2af` L≈**0.89** | waveAqua2 `#7AA89F` L≈0.65 | +0.24 |
| Keyword | mauve `#cba6f7` L≈**0.77** | oniViolet `#957FB8` L≈0.63 | +0.14 |
| Normal.fg | text `#cdd6f4` L≈**0.82** | fujiWhite `#DCD7BA` L≈0.86 | -0.04 |

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

| 種別 | 使用色 | 構文との重複 |
|---|---|---|
| DiagnosticError | red `#f38ba8` | = @variable.builtin と同色 |
| DiagnosticWarn | yellow `#f9e2af` | = **Type と同色！** |
| DiagnosticInfo | sky `#89dceb` | = Operator と同色 |
| DiagnosticHint | teal `#94e2d5` | = Character と同色 |

**Catppuccin は Diagnostic に専用色を持たない**が実用上問題が少ない理由：
- エラーは「行・undercurl」とセットで表示される
- 色だけでなくアイコンや下線が意味を補助する

---

## 6. Neovim 組み込みハイライトグループ一覧

Neovim が定義するハイライトグループの全体像をカテゴリ別に整理した参照資料。
ソース: `src/nvim/highlight_group.c`、`:h highlight-groups`、`:h treesitter-highlight-groups`、`:h diagnostic-highlights`、`:h lsp-highlight`

> **目的**: カラースキームで「何を定義すべきか」を判断するための母数を把握する。
> 全グループを個別に色指定する必要はない（`link` やフォールバックで対処できるものが大半）。

### 6-0. カテゴリ別グループ数サマリー

| カテゴリ | グループ数 | 備考 |
|---|---|---|
| エディタ UI | 63 | Normal, カーソル, ステータスライン, フロート等 |
| ポップアップメニュー (Pmenu) | 12 | 補完メニュー関連 |
| Diff | 5 | diff 表示 |
| Spell | 4 | スペルチェック |
| Vim 標準構文 | 38 | Comment, String, Function 等の伝統的グループ |
| Diagnostic | 32 | 5重症度 × 6表示形式 + 特殊2 |
| LSP | 10 | リファレンス, CodeLens, InlayHint 等 |
| LSP セマンティックトークン | 33+ | 型23 + 修飾子10（組み合わせは無限） |
| TreeSitter | 90 | @variable, @function, @keyword 等 |
| **合計** | **287+** | |

### 6-A. エディタ UI グループ（63）

#### 基本

| グループ名 | 役割 |
|---|---|
| Normal | メインのエディタ領域（fg / bg の基準） |
| NormalNC | 非アクティブウィンドウの Normal |
| NormalFloat | フローティングウィンドウの Normal |

#### カーソル系

| グループ名 | 役割 |
|---|---|
| Cursor | カーソル文字（hl-Cursor） |
| lCursor | IME 変換中のカーソル |
| CursorIM | IME 入力モードのカーソル |
| TermCursor | ターミナルモードのカーソル |
| CursorLine | カーソル行のハイライト |
| CursorColumn | カーソル列のハイライト |
| CursorLineNr | カーソル行の行番号 |
| CursorLineFold | カーソル行の FoldColumn |
| CursorLineSign | カーソル行の SignColumn |

#### 行番号・列インジケーター

| グループ名 | 役割 |
|---|---|
| LineNr | 行番号 |
| LineNrAbove | カーソルより上の行番号（relativenumber） |
| LineNrBelow | カーソルより下の行番号（relativenumber） |
| ColorColumn | colorcolumn で指定した列のハイライト |
| SignColumn | サイン列（左端のガター） |
| FoldColumn | 折りたたみ列 |

#### 折りたたみ・非表示

| グループ名 | 役割 |
|---|---|
| Folded | 折りたたまれた行 |
| EndOfBuffer | バッファ末尾の `~` 行 |
| NonText | listchars で表示される非表示文字 |
| Whitespace | listchars のスペース・タブ表示 |
| SpecialKey | 特殊キーの表示（`:map` のプレフィックス等） |
| Conceal | conceal 属性で隠された文字の代替表示 |

#### ステータスライン

| グループ名 | 役割 |
|---|---|
| StatusLine | アクティブウィンドウのステータスライン |
| StatusLineNC | 非アクティブウィンドウのステータスライン |
| StatusLineTerm | ターミナルウィンドウのステータスライン |
| StatusLineTermNC | 非アクティブターミナルのステータスライン |

#### タブライン

| グループ名 | 役割 |
|---|---|
| TabLine | 非選択タブ |
| TabLineFill | タブラインの空白部分 |
| TabLineSel | 選択中のタブ |

#### ウィンドウ・フロート

| グループ名 | 役割 |
|---|---|
| WinSeparator | ウィンドウ間の区切り線 |
| VertSplit | WinSeparator の旧名（互換性用） |
| WinBar | ウィンドウバー |
| WinBarNC | 非アクティブウィンドウのウィンドウバー |
| FloatBorder | フローティングウィンドウの枠線 |
| FloatTitle | フローティングウィンドウのタイトル |
| FloatFooter | フローティングウィンドウのフッター |
| FloatShadow | フローティングウィンドウの影 |
| FloatShadowThrough | 半透明のフロート影 |

#### メッセージ

| グループ名 | 役割 |
|---|---|
| MsgArea | メッセージ表示領域 |
| MsgSeparator | メッセージとエディタの区切り線 |
| MoreMsg | `-- More --` プロンプト |
| ErrorMsg | エラーメッセージ |
| WarningMsg | 警告メッセージ |
| StdoutMsg | 標準出力メッセージ |
| StderrMsg | 標準エラーメッセージ |
| Question | 確認プロンプト（`Press ENTER` 等） |

#### 選択・検索

| グループ名 | 役割 |
|---|---|
| Visual | ビジュアルモードの選択範囲 |
| VisualNOS | 非フォーカス時のビジュアル選択 |
| MatchParen | 対応する括弧のハイライト |
| Search | 検索結果のハイライト |
| IncSearch | インクリメンタル検索の現在マッチ |
| CurSearch | 現在カーソル位置の検索マッチ |
| Substitute | `:s` コマンドの置換プレビュー |

#### その他

| グループ名 | 役割 |
|---|---|
| Directory | ディレクトリ名（netrw 等） |
| Title | タイトル表示（`:set title` 等） |
| WildMenu | コマンドライン補完のワイルドメニュー |
| QuickFixLine | QuickFix で選択された行 |
| RedrawDebugNormal | 再描画デバッグ用 |
| PreInsert | 挿入前のプレビュー表示 |
| ComplMatchIns | 補完マッチの挿入済みテキスト |
| ComplHint | 補完のヒント表示 |

### 6-B. ポップアップメニューグループ（12）

| グループ名 | 役割 |
|---|---|
| Pmenu | ポップアップメニュー全体（補完候補リスト） |
| PmenuSel | 選択中の補完候補 |
| PmenuSbar | ポップアップメニューのスクロールバー |
| PmenuThumb | スクロールバーのつまみ |
| PmenuMatch | マッチした文字のハイライト |
| PmenuMatchSel | 選択中候補のマッチ文字ハイライト |
| PmenuExtra | 補完候補の追加情報テキスト |
| PmenuExtraSel | 選択中候補の追加情報テキスト |
| PmenuKind | 補完候補の種別（Function, Variable 等） |
| PmenuKindSel | 選択中候補の種別 |
| PmenuBorder | ポップアップメニューの枠線 |
| PmenuShadow | ポップアップメニューの影 |

### 6-C. Diff グループ（5）

| グループ名 | 役割 |
|---|---|
| DiffAdd | 追加された行 |
| DiffChange | 変更された行 |
| DiffDelete | 削除された行 |
| DiffText | 変更行内の変更箇所 |
| DiffTextAdd | 追加行内の追加箇所 |

### 6-D. Spell グループ（4）

| グループ名 | 役割 |
|---|---|
| SpellBad | スペルミスの単語 |
| SpellCap | 文頭が大文字でない単語 |
| SpellLocal | 別リージョンの正しいスペル |
| SpellRare | 使用頻度の低い単語 |

### 6-E. Vim 標準構文グループ（38）

#### Comment

| グループ名 | 役割 |
|---|---|
| Comment | コメント |

#### Constant 系

| グループ名 | 役割 |
|---|---|
| Constant | 定数全般 |
| String | 文字列リテラル |
| Character | 文字リテラル |
| Number | 数値リテラル |
| Boolean | 真偽値リテラル |
| Float | 浮動小数点リテラル |

#### Identifier 系

| グループ名 | 役割 |
|---|---|
| Identifier | 変数名 |
| Function | 関数名・メソッド名 |

#### Statement 系

| グループ名 | 役割 |
|---|---|
| Statement | 文全般 |
| Conditional | if / then / else / switch 等 |
| Repeat | for / do / while 等 |
| Label | case / default 等 |
| Operator | sizeof / + / * 等 |
| Keyword | その他のキーワード |
| Exception | try / catch / throw |

#### PreProc 系

| グループ名 | 役割 |
|---|---|
| PreProc | プリプロセッサ全般 |
| Include | #include |
| Define | #define |
| Macro | マクロ（= Define） |
| PreCondit | #if / #else / #endif |

#### Type 系

| グループ名 | 役割 |
|---|---|
| Type | int / long / char 等 |
| StorageClass | static / register / volatile 等 |
| Structure | struct / union / enum |
| Typedef | typedef 定義 |

#### Special 系

| グループ名 | 役割 |
|---|---|
| Special | 特殊シンボル全般 |
| SpecialChar | 定数内の特殊文字（エスケープ等） |
| Tag | CTRL-] でジャンプできるタグ |
| Delimiter | 注目すべき区切り文字 |
| SpecialComment | コメント内の特殊記法 |
| Debug | デバッグ文 |

#### その他

| グループ名 | 役割 |
|---|---|
| Underlined | 下線テキスト（HTML リンク等） |
| Ignore | 非表示テキスト |
| Error | エラー構文 |
| Todo | TODO / FIXME / XXX |
| Added | diff の追加行 |
| Changed | diff の変更行 |
| Removed | diff の削除行 |

### 6-F. Diagnostic グループ（32）

5段階の重症度（Error / Warn / Info / Hint / Ok）× 6つの表示形式 + 特殊2。

#### 基本（テキスト色）

| グループ名 | 役割 |
|---|---|
| DiagnosticError | Error 重症度の基本色 |
| DiagnosticWarn | Warn 重症度の基本色 |
| DiagnosticInfo | Info 重症度の基本色 |
| DiagnosticHint | Hint 重症度の基本色 |
| DiagnosticOk | Ok 重症度の基本色 |

#### 下線（Underline）

| グループ名 | 役割 |
|---|---|
| DiagnosticUnderlineError | Error の下線（undercurl） |
| DiagnosticUnderlineWarn | Warn の下線 |
| DiagnosticUnderlineInfo | Info の下線 |
| DiagnosticUnderlineHint | Hint の下線 |
| DiagnosticUnderlineOk | Ok の下線 |

#### 仮想テキスト（VirtualText）

| グループ名 | 役割 |
|---|---|
| DiagnosticVirtualTextError | Error の仮想テキスト表示 |
| DiagnosticVirtualTextWarn | Warn の仮想テキスト表示 |
| DiagnosticVirtualTextInfo | Info の仮想テキスト表示 |
| DiagnosticVirtualTextHint | Hint の仮想テキスト表示 |
| DiagnosticVirtualTextOk | Ok の仮想テキスト表示 |

#### 仮想行（VirtualLines）

| グループ名 | 役割 |
|---|---|
| DiagnosticVirtualLinesError | Error の仮想行表示 |
| DiagnosticVirtualLinesWarn | Warn の仮想行表示 |
| DiagnosticVirtualLinesInfo | Info の仮想行表示 |
| DiagnosticVirtualLinesHint | Hint の仮想行表示 |
| DiagnosticVirtualLinesOk | Ok の仮想行表示 |

#### フローティング（Floating）

| グループ名 | 役割 |
|---|---|
| DiagnosticFloatingError | Error のフローティングウィンドウ表示 |
| DiagnosticFloatingWarn | Warn のフローティングウィンドウ表示 |
| DiagnosticFloatingInfo | Info のフローティングウィンドウ表示 |
| DiagnosticFloatingHint | Hint のフローティングウィンドウ表示 |
| DiagnosticFloatingOk | Ok のフローティングウィンドウ表示 |

#### サイン列（Sign）

| グループ名 | 役割 |
|---|---|
| DiagnosticSignError | Error のサイン列アイコン |
| DiagnosticSignWarn | Warn のサイン列アイコン |
| DiagnosticSignInfo | Info のサイン列アイコン |
| DiagnosticSignHint | Hint のサイン列アイコン |
| DiagnosticSignOk | Ok のサイン列アイコン |

#### 特殊

| グループ名 | 役割 |
|---|---|
| DiagnosticDeprecated | 非推奨コード（打ち消し線） |
| DiagnosticUnnecessary | 不要・未使用コード（薄い表示） |

### 6-G. LSP グループ（10）

| グループ名 | 役割 |
|---|---|
| LspReferenceText | カーソル位置シンボルの参照（テキスト） |
| LspReferenceRead | カーソル位置シンボルの読み取り参照 |
| LspReferenceWrite | カーソル位置シンボルの書き込み参照 |
| LspReferenceTarget | 参照先ターゲット（ホバー範囲等） |
| LspSignatureActiveParameter | 関数シグネチャの現在パラメータ |
| LspCodeLens | CodeLens の仮想テキスト |
| LspCodeLensSeparator | CodeLens 間の区切り |
| LspInlayHint | インレイヒント表示 |
| SnippetTabstop | スニペットのタブストップ |
| SnippetTabstopActive | アクティブなスニペットタブストップ |

### 6-H. LSP セマンティックトークン（33+）

LSP サーバーが返すセマンティック情報に基づくハイライト。`@lsp.type.<型>` と `@lsp.mod.<修飾子>` の組み合わせ（`@lsp.typemod.<型>.<修飾子>`）で表現される。

#### @lsp.type.*（型: 23種）

| グループ名 | 役割 |
|---|---|
| @lsp.type.class | クラス定義・参照 |
| @lsp.type.comment | コメントトークン |
| @lsp.type.decorator | デコレーター・アノテーション |
| @lsp.type.enum | 列挙型 |
| @lsp.type.enumMember | 列挙型メンバー |
| @lsp.type.event | イベントプロパティ |
| @lsp.type.function | 関数宣言 |
| @lsp.type.interface | インタフェース型 |
| @lsp.type.keyword | 言語キーワード |
| @lsp.type.macro | マクロ宣言 |
| @lsp.type.method | メソッド宣言 |
| @lsp.type.modifier | 修飾子トークン |
| @lsp.type.namespace | 名前空間・モジュール・パッケージ |
| @lsp.type.number | 数値リテラル |
| @lsp.type.operator | 演算子トークン |
| @lsp.type.parameter | 関数パラメータ |
| @lsp.type.property | メンバープロパティ・フィールド |
| @lsp.type.regexp | 正規表現リテラル |
| @lsp.type.string | 文字列リテラル |
| @lsp.type.struct | 構造体型 |
| @lsp.type.type | その他の型 |
| @lsp.type.typeParameter | 型パラメータ（ジェネリクス） |
| @lsp.type.variable | ローカル・グローバル変数 |

#### @lsp.mod.*（修飾子: 10種）

| グループ名 | 役割 |
|---|---|
| @lsp.mod.abstract | 抽象型・抽象メソッド |
| @lsp.mod.async | async 関数 |
| @lsp.mod.declaration | シンボル宣言 |
| @lsp.mod.defaultLibrary | 標準ライブラリのシンボル |
| @lsp.mod.definition | シンボル定義 |
| @lsp.mod.deprecated | 非推奨シンボル |
| @lsp.mod.documentation | ドキュメント内のシンボル出現 |
| @lsp.mod.modification | 変数への代入参照 |
| @lsp.mod.readonly | 読み取り専用変数・定数 |
| @lsp.mod.static | 静的メンバー |

#### @lsp.typemod.*（組み合わせ）

`@lsp.typemod.<型>.<修飾子>` の形式で、型と修飾子を組み合わせた詳細なハイライトが可能。
例: `@lsp.typemod.function.async`（async 関数）、`@lsp.typemod.variable.readonly`（読み取り専用変数）

### 6-I. TreeSitter グループ（90）

TreeSitter のキャプチャグループ。言語固有の特殊化（例: `@comment.c`）も可能。

#### @variable 系（5）

| グループ名 | 役割 |
|---|---|
| @variable | 変数名全般 |
| @variable.builtin | 組み込み変数（self, this 等） |
| @variable.parameter | 関数パラメータ |
| @variable.parameter.builtin | 組み込みパラメータ |
| @variable.member | メンバー変数・フィールド |

#### @constant / @module / @label 系（6）

| グループ名 | 役割 |
|---|---|
| @constant | 定数 |
| @constant.builtin | 組み込み定数（nil, true 等） |
| @constant.macro | マクロ定数 |
| @module | モジュール・名前空間 |
| @module.builtin | 組み込みモジュール |
| @label | ラベル |

#### @string 系（8）

| グループ名 | 役割 |
|---|---|
| @string | 文字列リテラル |
| @string.documentation | ドキュメンテーション文字列 |
| @string.regexp | 正規表現 |
| @string.escape | エスケープシーケンス |
| @string.special | 特殊文字列 |
| @string.special.symbol | シンボル（Ruby の :sym 等） |
| @string.special.path | パス文字列 |
| @string.special.url | URL 文字列 |

#### @character / @boolean / @number 系（5）

| グループ名 | 役割 |
|---|---|
| @character | 文字リテラル |
| @character.special | 特殊文字 |
| @boolean | 真偽値 |
| @number | 数値 |
| @number.float | 浮動小数点数 |

#### @type / @attribute / @property 系（6）

| グループ名 | 役割 |
|---|---|
| @type | 型定義・型アノテーション |
| @type.builtin | 組み込み型 |
| @type.definition | 型定義の識別子 |
| @attribute | 属性アノテーション（Python デコレーター等） |
| @attribute.builtin | 組み込みアノテーション（@property 等） |
| @property | キー・バリューペアのキー |

#### @function / @constructor / @operator 系（8）

| グループ名 | 役割 |
|---|---|
| @function | 関数定義 |
| @function.builtin | 組み込み関数 |
| @function.call | 関数呼び出し |
| @function.macro | プリプロセッサマクロ |
| @function.method | メソッド定義 |
| @function.method.call | メソッド呼び出し |
| @constructor | コンストラクタ |
| @operator | 演算子（+, * 等） |

#### @keyword 系（15）

| グループ名 | 役割 |
|---|---|
| @keyword | キーワード全般 |
| @keyword.coroutine | コルーチン関連（go, async/await 等） |
| @keyword.function | 関数定義キーワード（func, def 等） |
| @keyword.operator | 英単語演算子（and, or, not 等） |
| @keyword.import | インポート（import, from 等） |
| @keyword.type | 複合型キーワード（struct, enum 等） |
| @keyword.modifier | 修飾子（const, static, public 等） |
| @keyword.repeat | ループ（for, while 等） |
| @keyword.return | return / yield |
| @keyword.debug | デバッグ関連キーワード |
| @keyword.exception | 例外（throw, catch 等） |
| @keyword.conditional | 条件分岐（if, else 等） |
| @keyword.conditional.ternary | 三項演算子（?, : 等） |
| @keyword.directive | プリプロセッサディレクティブ・shebang |
| @keyword.directive.define | プリプロセッサ定義ディレクティブ |

#### @punctuation 系（3）

| グループ名 | 役割 |
|---|---|
| @punctuation.delimiter | 区切り文字（; . , 等） |
| @punctuation.bracket | 括弧（() {} [] 等） |
| @punctuation.special | 特殊記号（文字列補間の {} 等） |

#### @comment 系（6）

| グループ名 | 役割 |
|---|---|
| @comment | コメント |
| @comment.documentation | ドキュメンテーションコメント |
| @comment.error | ERROR / FIXME / DEPRECATED |
| @comment.warning | WARNING / FIX / HACK |
| @comment.todo | TODO / WIP |
| @comment.note | NOTE / INFO / XXX |

#### @markup 系（21）

| グループ名 | 役割 |
|---|---|
| @markup.strong | 太字 |
| @markup.italic | 斜体 |
| @markup.strikethrough | 打ち消し線 |
| @markup.underline | 下線 |
| @markup.heading | 見出し全般 |
| @markup.heading.1 | 見出しレベル 1 |
| @markup.heading.2 | 見出しレベル 2 |
| @markup.heading.3 | 見出しレベル 3 |
| @markup.heading.4 | 見出しレベル 4 |
| @markup.heading.5 | 見出しレベル 5 |
| @markup.heading.6 | 見出しレベル 6 |
| @markup.quote | ブロック引用 |
| @markup.math | 数式 |
| @markup.link | テキスト参照・脚注・引用 |
| @markup.link.label | リンクラベル |
| @markup.link.url | URL リンク |
| @markup.raw | インラインコード |
| @markup.raw.block | コードブロック |
| @markup.list | リストマーカー |
| @markup.list.checked | チェック済みリスト項目 |
| @markup.list.unchecked | 未チェックリスト項目 |

#### @diff / @tag 系（7）

| グループ名 | 役割 |
|---|---|
| @diff.plus | diff の追加テキスト |
| @diff.minus | diff の削除テキスト |
| @diff.delta | diff の変更テキスト |
| @tag | XML/HTML タグ名 |
| @tag.builtin | 組み込みタグ（HTML5 タグ等） |
| @tag.attribute | タグ属性 |
| @tag.delimiter | タグの区切り文字（<, /> 等） |

---

## 7. ハイライトグループ完全対応表

### 7-A. Vim 標準ハイライトグループ

| グループ | Kanagawa (wave) | TokyoNight (night) | Catppuccin (Mocha) |
|---|---|---|---|
| **Comment** | fujiGray `#727169` / italic | `#565f89` / italic | overlay2 `#9399b2` |
| **Constant** | surimiOrange `#FFA066` | `#ff9e64` | peach `#fab387` |
| **String** | springGreen `#98BB6C` | `#9ece6a` | green `#a6e3a1` |
| **Character** | link → String | link → String | link → String |
| **Number** | sakuraPink `#D27E99` | `#ff9e64` | peach `#fab387` |
| **Boolean** | surimiOrange / bold | link → Number | peach `#fab387` |
| **Float** | link → Number | link → Number | link → Number |
| **Identifier** | carpYellow `#E6C384` | `#bb9af7` (magenta) | flamingo `#f2cdcd` |
| **Function** | crystalBlue `#7E9CD8` / bold | `#7aa2f7` | blue `#89b4fa` |
| **Statement** | oniViolet `#957FB8` / bold | `#bb9af7` | mauve `#cba6f7` |
| **Conditional** | link → Statement | link → Statement | link → mauve |
| **Repeat** | link → Statement | link → Statement | link → mauve |
| **Operator** | boatYellow2 `#C0A36E` | `#89ddff` (blue5) | sky `#89dceb` |
| **Keyword** | oniViolet `#957FB8` / italic | `#7dcfff` (cyan) / italic | mauve `#cba6f7` |
| **Exception** | waveRed `#E46876` | link → Statement | red `#f38ba8` |
| **PreProc** | waveRed `#E46876` | `#7dcfff` | pink `#f5c2e7` |
| **Type** | waveAqua2 `#7AA89F` | `#2ac3de` (blue1) | yellow `#f9e2af` |
| **StorageClass** | link → Type | link → Type | yellow `#f9e2af` |
| **Structure** | link → Type | link → Type | yellow `#f9e2af` |
| **Typedef** | link → Type | link → Typedef | yellow `#f9e2af` |
| **Special** | springBlue `#7FB4CA` | `#2ac3de` (blue1) | pink `#f5c2e7` |
| **SpecialChar** | link → Special | link → Special | link → Special |
| **Delimiter** | springViolet2 `#9CABCA` | link → Special | overlay2 `#9399b2` |
| **Tag** | link → Special | link → Label | sapphire `#74c7ec` |
| **Error** | samuraiRed `#E82424` | `#db4b4b` | red `#f38ba8` |
| **Todo** | fg: ui.fg_reverse, bg: diag.info / bold | bg: `#e0af68`, fg: bg | bg: blue, fg: base |

### 7-B. TreeSitter グループ（@variable 系）

| グループ | Kanagawa (wave) | TokyoNight (night) | Catppuccin (Mocha) |
|---|---|---|---|
| **@variable** | fujiWhite `#DCD7BA`（= none） | c.fg `#c0caf5`（= none） | text `#cdd6f4`（= none） |
| **@variable.builtin** | waveRed `#E46876` / italic | `#f7768e` (red) | red `#f38ba8` |
| **@variable.parameter** | oniViolet2（薄紫） | `#e0af68` (yellow) | maroon `#eba0ac` |
| **@variable.member** | carpYellow `#E6C384` | `#73daca` (green1) | lavender `#b4befe` |

### 7-C. TreeSitter グループ（@string 系）

| グループ | Kanagawa (wave) | TokyoNight (night) | Catppuccin (Mocha) |
|---|---|---|---|
| **@string** | link → String | link → String | link → String |
| **@string.regexp** | syn.regex | `#b4f9f8` (blue6) | pink `#f5c2e7` |
| **@string.escape** | syn.regex / bold | `#bb9af7` (magenta) | pink `#f5c2e7` |
| **@string.documentation** | — | `#e0af68` (yellow) | — |

### 7-D. TreeSitter グループ（@function 系）

| グループ | Kanagawa (wave) | TokyoNight (night) | Catppuccin (Mocha) |
|---|---|---|---|
| **@function** | link → Function | link → Function | link → Function |
| **@function.builtin** | — | link → Special | link → Special |
| **@function.call** | — | link → @function | link → Function |
| **@function.method** | — | link → Function | link → Function |
| **@constructor** | springBlue `#7FB4CA` | `#bb9af7` (magenta) | flamingo `#f2cdcd` |

### 7-E. TreeSitter グループ（@keyword 系）

| グループ | Kanagawa (wave) | TokyoNight (night) | Catppuccin (Mocha) |
|---|---|---|---|
| **@keyword** | link → Keyword | `#9d7cd8` / italic | link → Keyword |
| **@keyword.function** | — | `#bb9af7` (magenta) | link → Keyword |
| **@keyword.operator** | boatYellow2 / bold | link → @operator | link → Keyword |
| **@keyword.return** | peachRed `#FF5D62` / italic | link → @keyword | link → Keyword |
| **@keyword.exception** | peachRed `#FF5D62` / bold | link → Exception | red `#f38ba8` |
| **@keyword.import** | link → PreProc | link → Include | link → Include |

### 7-F. TreeSitter グループ（@type 系）

| グループ | Kanagawa (wave) | TokyoNight (night) | Catppuccin (Mocha) |
|---|---|---|---|
| **@type** | link → Type | link → Type | link → Type |
| **@type.builtin** | — | blend(blue1, 0.8) | mauve `#cba6f7` |
| **@type.definition** | — | link → Typedef | — |
| **@attribute** | link → Constant | link → PreProc | link → PreProc |
| **@module** | — | link → Include | link → Include |
| **@label** | — | `#7aa2f7` (blue) | sapphire `#74c7ec` |

### 7-G. TreeSitter グループ（@punctuation 系）

| グループ | Kanagawa (wave) | TokyoNight (night) | Catppuccin (Mocha) |
|---|---|---|---|
| **@punctuation.delimiter** | springViolet2 `#9CABCA` | `#89ddff` (blue5) | overlay2 `#9399b2` |
| **@punctuation.bracket** | springViolet2 `#9CABCA` | `#a9b1d6` (fg_dark) | overlay2 `#9399b2` |
| **@punctuation.special** | springBlue `#7FB4CA` | `#89ddff` (blue5) | overlay2 `#9399b2` |

**注目**: Catppuccin は punctuation をすべて overlay2 で統一。「低優先グループ」の視覚的統一。

### 7-H. LSP セマンティックトークン（重要なもの）

| グループ | Kanagawa | TokyoNight | Catppuccin |
|---|---|---|---|
| @lsp.type.variable | `{}` 空（TS に委ねる） | `{}` 空（TS に委ねる） | — |
| @lsp.type.keyword | link → @keyword | link → @keyword | link → @keyword |
| @lsp.type.parameter | link → @variable.parameter | link → @variable.parameter | link → @variable.parameter |
| @lsp.type.namespace | link → @module | link → @module | link → @module |
| @lsp.mod.readonly | link → Constant | link → @constant | — |
| @lsp.typemod.function.readonly | syn.fun / bold | — | — |

---

## 8. oshicolor v4 への示唆

### 8-A. 最重要: `@variable = "none"` の徹底

3テーマすべてで `@variable` は `none`（Normal.fg を継承）。
最頻出グループへのアクセント色は「目の疲れ」を引き起こすため排除する。
oshicolor でも **`variable` スロットは生成しない**。

### 8-B. 構文色 L 値の設定

| 設定 | v4 当初案 | Catppuccin 実績 | 推奨修正 |
|---|---|---|---|
| 構文色 L_target | 0.62〜0.78 | 0.74〜0.89 | **0.72〜0.85 に上方修正** |
| Comment C | 0.04 | overlay2: ≈0.08 | **0.06〜0.08 に上方修正** |

**アニメ感が出る構文色 L の目安は 0.78〜0.85**（bg L=0.12 のダークテーマ基準）。

### 8-C. Type = 黄（45°）は設計として成立する

kanagawa/tokyonight の `Type = 水色（180-195°）` が「唯一解」ではない。
Catppuccin は `Type = 黄（45°）` で広く受け入れられている。
oshicolor でも image の色が自然に黄系の場合、Type に割り当てて問題ない。

### 8-D. ピンクゾーン（300°〜340°）は使える

kanagawa/tokyonight にない独自性。Special/PreProc に pink（325°）を使う設計。
サブカル・アニメ系の色使いと相性が良く、14アクセント色の全 Hue を活用できる。

### 8-E. Diagnostic の扱い

Catppuccin 方式（構文色流用）が検討に値する。
専用色を持たなくても、undercurl や sign アイコンが意味を補助するため実用上問題は少ない。
oshicolor では **DiagnosticError = 赤系固定値**、他は構文色流用またはシフトで対応できる。

### 8-F. Comment/Delimiter の統一

Catppuccin は `Comment = Delimiter = @punctuation.* = overlay2` で統一。
「低優先グループ」を同色にまとめることで視覚的な静けさが生まれる。
v4 の `special = function C × 0.6` より、**`special = comment と同じ低 C ニュートラル`** の方がシンプル。

### 8-G. フレーバー = oshicolor のコンセプトシステムに対応

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
- [ ] `Keyword/Statement` は 270-285°（紫系）か  ← tokyonight は 190° でも可
- [ ] `String` は 125-130°（緑系）か
- [ ] `Constant` は 25-30°（橙系）か
- [ ] `Comment` の L は Normal.fg より低く（0.45〜0.65 程度）、C は小さいか（0.06〜0.10）
- [ ] 構文色の L が bg との十分なコントラスト差（≧0.55）を持つか
- [ ] `DiagnosticError` は赤系で `String`（緑）と混同しないか
- [ ] `@punctuation.*` は低 C ニュートラルか（構文色と競合しない）
