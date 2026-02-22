# kanagawa.nvim 設計分析・コードマップ

参照リポジトリ: `sample-repo/kanagawa.nvim`

---

## 設計の全体像：3層アーキテクチャ

```
colors.lua（palette）
    ↓  named color → semantic role への写像
themes.lua（ThemeColors）
    ↓  semantic role → Neovim highlight group への写像
highlights/（editor / syntax / treesitter / lsp / plugins）
```

各層が完全に分離しており、上位層を変えずに下位層だけをオーバーライドできる。
ユーザーは `colors.palette.springGreen = "#aabbcc"` と書くだけで、
その色を参照する全グループが連鎖して変わる。

---

## コードマップ

| ファイル | 役割 |
|---|---|
| `lua/kanagawa/colors.lua` | パレット定義 + `setup()` でテーマ色を生成して返すエントリポイント |
| `lua/kanagawa/themes.lua` | `wave / dragon / lotus` の3テーマ分の ThemeColors 定義 |
| `lua/kanagawa/lib/color.lua` | HSLuv ベースの Color クラス（brighten / blend / saturate） |
| `lua/kanagawa/lib/hsluv.lua` | HSLuv 変換の数値計算実装 |
| `lua/kanagawa/highlights/init.lua` | 各 highlights モジュールをまとめて apply するコーディネーター |
| `lua/kanagawa/highlights/editor.lua` | Normal / CursorLine / Visual / Pmenu / Diagnostic 等 UI グループ |
| `lua/kanagawa/highlights/syntax.lua` | 従来構文グループ（Comment / String / Function / Keyword 等） |
| `lua/kanagawa/highlights/treesitter.lua` | Treesitter グループ（`@variable` / `@function` / `@keyword` 等） |
| `lua/kanagawa/highlights/lsp.lua` | LSP 関連グループ |
| `lua/kanagawa/highlights/plugins.lua` | 各プラグイン固有グループ（Telescope / nvim-cmp 等） |
| `lua/kanagawa/init.lua` | `setup()` / `load()` の公開 API、設定のデフォルト値 |
| `palette.py` | 開発者向けツール：KMeans + Lab 空間でパレット候補を抽出するスクリプト |

---

## パレット設計（`colors.lua`）

### 命名思想

hex 値を直接ハイライト定義に書かない。**色に役割を表す固有名詞を付け、名前を介して参照する。**
名前は日本語由来の自然・文化モチーフ（墨・富士・桜・鯉・春・秋・冬）。

```lua
sumiInk0  = "#16161D"  -- 最も暗い背景（墨）
fujiWhite = "#DCD7BA"  -- メイン前景（富士白）
sakuraPink = "#D27E99" -- Number（桜）
carpYellow = "#E6C384" -- Identifier（鯉）
springGreen = "#98BB6C" -- String（春の緑）
autumnRed  = "#C34043" -- Git removed（秋の紅葉）
winterGreen = "#2B3328" -- Diff add 背景（冬の暗い緑）
```

### カラーファミリの構成

```
sumi系   (sumiInk0〜6)     ← wave テーマの bg 7段階
dragon系 (dragonBlack0〜6) ← dragon テーマの bg 7段階
lotus系  (lotusWhite0〜5)  ← lotus（ライト）テーマの bg 6段階

winter系 (winterGreen/Yellow/Red/Blue) ← diff 背景色（低彩度・暗め）
autumn系 (autumnGreen/Red/Yellow)      ← vcs 前景色（高彩度・明るめ）
samurai/ronin                          ← diag error/warning（強調用）
```

---

## ThemeColors 構造（`themes.lua`）

パレット色を以下の5つの名前空間に分類して ThemeColors を構成する。

```lua
theme = {
    syn  = { ... },  -- 構文ハイライト（コードの色分け）
    ui   = { ... },  -- エディタ UI（背景・カーソル・選択等）
    diag = { ... },  -- 診断（error / warn / info / hint / ok）
    vcs  = { ... },  -- Git 変更の前景色（added / removed / changed）
    diff = { ... },  -- diff 表示の背景色（add / delete / change / text）
    term = { ... },  -- Terminal ANSI 16色 + extended 2色
}
```

**構文・UI・診断・VCS が独立した名前空間**になっており混在しない。

### syn グループの色配置

wave テーマの割り当て：

| syn キー | パレット色 | おおよその Hue | 役割 |
|---|---|---|---|
| `fun` | crystalBlue | 220° | 関数名 |
| `type` | waveAqua2 | 180° | 型名 |
| `string` | springGreen | 130° | 文字列 |
| `number` | sakuraPink | 340° | 数値 |
| `constant` | surimiOrange | 30° | 定数 |
| `identifier` | carpYellow | 60° | フィールド・メンバー |
| `keyword` | oniViolet | 280° | 予約語 |
| `operator` | boatYellow2 | 50° | 演算子 |
| `comment` | fujiGray | 無彩色 | コメント |
| **`variable`** | **`"none"`** | — | 変数名（色なし） |

**全グループが異なる Hue を持つ。** `variable = "none"` は意図的：
最頻出グループにアクセント色を当てると目が疲れるため、Normal.fg のままにする。

### ui グループの bg 階調

bg を7段階で定義し、各 UI 要素の深度を表現する：

```lua
bg_m3  ← 最暗（StatusLine、WinSeparator）
bg_m2
bg_m1
bg    ← 基準背景（Normal.bg）
bg_p1 ← ColorColumn、Folded、Gutter
bg_p2 ← CursorLine、TabLineSel
```

---

## diag / vcs / diff の独立設計

構文色とは完全に別の専用色を使用。パレット上の命名も分離されている。

```lua
-- diag: エラー/警告には強い専用色
samuraiRed  → diag.error のみ
roninYellow → diag.warning のみ

-- diff: 背景色は winter 系（低彩度・暗い）で目立ちすぎない
winterGreen → diff.add（背景）
winterRed   → diff.delete（背景）

-- vcs: 前景色は autumn 系（高彩度・明るい）で視認性あり
autumnGreen → vcs.added（前景）
autumnRed   → vcs.removed（前景）
```

diff 背景（winter系）と vcs 前景（autumn系）を意図的に色温度で分けている。

---

## 3テーマの関係

```
palette（約100色の共有プール）
    ├─ wave  (dark)  sumi系 bg + crystalBlue/oniViolet accent（青紫系）
    ├─ dragon (dark) dragonBlack系 bg + dragon系 accent（灰茶・くすみ系）
    └─ lotus (light) lotusWhite系 bg + lotus系 accent（落ち着いた彩度）
```

**3テーマで syn グループの Hue 構成は同一**（string=緑、type=水色、keyword=紫）。
テーマが変わるのは彩度・明度と bg 系の色であり、色相の意味的配置は変わらない。
これにより「どのテーマでも string は緑系」という一貫性が保たれる。

---

## 色操作ライブラリ（`lib/color.lua`）

**HSLuv**（知覚均一 HSL 変換）を採用。

```lua
Color.new(hex):brighten(r, bg)  -- bg の明暗を考慮して明度調整
Color.new(hex):blend(other, r)  -- RGB 空間でブレンド
Color.new(hex):saturate(r)      -- 彩度調整
```

ただしパレット内の主要色はすべて手動で定義されており、
動的な色生成（brighten/blend）は微調整に限定される。
色の数が多いのは「変化点ごとに名前付き定数を持つ」設計思想から。

---

## カスタマイズ設計

### スタイル設定の外部化

font 装飾だけをユーザーが変えられるよう、スタイルを設定ファイルに分離：

```lua
config = {
    commentStyle  = { italic = true },
    functionStyle = {},
    keywordStyle  = { italic = true },
    statementStyle = { bold = true },
    typeStyle     = {},
}
```

色の変更は `colors.palette` または `colors.theme` のオーバーライドで行う。

### `"none"` の活用

```lua
variable   = "none"       -- Normal.fg をそのまま継承
pmenu.fg_sel = "none"     -- 選択時は pass-through（bg だけ変える）
```

`"none"` によって「色を設定しない」を明示的に表現できる。

### コンパイル機能

```lua
config.compile = true
```

highlight 定義を Lua ファイルとして事前生成してキャッシュ。
起動時のハイライト計算コストをゼロにする最適化。

---

## oshicolor が参照すべき設計パターン

| kanagawa の手法 | oshicolor R2 への示唆 |
|---|---|
| palette → ThemeColors → highlights の3層分離 | `ColorPoint[]` → `ThemeSpec`（中間表現）→ `HighlightMap` の構造を検討 |
| `variable = "none"` | 高頻度グループは色を割り当てない |
| syn の各グループに異なる Hue | 不足 Hue の補完戦略が必須 |
| diag/vcs/diff は syn と完全に独立 | semantic 色は固定値として別管理 |
| bg を 7 段階で定義 | `shiftL` による bg 階調生成が必要 |
| `palette.py` が KMeans + Lab 空間でクラスタリング | R1 の抽出と同じ問題意識を著者も持っていた |
