# MVP-1/palette-design/V02 Base16 インスパイアのパレット再設計

## なぜ V02 が必要か

V01 は 26 キャラ検証を通じて基本パイプラインを確立したが、以下の構造的課題が判明した（V01 issue.md 参照）:

- **ISSUE-1**: bg/fg を AI 生成に依存しており、どのキャラも似た色になる
- **ISSUE-2**: UI クローム色（StatusLine, TabLine 等）がキャラの個性を表現できていない
- **ISSUE-3**: WCAG 2.x のコントラスト保証がダークテーマで知覚と乖離する
- **ISSUE-7**: config.ts が複雑で難解。palette-generator と highlight-mapper の 2 システムが並走

V02 では palette-generator を一から再設計し、Base16 の「少数色で全部塗る」思想と Catppuccin の blend パターンを取り入れる。

## 前版との変更対照表

| 項目 | V01 | V02 |
|---|---|---|
| AI 依存 | 3色 + bg/fg = 5値 | 2色のみ (primary + 選定された se/te) |
| パレット構造 | AccentPalette(10) + NeutralPalette(10) + UiColors(5) | Neutral(8) + Syntax(8) + UI(2) + Diagnostic(4) = 22色 |
| bg/fg 生成 | AI 出力をクランプ | seed hue から自力導出 |
| UI chrome | UiColors 5色、bg は neutral と同じ | U0/U1 + blend で動的派生 |
| Syntax 色 | AI 3色を直接使用 + gap-fill | seed 2色を色相環の起点、残り 6色を gap-fill |
| Diff bg | Diagnostic 色をそのまま bg に使用 | blend(diagnostic, bg, ratio) |
| コントラスト保証 | WCAG 2.x 相対輝度比 | APCA ベース |
| システム構成 | palette-generator + highlight-mapper 並走 | 1 パレット → 1 マッピングテーブル |

## 設計方針

### 1. AI 依存を最小化する

AI impression 3色から 2色だけを seed として使う。選定は `hueDist × lUsability` のスコアで行う:
- hue が primary から離れている方が高スコア
- L が 0.30-0.75 の「使える範囲」にある方が高スコア (bg/fg に被る色を避ける)
- AI が bg/fg 寄りの低彩度を出した場合でも安定する

### 2. テーマ雰囲気のユーザー選択制 (ThemeMood)

AI の theme_tone 自動判定に頼らず、ユーザーが 3つのプリセットから選ぶ:

| プリセット | bg | accent | Lc 閾値 | chroma boost |
|---|---|---|---|---|
| **Dark** | 暗い (L=0.18) | 深く鮮やか | Lc=60 | 1.0 (なし) |
| **Light Pastel** | 明るい (L=0.94) | パステル許容 | Lc=45 | 1.0 (なし) |
| **Light** | 明るい (L=0.94) | くっきり | Lc=60 | 1.5 |

画像入力 → AI 分析 → 3ボタンで mood 選択 → パレット生成。

### 3. Syntax は seed の L/C をベースに

固定 L テーブルを廃止。S0/S1 は seed そのものの L/C を使い、S2-S7 は seed 平均 L/C に jitter をかける。ensureContrast で可読性に必要な分だけ調整する。キャラの「深い・鮮やか・淡い」といった雰囲気が維持される。

### 4. Syntax と UI の責務分離

- **Syntax**: seed の hue を起点に色相環ベースで 8色を生成
- **UI chrome**: seed 2色 + blend で StatusLine/TabLine/WinBar にキャラの個性を出す

### 5. blend で派生

パレットに色を増やさず、Catppuccin パターンの `blend(accent, base, ratio)` で動的生成する。

### 6. APCA ベースのコントラスト保証

Color.js の APCA 実装を参考に移植。light テーマで L を下げる際は、ΔL に比例して chroma を補償し色味を維持する。

## パレット定義: 22色

```
── Neutral (8色) ──────────────────────────────────────
N0  bg         エディタ背景
N1  surface    Float, Pmenu bg
N2  overlay    CursorLine, Folded bg
N3  highlight  Visual, PmenuSel bg
N4  subtle     LineNr, border, NonText, Delimiter
N5  dim        comment
N6  text       fg
N7  bright     強調テキスト

── Syntax (8色) ───────────────────────────────────────
S0  accent     Special / Todo / Title         seed1 hue (色相環の起点)
S1  keyword    Keyword / Statement            seed2 hue (色相環の固定点)
S2  func       Function                       色相環 gap-fill
S3  string     String / Character             色相環 gap-fill
S4  type       Type                           色相環 gap-fill
S5  number     Number / Boolean / Constant    色相環 gap-fill
S6  operator   Operator                       色相環 gap-fill
S7  preproc    PreProc / Include              色相環 gap-fill

── UI (2色) ───────────────────────────────────────────
U0  primary    seed1 (キャラのメインカラー)
U1  secondary  seed2 (キャラのサブカラー)

── Diagnostic (4色) ───────────────────────────────────
D0  error      hue ≈ 25  (赤)
D1  warn       hue ≈ 85  (黄)
D2  info       hue ≈ 250 (青)
D3  hint       hue ≈ 165 (緑)
```

## Seed 選定

```
AI impression 3色 (primary / secondary / tertiary)
  ↓
score = hueDist(primary, candidate) × lUsability(candidate.l)
  lUsability: L < 0.20 → 0.1 / L 0.20-0.30 → 0.5 / L 0.30-0.75 → 1.0 / L 0.75-0.85 → 0.5 / L > 0.85 → 0.1
  ↓
primary + (se/te のうちスコアが高い方) = seed 2色
  ↓
seed は Syntax と UI の両方の起点として共有する
```

## Neutral (N0-N7) 生成

根拠: MD3 Tonal Palette、Tailwind CSS v4.2 OKLCH、APCA

- hue: seed primary の hue をそのまま継承（黄色系 h≈60-120 は chroma を補正）
- bg chroma: 0.015〜0.02（MD3 Chroma=6 相当）
- fg chroma: 0.01〜0.015（bg より低彩度、フリンジ防止）
- ΔL (bg-fg): 0.60〜0.70（快適ゾーン）

```
Dark テーマ:
  N0  bg        oklch(0.18,  0.018, hue)     base
  N1  surface   oklch(0.21,  0.018, hue)     +0.03
  N2  overlay   oklch(0.23,  0.018, hue)     +0.05
  N3  highlight oklch(0.28,  0.018, hue)     +0.10
  N4  subtle    oklch(0.40,  0.012, hue)     中間帯
  N5  dim       oklch(0.50,  0.012, hue)     comment
  N6  text      oklch(0.85,  0.012, hue)     fg
  N7  bright    oklch(0.90,  0.010, hue)     強調

Light テーマ:
  N0  bg        oklch(0.94,  0.018, hue)     base
  N1  surface   oklch(0.91,  0.018, hue)     -0.03
  N2  overlay   oklch(0.89,  0.018, hue)     -0.05
  N3  highlight oklch(0.84,  0.018, hue)     -0.10
  N4  subtle    oklch(0.65,  0.012, hue)     中間帯
  N5  dim       oklch(0.55,  0.012, hue)     comment
  N6  text      oklch(0.25,  0.012, hue)     fg
  N7  bright    oklch(0.18,  0.010, hue)     強調
```

## Syntax (S0-S7) 生成

```
S0 = seed1 (hue, L, C をそのまま使用)
S1 = seed2 (hue, L, C をそのまま使用)
S2-S7 = seed1, seed2 が作る色相環の gap を均等に埋める 6色

S2-S7 の L/C:
  baseL = avg(seed1.l, seed2.l)
  baseC = max(avg(seed1.c, seed2.c), SYNTAX_C_MIN)
  L = baseL + L_JITTER[i]  (±0.04 程度の jitter)
  C = baseC × C_JITTER[i]  (0.85-1.1 の乗数)

全色に ensureContrast(Sx, N0, preset.lcSyntax, preset.chromaBoost) を適用
```

## UI (U0-U1) + blend 派生

```
U0 = seed1 (ensureContrast 済み)
U1 = seed2 (ensureContrast 済み)

blend(accent, base, ratio) = ratio × accent + (1 - ratio) × base

U0_bg   = blend(U0, N0, 0.08)   StatusLine bg, WinBar bg
U0_dim  = blend(U0, N0, 0.04)   StatusLineNC bg, WinBarNC bg
U1_bg   = blend(U1, N0, 0.10)   TabLineSel bg
U0_sep  = blend(U0, N0, 0.15)   WinSeparator fg
```

U0 (primary) = 常に見える UI。U1 (secondary) = 選択・フォーカス時に現れる UI。

## Diagnostic (D0-D3)

固定 hue + seed の L/C から導出。

Diff bg は blend で生成:
```
DiffAdd    bg = blend(D3, N0, 0.18)
DiffChange bg = blend(D2, N0, 0.18)
DiffDelete bg = blend(D0, N0, 0.18)
DiffText   bg = blend(D2, N0, 0.30)
```

Blend ratio の根拠: Catppuccin の実測値。

## マッピングテーブル

```
── Editor UI ──────────────────────────────────────────
Normal            fg=N6    bg=N0
NormalFloat       fg=N6    bg=N1
FloatBorder       fg=U0
FloatTitle        fg=U0    bold
CursorLine                 bg=N2
CursorLineNr      fg=U0    bold
LineNr            fg=N4
Visual                     bg=N3
Search            fg=N0    bg=U0
IncSearch         fg=N0    bg=U1    bold
CurSearch         fg=N0    bg=U0    bold
MatchParen                 bg=N3    bold
Pmenu             fg=N6    bg=N1
PmenuSel                   bg=N3
PmenuSbar                  bg=N1
PmenuThumb                 bg=N4
StatusLine        fg=N6    bg=U0_bg
StatusLineNC      fg=N4    bg=U0_dim
WinBar            fg=N6    bg=U0_bg
WinBarNC          fg=N4    bg=U0_dim
TabLine           fg=N4    bg=N1
TabLineSel        fg=U1    bg=U1_bg  bold
TabLineFill                bg=N0
WinSeparator      fg=U0_sep
Folded            fg=N5    bg=N2
FoldColumn        fg=N4
SignColumn                 bg=N0
NonText           fg=N4
Title             fg=U0    bold

── Syntax ─────────────────────────────────────────────
Comment           fg=N5    italic
Keyword           fg=S1
Statement         fg=S1
Conditional       fg=S1
Repeat            fg=S1
Function          fg=S2
Operator          fg=S6
String            fg=S3
Character         fg=S3
Type              fg=S4
Number            fg=S5
Boolean           fg=S5
Float             fg=S5
Constant          fg=S5
Special           fg=S0
Delimiter         fg=N4
Identifier        fg=N6
PreProc           fg=S7
Include           fg=S7
Todo              fg=S0    bold

── Diagnostic ─────────────────────────────────────────
DiagnosticError         fg=D0
DiagnosticWarn          fg=D1
DiagnosticInfo          fg=D2
DiagnosticHint          fg=D3
DiagnosticVirtualText*  fg=D0-D3
DiagnosticUnderline*    undercurl
DiagnosticSign*         fg=D0-D3

── Diff ───────────────────────────────────────────────
DiffAdd                 bg=blend(D3, N0, 0.18)
DiffChange              bg=blend(D2, N0, 0.18)
DiffDelete              bg=blend(D0, N0, 0.18)
DiffText                bg=blend(D2, N0, 0.30)
```

## 変更内容

### 削除するコード

- `src/features/palette-generator/` — 全て削除して再実装

### 新規実装

```
src/features/palette-generator/
├── types/
│   ├── vision-result.ts     VisionResult (neutral フィールド削除)
│   └── palette.ts           Palette 型 (Neutral + Syntax + UI + Diagnostic)
├── usecases/
│   ├── config.ts            N0-N7 L テーブル + blend ratio
│   ├── seed-selection.ts    AI 3色 → seed 2色の選定
│   ├── neutral.ts           seed hue → N0-N7
│   ├── syntax.ts            seed 2色 → S0-S7 (色相環 gap-fill)
│   ├── ui.ts                seed 2色 → U0-U1 + blend 派生
│   ├── diagnostic.ts        D0-D3 生成
│   ├── contrast.ts          APCA 実装 (≈40行) + ensureContrast
│   ├── blend.ts             blend(accent, base, ratio)
│   └── generate-palette.ts  パイプライン統合
├── stores/
│   ├── vision-result.atom.ts
│   └── palette.atom.ts
├── components/
│   └── palette-view.tsx
└── index.ts
```

### 影響を受ける外部コード

- `src/features/color-analyzer/usecases/config.ts` — VisionResultSchema から neutral 削除
- `src/features/color-analyzer/types/color-analyzer.ts` — VisionResult import は維持
- `src/features/highlight-mapper/` — palette-generator に統合。マッピングテーブルは palette-generator 内に移動
- `src/routes/index.tsx` — VisionResult の型変更に追従

### リサーチ成果の参照

- Neutral パラメータ: bg/fg リサーチ (Gemini)
- APCA 実装: V01 research/color-js-contrast.md
- Blend ratio: V01 research/catppuccin.md
- マッピング設計: V01 research/mini-base16.md
