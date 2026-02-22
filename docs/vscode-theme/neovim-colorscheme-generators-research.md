# Neovim カラースキーマ自動生成ツール 調査レポート

> 調査対象: `sample-repo/` 配下の各プロジェクト
> 調査日: 2026-02-22

---

## 調査対象一覧

| プロジェクト | 入力 | 色空間 | 生成方式 |
|---|---|---|---|
| xeno.nvim | base色 + accent色（2色） | HSL | トーンスケール派生 |
| Root Loops | パラメータ（6個） | Okhsl | Hue均等分割 |
| nvim-highlite | 50+個のセマンティックロール色 | RGB整数 | 直接定義 |

---

## 1. xeno.nvim

### 設計思想

**「2色から10段階スケールを生成し、スケール位置でロールを決める」**

ユーザーが渡すのは `base`（背景色）と `accent`（強調色）の2色のみ。
それぞれを10段階（100〜950）のトーンスケールに展開し、
すべてのハイライトグループはスケール上の位置（`base_200`, `accent_100` 等）で決まる。

### 色生成メカニズム（`palette.lua`）

```lua
-- 固定明度テーブル（ダーク）
lightness = {
  [100] = 0.900,  -- 最も明るい（fg 域）
  [200] = 0.750,
  [300] = 0.650,
  [400] = 0.600,
  [500] = 0.480,  -- 中間
  [600] = 0.280,
  [700] = 0.195,
  [800] = 0.140,
  [900] = 0.115,
  [950] = 0.090,  -- 最も暗い（bg 域）
}
```

入力色の Hue/Saturation を維持しつつ、L だけ各段階の固定値に置き換える（HSL 空間）。
`contrast` パラメータは中点（0.5）からの距離を拡張する係数。
`variation` パラメータはスケールの広がりを調整する。

### ロール割り当て（`syntax.lua`）

```
accent_100（最も明るい accent）→ Keyword / Type / String / Constant / @string
accent_200                       → @keyword / @keyword.function / @keyword.operator
accent_300                       → @number
base_200                         → Function / @function
base_300                         → Identifier / Operator / Special / Boolean
base_500                         → Comment（中間の暗さ）
red（固定色）                    → Error
```

**ポイント**: `accent_100` と `accent_200` の差は明度 0.15 程度（0.90 vs 0.75）。
Keyword/Type/String が同一色（accent_100）になる設計。
差別化は色ではなく「どの token に当たるか」という意味論でのみ行っている。

オプションで `red`, `green`, `yellow`, `orange`, `blue`, `purple`, `cyan` を上書き可能。
エラーには `red`（デフォルト `#E86671`）が固定で使われる。

### xeno.nvim まとめ

```
入力: base色 + accent色
         ↓
    HSL分解 → 固定L テーブルで10段階生成
         ↓
    スケール位置 → ロール割り当て（100=明, 950=暗）
         ↓
    Neovim hi 定義
```

---

## 2. Root Loops

### 設計思想

**「Hue ホイールを均等分割して ANSI 16色を生成し、そこから全ハイライトを決める」**

直接色を指定しない。パラメータ（スライダー）を操作して色調を決める。

| パラメータ | 役割 |
|---|---|
| `fruit`（enum 12種） | アクセント Hue の起点（0〜360° に均等マッピング） |
| `flavor`（Fruity/Classic/Intense） | Hue に +0°/+15°/+30° シフト |
| `artificialColors`（0〜10） | アクセント彩度（Okhsl S） |
| `sugar`（1〜10） | アクセント明度（Okhsl L） |
| `milk`（0〜3） | 背景/前景の明度（ロジスティック関数で連続制御） |
| `sogginess`（0〜10） | ベース色（bg/fg）の彩度 |

### 色生成メカニズム（`cereals.ts`）

```typescript
// アクセント色: 360°を6等分してOkhslで生成
const numberOfAccentColors = 6;
for (let i = 0; i <= numberOfAccentColors; i++) {
  const hue = Math.round(360 / numberOfAccentColors) * i + accentHueShift;
  accentColors.push({ mode: "okhsl", h: hue, s: accentSaturation, l: accentLightness });
}
// → 60°間隔で red/yellow/green/cyan/blue/magenta が生成される

// bg/fg: ロジスティック関数でmilk量→明度に変換
const backgroundFn = logisticsFn(4, 96);   // milk=0→L=4%, milk=3→L=96%
const foregroundFn = logisticsFn(96, 4);   // milk=0→L=96%, milk=3→L=4%
```

**色空間に Okhsl を使用**（culori ライブラリ）。
OKLab 知覚均一性を HSL の操作感で扱える色空間。
Hue ホイールの等間隔が知覚的にも等間隔になる。

### ロール割り当て（`neovim.ts`）

ANSI 16色として生成された `Cereals` 構造体から直接マッピング。

```typescript
// Cereals = { black, red, green, yellow, blue, magenta, cyan, white, + bright variants }

{ group: "@variable.builtin",    fg: c.darkred    }  // 暗い赤
{ group: "@keyword.function",    fg: c.darkmagenta }  // 暗いマゼンタ
{ group: "@type.builtin",        fg: c.darkyellow  }  // 暗い黄
{ group: "@string.regexp",       fg: c.darkred     }  // 暗い赤
{ group: "@constructor",         fg: c.yellow      }  // 明るい黄
{ group: "@markup.heading",      fg: c.darkblue, style: "bold" }
{ group: "@comment.error",       fg: c.background, bg: c.red }
{ group: "@comment.todo",        fg: c.background, bg: c.blue }
```

**ポイント**: ロール割り当てはANSI色名（red/green/blue...）の「意味」に基づく固定ルール。
生成された色の実際の Hue に関わらず、`red` → エラー系・警告系に使われる。

### Root Loops まとめ

```
入力: パラメータ群（fruit=Hue起点, sugar=明度, etc.）
         ↓
    Okhsl: 60°均等分割でアクセント6色生成
    Okhsl: ロジスティック関数でbg/fg生成
         ↓
    ANSI 16色パレット
         ↓
    意味ベースの固定マッピング（red→エラー, blue→リンク等）
         ↓
    Neovim .vim ファイル
```

---

## 3. nvim-highlite

### 設計思想

**「ハイライトグループと 1:1 対応するセマンティックロールを事前定義し、パレットとして渡す」**

ユーザーは直接ハイライトグループに色を渡さない。
代わりに、意味的に名付けられたパレットキー（50+個）に色を渡す。
フレームワークがパレットを受け取り、ハイライトグループへの展開を自動化する。

### パレット定義（`highlite.lua` 抜粋）

```lua
palette = {
  -- 構文
  keyword      = 0x60AFFF,
  string       = 0x70D533,
  number       = 0xFFB7B7,
  boolean      = 0xF0DF33,
  func         = 0xCF55F0,
  type         = 0x33DBC3,
  constant     = 0xF0AF00,
  identifier   = 0xC0C0C0,
  comment      = 0x808080,

  -- keyword の細分化
  keyword_function  = 0x33DBC3,
  keyword_operator  = 0x22FF22,
  keyword_return    = 0x60AFFF,
  loop              = 0x2BFF99,
  conditional       = 0x95C5FF,

  -- PreProc 細分化
  define   = 0x7766FF,
  include  = 0x99FF99,
  macro    = 0x7766FF,
  preproc  = 0xF4C069,

  -- 診断
  error   = 0xEE4A59,
  warning = 0xFF8900,
  hint    = 0xD5508F,
  info    = 0xFFB7B7,

  -- UI
  bg              = 0x202020,
  bg_contrast_low = 0x353535,
  bg_contrast_high= 0x505050,
  text            = 0xC0C0C0,

  -- ... 合計 50+ キー
}
```

### グループ展開（`default.lua`）

```lua
-- パレットキー → ハイライトグループ
Keyword    = { fg = palette.keyword }
Function   = { fg = palette.func }
Type       = { fg = palette.type }
Repeat     = { fg = palette.loop, italic = true }
Conditional= { fg = palette.conditional, italic = true }
Exception  = { fg = palette.throw, bold = true }
Include    = { fg = palette.include }
Macro      = { fg = palette.macro, italic = true }

-- TreeSitter は link で吸収
SpecialChar = "@string.escape"
```

link 解決はフレームワーク側でメタテーブル経由で行う（遅延評価）。
カスタムパレットを渡すだけで全グループが自動更新される設計。

### nvim-highlite まとめ

```
入力: 50+個のセマンティックロール色（手動定義）
         ↓
    フレームワークがパレット → グループ変換テーブルを適用
         ↓
    link でTreeSitterグループを吸収
         ↓
    Neovim .lua ファイル
```

---

## 各ツールの設計思想比較

| 観点 | xeno.nvim | Root Loops | nvim-highlite |
|---|---|---|---|
| 入力の少なさ | ★★★（2色） | ★★★（パラメータ） | ★（50+色） |
| キャラクターの色の反映 | △（スケールを通す） | ✗（パラメトリック） | ✓（直接） |
| 色の見た目の一貫性 | ★★★（スケールで保証） | ★★★（Okhsl均等分割） | ユーザー次第 |
| Diagnostic の扱い | 固定（red固定） | ANSI red に対応 | 専用ロール（error/warning/hint/info） |
| ロール間の差別化 | スケール位置のみ | ANSI色名の意味 | 全ロール独立色 |
| TreeSitter対応 | link（一部直接定義） | link（ANSI経由） | link（フレームワーク） |

---

## oshicolor への示唆

### 1. xeno.nvim から: 「トーンスケール」という発想

2色から10段階スケールを生成するアプローチは、oshicolor の問題（Zone A/B の分断）に対する答えになりうる。

oshicolor 応用案:
```
抽出色の中から signature color（C最大）を選ぶ
  ↓
OKLch でトーンスケール（L=0.1〜0.9、同一H/C）を生成
  ↓
スケール位置でロールを決定
  → L=0.90 → fg
  → L=0.70 → keyword（アクセント）
  → L=0.50 → function
  → L=0.30 → comment
  → L=0.12 → bg（ほぼ無彩色、C下げる）
```

xeno.nvim との違いは色空間（HSL → OKLch）と入力（ユーザー指定 → 抽出色）。

### 2. Root Loops から: 「Hue ホイール均等分割」という発想

60°ごとに Hue を分割して6色を生成する方式。
oshicolor 応用案:
```
抽出色のsignatureHue（Hue=θ）を起点に
  θ+0°   → keyword
  θ+60°  → string
  θ+120° → type
  θ+180° → number
  θ+240° → function
  θ+300° → special
```

これにより:
- 常に視覚的に均等なアクセントカラーが揃う
- キャラクターの「空気感（Hue）」が全体に引き継がれる
- Zone B の「固定ターゲットHue（緑/水色/金）」という制約が外れる

Okhsl 色空間を使えば知覚的に均等な60°間隔が保たれる。

### 3. nvim-highlite から: 「ロールの粒度」という設計

50+個のセマンティックロールを持つnvim-highliteが示す教訓:
- `keyword` だけでなく `keyword_function`, `keyword_return`, `loop`, `conditional` を分けることで
  コードが「言語の構造ごとに色付き」になり読みやすくなる
- ただし全ロールに独立した色を割り当てることは oshicolor の自動生成では困難
- **解決策**: ロールを「色クラスター」に分類し、クラスター内は同色または明度差のみで対応する

```
クラスターA（keyword 系）: keyword / conditional / loop / storage / exception → 同色
クラスターB（construct 系）: function / method / constructor              → 同色
クラスターC（value 系）: string / character                               → 同色
クラスターD（literal 系）: number / boolean / constant                    → 同色
クラスターE（type 系）: type / interface / enum                           → 同色
クラスターF（diagnostic 系）: error / warning / hint / info               → 専用4色
```

これにより「6色入力 → 全グループ展開」という設計が可能になる。

---

## 総合まとめ: oshicolor の新設計への示唆

3つのツールすべてに共通する原則:

> **「少ないパラメータから、一貫したルールで全色を派生させる」**

現行 Zone A/B の問題は、Zone A（C ランク）と Zone B（Hue ターゲット）が異なるルールで動くことで一貫性が壊れている点にある。

新設計の方向性として有力な組み合わせ:

```
抽出色 → signatureHue を取得
  ├─ bg/fg: OKLch トーンスケール（xeno.nvim 方式）
  │    signature の H を保ちつつ C=0.02, L を固定
  │
  └─ アクセント: Okhsl Hue ホイール均等分割（Root Loops 方式）
       signatureHue を起点に 60°刻みで6色
       → keyword / string / type / number / function / special

Diagnostic色: 固定（error=red系 は Root Loops / nvim-highlite の共通解）
              または signature から独立した固定4色
```

この方式の利点:
- Zone A/B という分断がなくなる（全色を1つの原理で生成）
- キャラクターの色（signatureHue）が全アクセントに引き継がれる
- 「緑でないと string」「水色でないと type」という制約がなくなる
