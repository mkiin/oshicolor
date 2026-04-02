# R2/V5 Tonal Palette ベースのカラースキーム生成

## なぜ V5 が必要か

V4（node-vibrant + mini.hues）は以下の問題を抱えていた：

1. **生成色が浮く**: mini.hues の等間隔グリッドがキャラクターの色相から遠い位置に色を配置し、暖色キャラにシアンが原色で出る等の問題。chroma damping で緩和を試みたが根本解決にならない
2. **2つの色空間をまたぐ複雑さ**: vibrant-extractor の HSL Hue グループ → OkLch の syntax 色名への変換が近似であり、境界付近で誤分類する
3. **「探索 → 候補なし → 合成」のパスが複雑**: 何が起きているかデバッグしにくい
4. **R1 の出力（Color Axes: main/sub/accent）を活かせていない**: V4 は node-vibrant を独自に呼んでおり、R1 の3軸構造を使っていない

### 設計調査の結果

material-color-utilities（MCU）と xeno.nvim を調査し、以下の知見を得た：

- **MCU**: seed 1色 → HCT 色空間で tonal palette（T0〜T100）を生成 → Tone 差で WCAG AA コントラストを構造的に保証
- **xeno.nvim**: base + accent 2色 → HSL で10段階スケール → 20色で100+ハイライトグループを機械的にカバー
- **共通点**: 少数の seed 色からスケールを生成し、Tone/Lightness の段階でロールを割り当てる

## 前版との変更対照表

| 項目 | V4（node-vibrant + mini.hues） | V5（Tonal Palette） |
|---|---|---|
| 色抽出の入力 | node-vibrant MMCQ 64色 | R1 の Color Axes（main/sub/accent） |
| seed 色の選定 | signatureColor（C² × pop） | 各軸から1色をスコアリングで選定 |
| パレット生成 | 等間隔 Hue グリッド + damping | 各 seed から tonal palette を生成 |
| bg/surface | neutral 生成（V3 継承） | neutral palette（seed hue, 極小 chroma） |
| syntax 色の決定 | Hue ゾーン探索 → 候補なし → 合成 | tonal palette から Tone で取得（常に成功） |
| contrast 保証 | なし（経験的クランプ） | Tone 差ベースで構造的に保証 |
| 色空間 | OkLch + HSL 混在 | HCT（Hue/Chroma/Tone）に統一 |
| ハイライト対応 | syntax 8色のみ | Editor UI + Diagnostics + Syntax 全対応 |

## 設計方針

### 核心: 3 seed × tonal palette + neutral palette

R1 が出力する Color Axes（main/sub/accent）の各軸から seed 色を1つ選び、各 seed から tonal palette を生成する。加えて main seed の hue を借りた neutral palette で bg/surface 階層を作る。

```
Color Axes (R1 出力)
  main:   [Color, Color, Color, ...]
  sub:    [Color, Color, ...]
  accent: [Color, ...]
       │
       ▼
  Step 1: 各軸から seed 色を1つ選ぶ
       │
       ▼
  mainSeed, subSeed, accentSeed
       │
       ▼
  Step 2: 各 seed から tonal palette を生成
  + neutral palette（mainSeed.hue, chroma ≈ 4）
       │
       ▼
  main[T0..T100], sub[T0..T100], accent[T0..T100], neutral[T0..T100]
       │
       ▼
  Step 3: ロール割り当て（Tone でグループを決定）
       │
       ▼
  Step 4: ハイライトグループへの展開
       │
       ▼
  HighlightMap（Neovim vim.api.nvim_set_hl 形式）
```

### Step 1: seed 色の選定

各軸の Color[] を HCT に変換し、syntax 色として使いやすい色をスコアリングで選ぶ。

```
score(color) = chromaScore × lightnessScore

chromaScore:
  C >= 8 で加点（十分な彩度）
  MCU の target chroma（48）に近いほど高得点

lightnessScore:
  T40〜T80 の範囲に入っているほど高得点（読みやすい範囲）
  T50 付近が最も高い
```

軸内の色は K-means で hue クラスタリング済みなので hue は近い。Tone と Chroma で最も syntax 向きな色を選ぶ。

### Step 2: tonal palette の生成

MCU のアプローチを参考に、各 seed の hue と chroma を保ちながら Tone 0〜100 のスケールを生成する。

```
palette(seed) = for T in [0, 5, 10, ..., 95, 100]:
  HCT(seed.hue, seed.chroma, T) → clamp to sRGB gamut
```

neutral palette は main seed の hue を借りて chroma を極小にする:

```
neutral = for T in [0..100]:
  HCT(mainSeed.hue, 4, T) → clamp to sRGB gamut
```

### Step 3: ロール割り当て

Tone の値でロールを決定する（ダークテーマ）:

```
── neutral palette ──
  Normal.bg:        T10
  CursorLine.bg:    T12
  Pmenu.bg:         T17
  StatusLine.bg:    T20
  Visual.bg:        T25
  Normal.fg:        T90
  Comment.fg:       T60
  LineNr.fg:        T45

── main palette ──
  Keyword:          T80
  Function:         T75
  Operator:         T65

── sub palette ──
  String:           T80
  Type:             T75

── accent palette ──
  Special:          T80
  Constant/Number:  T75

── fixed（画像非依存）──
  DiagnosticError:  HCT(25, 84, 60)   赤
  DiagnosticWarn:   HCT(70, 70, 75)   黄橙
  DiagnosticInfo:   HCT(230, 50, 70)  青
  DiagnosticHint:   HCT(170, 40, 70)  シアン
  DiffAdd:          HCT(135, 40, 20)  暗緑
  DiffDelete:       HCT(25, 40, 20)   暗赤
  DiffChange:       HCT(230, 40, 20)  暗青
```

### Step 4: ハイライトグループへの展開

ロールからハイライトグループへの1対多マッピング（機械的）:

```
── Editor UI ──
Normal        = { bg = neutral.bg, fg = neutral.fg }
NormalFloat   = { bg = neutral.T15, fg = neutral.T85 }
FloatBorder   = { fg = neutral.T40 }
CursorLine    = { bg = neutral.T12 }
CursorLineNr  = { fg = main.T80, bold }
LineNr        = { fg = neutral.T45 }
Visual        = { bg = neutral.T25 }
Search        = { bg = main.T30, fg = main.T90 }
IncSearch     = { bg = main.T50, fg = neutral.T10 }
StatusLine    = { bg = neutral.T20, fg = neutral.T80 }
StatusLineNC  = { bg = neutral.T15, fg = neutral.T55 }
Pmenu         = { bg = neutral.T17, fg = neutral.T80 }
PmenuSel      = { bg = main.T30, fg = main.T90 }
PmenuThumb    = { bg = neutral.T30 }
TabLine       = { bg = neutral.T15, fg = neutral.T60 }
TabLineSel    = { bg = neutral.T20, fg = main.T80 }
TabLineFill   = { bg = neutral.T10 }
VertSplit     = { fg = neutral.T25 }
Folded        = { bg = neutral.T15, fg = neutral.T60 }
FoldColumn    = { fg = neutral.T40 }
SignColumn     = { bg = neutral.T10 }
MatchParen    = { bg = neutral.T25, bold }
NonText       = { fg = neutral.T30 }
Title         = { fg = main.T80, bold }
Directory     = { fg = sub.T80 }

── Diagnostics ──
DiagnosticError = { fg = error }
DiagnosticWarn  = { fg = warn }
DiagnosticInfo  = { fg = info }
DiagnosticHint  = { fg = hint }
DiffAdd         = { bg = diffAdd }
DiffChange      = { bg = diffChange }
DiffDelete      = { bg = diffDelete }

── Syntax（基本グループ）──
Comment     = { fg = neutral.T60, italic }
Keyword     = { fg = main.T80 }
Statement   = { fg = main.T80 }
Conditional = { fg = main.T80 }
Repeat      = { fg = main.T80 }
Function    = { fg = main.T75 }
String      = { fg = sub.T80 }
Character   = { fg = sub.T80 }
Number      = { fg = accent.T75 }
Boolean     = { fg = accent.T75 }
Constant    = { fg = accent.T80 }
Float       = { fg = accent.T75 }
Type        = { fg = sub.T75 }
Operator    = { fg = main.T65 }
Special     = { fg = accent.T80 }
Delimiter   = { fg = neutral.T65 }
Identifier  = { fg = neutral.fg }  ← none（fg 継承）
PreProc     = { fg = main.T80 }
Include     = { fg = main.T80 }
Macro       = { fg = main.T75 }

── Treesitter ──
@variable           = { fg = neutral.fg }  ← none
@variable.parameter = { fg = neutral.T80 }
@variable.member    = { fg = sub.T70 }
@function           = { fg = main.T75 }
@function.method    = { fg = main.T75 }
@function.call      = { fg = main.T75 }
@keyword            = { fg = main.T80 }
@keyword.return     = { fg = main.T80, bold }
@keyword.operator   = { fg = main.T65 }
@string             = { fg = sub.T80 }
@string.escape      = { fg = sub.T70 }
@string.regexp      = { fg = sub.T70 }
@type               = { fg = sub.T75 }
@type.definition    = { fg = sub.T75 }
@constant           = { fg = accent.T80 }
@number             = { fg = accent.T75 }
@boolean            = { fg = accent.T75 }
@attribute          = { fg = accent.T80 }
@namespace          = { fg = main.T80 }
@punctuation        = { fg = neutral.T65 }
@tag                = { fg = main.T80 }
@tag.attribute      = { fg = sub.T70 }
@comment            = { fg = neutral.T60, italic }
```

## contrast 保証

Tone 差で WCAG AA コントラスト比を構造的に保証する:

| 対象 | bg Tone | fg Tone | Tone 差 | 保証 |
|---|---|---|---|---|
| Normal.fg on Normal.bg | T10 | T90 | 80 | 4.5:1 以上 |
| Comment on Normal.bg | T10 | T60 | 50 | 4.5:1 以上 |
| Keyword on Normal.bg | T10 | T80 | 70 | 4.5:1 以上 |
| LineNr on Normal.bg | T10 | T45 | 35 | 3.0:1 以上 |
| Delimiter on Normal.bg | T10 | T65 | 55 | 4.5:1 以上 |

HCT の Tone は L* ベースであり、Tone 差 ≥ 50 で 4.5:1 を保証、≥ 40 で 3.0:1 を保証する。

## 未決定事項

- **HCT の実装方法**: material-color-utilities の TypeScript 版をそのまま使うか、OkLch で近似するか
- **ライトテーマ**: 今回はダークテーマのみ。ライトテーマは Tone を反転させれば同じ構造で対応可能（将来）
- **軸が2つ以下の場合のフォールバック**: accent 軸が空の場合、main seed の hue+60° で代替する（MCU の tertiary 方式）
- **Tone 値の微調整**: 上記の Tone 値は初期値。実際のキャラクター画像で目視検証後に調整する
