# MVP-1/palette-design/V02 仕様

## 制約

- `any`, `as`, `unknown` は使用禁止。ユーザーが確実に保証できる場合のみ例外
- コンポーネントは Editor / Syntax / Diagnostic で分離する。1つにまとめない
- 状態管理は Jotai でボトムアップに構築する（上位の atom から下位を派生しない）
- ユニットテストは `tests/` 以下に作成する（`src/` 内には置かない）
- 実装開始時に既存の palette-generator コードを全て削除してから着手する
- 各実装ステップ完了時に `pnpm lint` を実行し、エラーがなくなるまで修正する

---

## §1 型定義

### VisionResult (AI 出力)

```typescript
type VisionResult = {
  impression: {
    primary:   { hex: string; reason: string };
    secondary: { hex: string; reason: string };
    tertiary:  { hex: string; reason: string };
  };
  theme_tone: "dark" | "light";
};
```

### Oklch (内部計算用)

```typescript
type Oklch = {
  l: number;  // 0-1
  c: number;  // 0-0.4
  h: number;  // 0-360
};
```

### Palette (最終出力)

```typescript
type ThemeTone = "dark" | "light";
type ThemeMood = "dark" | "light-pastel" | "light";

type NeutralSlot =
  | "bg" | "surface" | "overlay" | "highlight"
  | "subtle" | "dim" | "text" | "bright";

type SyntaxSlot =
  | "accent" | "keyword" | "func" | "string"
  | "type" | "number" | "operator" | "preproc";

type UiSlot = "primary" | "secondary";

type DiagnosticSlot = "error" | "warn" | "info" | "hint";

type Palette = {
  mood: ThemeMood;
  tone: ThemeTone;
  seeds: { primary: string; secondary: string };
  neutral: Record<NeutralSlot, string>;
  syntax: Record<SyntaxSlot, string>;
  ui: Record<UiSlot, string>;
  diagnostic: Record<DiagnosticSlot, string>;
};
```

---

## §2 Config

### Mood プリセット (MOOD_PRESET)

各 mood で Neutral L テーブル、Lc 閾値、chroma boost、Diagnostic L を切り替える。

```typescript
const MOOD_PRESET = {
  dark: {
    tone: "dark",
    neutralL: [0.18, 0.21, 0.23, 0.28, 0.40, 0.50, 0.85, 0.90],
    lcSyntax: 60,  lcDim: 45,  lcUi: 45,
    chromaBoost: 1.0,
    diagnosticL: 0.72,
  },
  "light-pastel": {
    tone: "light",
    neutralL: [0.94, 0.91, 0.89, 0.84, 0.65, 0.55, 0.25, 0.18],
    lcSyntax: 45,  lcDim: 30,  lcUi: 35,
    chromaBoost: 1.0,    // パステル許容: chroma 補償なし
    diagnosticL: 0.55,
  },
  light: {
    tone: "light",
    neutralL: [0.94, 0.91, 0.89, 0.84, 0.65, 0.55, 0.25, 0.18],
    lcSyntax: 60,  lcDim: 45,  lcUi: 45,
    chromaBoost: 1.5,    // くっきり: chroma を積極補償
    diagnosticL: 0.45,
  },
} as const;
```

### その他の定数

```typescript
const NEUTRAL_C = {
  bg:     0.018,   // N0-N3
  mid:    0.012,   // N4-N5
  text:   0.012,   // N6
  bright: 0.010,   // N7
} as const;

const YELLOW_HUE_RANGE = { min: 60, max: 120 } as const;
const YELLOW_C_OVERRIDE = 0.015;

const SYNTAX_C_MIN = 0.08;

const BLEND_RATIO = {
  statusBg:    0.08,
  statusBgDim: 0.04,
  tabSel:      0.10,
  winSep:      0.15,
  diffBg:      0.18,
  diffText:    0.30,
} as const;

const DIAGNOSTIC_HUE = {
  error: 25,
  warn:  85,
  info:  250,
  hint:  165,
} as const;

const DIAGNOSTIC_C_MIN = 0.12;

const MIN_HUE_GAP = 30;
const MIN_DELTA_E = 0.08;
```

---

## §3 パイプライン

```
VisionResult + ThemeMood (ユーザー選択)
  │
  ├─ preset = MOOD_PRESET[mood]
  ├─ §4 selectSeeds()                     → seed 2色
  ├─ §5 generateNeutral(hue, preset)      → N0-N7
  ├─ §6 generateSyntax(seeds, preset, bg) → S0-S7
  ├─ §7 generateUi(seeds, preset, bg)     → U0, U1
  ├─ §8 generateDiagnostic(c, preset, bg) → D0-D3
  │
  └─ Palette
```

---

## §4 Seed 選定

```
selectSeeds(input: VisionResult): { primary: Oklch; secondary: Oklch }

1. impression.primary, secondary, tertiary を OKLCH に変換
2. primary = impression.primary
3. secondary = se, te のうちスコアが高い方
   score = hueDist(primary, candidate) × lUsability(candidate.l)
   lUsability:
     L < 0.20  → 0.1  (bg に近い)
     L 0.20-0.30 → 0.5
     L 0.30-0.75 → 1.0  (最適ゾーン)
     L 0.75-0.85 → 0.5
     L > 0.85  → 0.1  (fg/bg に近い)
4. 低彩度補正:
   - 選定された secondary の C < 0.015 の場合、hue が不安定
   - primary の hue + 180° を secondary の hue として上書き
   - primary の C < 0.015 の場合、secondary の hue を primary に上書き
```

---

## §5 Neutral 生成

```
generateNeutral(primaryHue: number, preset: MoodPreset): Record<NeutralSlot, string>

1. hue = primaryHue
2. 黄色系判定:
   hue が YELLOW_HUE_RANGE 内 → bg chroma を YELLOW_C_OVERRIDE (0.015) に下げる
3. slots = ["bg", "surface", "overlay", "highlight", "subtle", "dim", "text", "bright"]
4. i = 0..7:
   L = preset.neutralL[i]
   C = i <= 3 ? NEUTRAL_C.bg
     : i <= 5 ? NEUTRAL_C.mid
     : i === 6 ? NEUTRAL_C.text
     : NEUTRAL_C.bright
   result[slots[i]] = oklchToHex(L, C, hue)
```

---

## §6 Syntax 生成

```
generateSyntax(
  seed1: Oklch, seed2: Oklch,
  preset: MoodPreset, bgHex: string,
): Record<SyntaxSlot, string>

Step 1: hue 配置
  S0 = seed1.h (固定)
  S1 = seed2.h (固定)
  S2-S7 = gap-fill (後述)

Step 2: gap-fill
  a. seed1.h と seed2.h を色相環上に配置
  b. 2つの弧 (arc) を計算:
     arc_cw  = seed1→seed2 の時計回り角度
     arc_ccw = 360 - arc_cw
  c. 残り 6色を弧の大きさに比例配分:
     n_cw  = round(6 * arc_cw / 360)
     n_ccw = 6 - n_cw
  d. 各弧内で均等配置:
     arc_cw 内: seed1.h + arc_cw * k / (n_cw + 1)  (k = 1..n_cw)
     arc_ccw 内: seed2.h + arc_ccw * k / (n_ccw + 1) (k = 1..n_ccw)
  e. enforceMinHueGap:
     全 hue ペアの距離が MIN_HUE_GAP (30°) 以上になるよう
     バネモデルで微調整 (V01 ロジック踏襲)

Step 3: L/C 割り当て (seed ベース)
  S0: L = seed1.l, C = seed1.c  (seed そのまま)
  S1: L = seed2.l, C = seed2.c  (seed そのまま)
  S2-S7:
    baseL = avg(seed1.l, seed2.l)
    baseC = max(avg(seed1.c, seed2.c), SYNTAX_C_MIN)
    L = clamp(baseL + L_JITTER[i], 0.25, 0.9)
      L_JITTER = [0, 0, 0.04, -0.02, 0.06, -0.04, 0.08, 0.02]
    C = max(baseC × C_JITTER[i], SYNTAX_C_MIN)
      C_JITTER = [1, 1, 0.95, 1.05, 0.9, 1.1, 0.85, 1.0]

Step 4: コントラスト保証
  各色に ensureContrast(hex, bgHex, preset.lcSyntax, preset.chromaBoost)

Step 5: 弁別性チェック
  全ペアの deltaE_ok >= MIN_DELTA_E (0.08) を検証
  違反 → gap-fill 色 (S2-S7) の L を ±0.03 シフトして再チェック (最大 5回)
```

---

## §7 UI 生成

```
generateUi(
  seed1: Oklch, seed2: Oklch,
  preset: MoodPreset, bgHex: string,
): Record<UiSlot, string>

1. U0 = oklchToHex(seed1) → ensureContrast(U0, bgHex, preset.lcUi, preset.chromaBoost)
2. U1 = oklchToHex(seed2) → ensureContrast(U1, bgHex, preset.lcUi, preset.chromaBoost)
```

---

## §8 Diagnostic 生成

```
generateDiagnostic(
  seedC: number, preset: MoodPreset, bgHex: string,
): Record<DiagnosticSlot, string>

1. L = preset.diagnosticL
2. C = max(seedC * 0.8, DIAGNOSTIC_C_MIN)
3. slots: error, warn, info, hint
4. 各色: oklchToHex(L, C, DIAGNOSTIC_HUE[slot])
         → ensureContrast(hex, bgHex, preset.lcSyntax, preset.chromaBoost)
```

---

## §9 blend

```
blend(accent: string, base: string, ratio: number): string

sRGB 線形補間 (Catppuccin 準拠、ガンマ補正なし):
  r = ratio * accent.r + (1 - ratio) * base.r
  g = ratio * accent.g + (1 - ratio) * base.g
  b = ratio * accent.b + (1 - ratio) * base.b
  return rgbToHex(r, g, b)
```

---

## §10 APCA コントラスト

Color.js APCA 0.0.98G を移植。約 40行。

```
contrastAPCA(
  bgR: number, bgG: number, bgB: number,
  fgR: number, fgG: number, fgB: number,
): number  // Lc 値 (-110 ~ +110)

Step 1: sRGB → リニア
  linearize(val) = sign(val) * |val|^2.4

Step 2: 輝度 Y
  Y = R * 0.2126729 + G * 0.7151522 + B * 0.0721750

Step 3: 黒レベルクランプ (fclamp)
  Y >= 0.022 → Y
  Y <  0.022 → Y + (0.022 - Y)^1.414

Step 4: ノイズゲート
  |Ybg - Yfg| < 0.0005 → return 0

Step 5: Polarity & スコア
  Ybg > Yfg (BoW): S = Ybg^0.56 - Yfg^0.57,  C = S * 1.14
  else       (WoB): S = Ybg^0.65 - Yfg^0.62,  C = S * 1.14

Step 6: 低コントラスト切り捨て
  |C| < 0.1 → 0
  C > 0     → (C - 0.027) * 100
  C < 0     → (C + 0.027) * 100
```

### ensureContrast

```
ensureContrast(
  fgHex: string, bgHex: string,
  targetLc: number, chromaBoost: number = 1.0,
): string

1. 現在の Lc を計算
2. |Lc| >= targetLc なら fgHex をそのまま返す
3. fg の OKLCH L を調整:
   dark bg → L を上げる / light bg → L を下げる
   0.005 刻みで探索、|Lc| >= targetLc を満たす最小変更量の L を返す
4. light テーマで L を下げるとき:
   ΔL に比例して chroma を補償 (cScale = 1 + ΔL × (chromaBoost - 1 + 0.8))
   chromaBoost=1.0 → 控えめ補償 (light-pastel)
   chromaBoost=1.5 → 積極補償 (light)
```

### Lc 閾値 (mood 別)

| 用途 | dark | light-pastel | light |
|---|---|---|---|
| Syntax fg, Diagnostic fg | 60 | 45 | 60 |
| Neutral dim/comment | 45 | 30 | 45 |
| UI chrome fg (U0, U1) | 45 | 35 | 45 |
| border, separator | 30 | 30 | 30 |

---

## §11 マッピングテーブル

### Editor UI (29)

| Group | fg | bg | attr |
|---|---|---|---|
| Normal | N6 | N0 | |
| NormalFloat | N6 | N1 | |
| FloatBorder | U0 | | |
| FloatTitle | U0 | | bold |
| CursorLine | | N2 | |
| CursorLineNr | U0 | | bold |
| LineNr | N4 | | |
| Visual | | N3 | |
| Search | N0 | U0 | |
| IncSearch | N0 | U1 | bold |
| CurSearch | N0 | U0 | bold |
| MatchParen | | N3 | bold |
| Pmenu | N6 | N1 | |
| PmenuSel | | N3 | |
| PmenuSbar | | N1 | |
| PmenuThumb | | N4 | |
| StatusLine | N6 | blend(U0, N0, 0.08) | |
| StatusLineNC | N4 | blend(U0, N0, 0.04) | |
| WinBar | N6 | blend(U0, N0, 0.08) | |
| WinBarNC | N4 | blend(U0, N0, 0.04) | |
| TabLine | N4 | N1 | |
| TabLineSel | U1 | blend(U1, N0, 0.10) | bold |
| TabLineFill | | N0 | |
| WinSeparator | blend(U0, N0, 0.15) | | |
| Folded | N5 | N2 | |
| FoldColumn | N4 | | |
| SignColumn | | N0 | |
| NonText | N4 | | |
| Title | U0 | | bold |

### Syntax (20)

| Group | fg | attr |
|---|---|---|
| Comment | N5 | italic |
| Keyword | S1 | |
| Statement | S1 | |
| Conditional | S1 | |
| Repeat | S1 | |
| Function | S2 | |
| Operator | S6 | |
| String | S3 | |
| Character | S3 | |
| Type | S4 | |
| Number | S5 | |
| Boolean | S5 | |
| Float | S5 | |
| Constant | S5 | |
| Special | S0 | |
| Delimiter | N4 | |
| Identifier | N6 | |
| PreProc | S7 | |
| Include | S7 | |
| Todo | S0 | bold |

### Diagnostic (16)

| Group | fg | attr |
|---|---|---|
| DiagnosticError | D0 | |
| DiagnosticWarn | D1 | |
| DiagnosticInfo | D2 | |
| DiagnosticHint | D3 | |
| DiagnosticVirtualTextError | D0 | |
| DiagnosticVirtualTextWarn | D1 | |
| DiagnosticVirtualTextInfo | D2 | |
| DiagnosticVirtualTextHint | D3 | |
| DiagnosticUnderlineError | | undercurl |
| DiagnosticUnderlineWarn | | undercurl |
| DiagnosticUnderlineInfo | | undercurl |
| DiagnosticUnderlineHint | | undercurl |
| DiagnosticSignError | D0 | |
| DiagnosticSignWarn | D1 | |
| DiagnosticSignInfo | D2 | |
| DiagnosticSignHint | D3 | |

### Diff (4)

| Group | bg |
|---|---|
| DiffAdd | blend(D3, N0, 0.18) |
| DiffChange | blend(D2, N0, 0.18) |
| DiffDelete | blend(D0, N0, 0.18) |
| DiffText | blend(D2, N0, 0.30) |

---

## §12 状態管理 (Jotai)

ボトムアップで構築する。各カテゴリの atom が独立し、上位で合成する。

```
visionResultAtom          -- AI 出力 (VisionResult | null)
moodAtom                  -- ユーザー選択 (ThemeMood | null)
  ↓
seedsAtom                 -- 派生: selectSeeds(visionResult)
  ↓
  ├── neutralAtom          -- 派生: generateNeutral(seeds.primary.h, MOOD_PRESET[mood])
  ├── syntaxAtom           -- 派生: generateSyntax(seeds, MOOD_PRESET[mood], neutral.bg)
  ├── uiAtom               -- 派生: generateUi(seeds, MOOD_PRESET[mood], neutral.bg)
  └── diagnosticAtom       -- 派生: generateDiagnostic(seeds, MOOD_PRESET[mood], neutral.bg)

paletteAtom               -- 派生: 全 atom を合成して Palette を構築
```

各 atom は `visionResultAtom` または `moodAtom` が null のとき null を返す。
AI 分析完了後、ユーザーが mood を選択するまでパレットは生成されない。

---

## §13 コンポーネント構成

Editor / Syntax / Diagnostic をそれぞれ独立したコンポーネントとして作成する。

```
src/features/palette-generator/components/
├── editor-palette-view.tsx     N0-N7 + UI blend 派生の表示
├── syntax-palette-view.tsx     S0-S7 の表示
├── diagnostic-palette-view.tsx D0-D3 + Diff blend の表示
└── seed-view.tsx               選定された seed 2色 + AI impression 3色の表示
```

各コンポーネントは対応する Jotai atom を `useAtomValue` で直接購読する。
親コンポーネントから props で受け取らない。

---

## §14 ファイル構成

### 削除 (実装開始時に全削除)

```
src/features/palette-generator/   全ファイル
src/features/highlight-mapper/    全ファイル (palette-generator に統合)
```

### 新規作成

```
src/features/palette-generator/
├── types/
│   ├── vision-result.ts         VisionResult
│   └── palette.ts               Palette, ThemeTone, *Slot 型
├── usecases/
│   ├── config.ts                全定数
│   ├── seed-selection.ts        selectSeeds()
│   ├── neutral.ts               generateNeutral()
│   ├── syntax.ts                generateSyntax() + gap-fill + discrimination
│   ├── ui.ts                    generateUi()
│   ├── diagnostic.ts            generateDiagnostic()
│   ├── contrast.ts              contrastAPCA() + ensureContrast()
│   ├── blend.ts                 blend()
│   ├── oklch-utils.ts           hexToOklch, oklchToHex, deltaEOk, clamp
│   └── generate-palette.ts      パイプライン統合
├── stores/
│   ├── vision-result.atom.ts    visionResultAtom
│   ├── mood.atom.ts             moodAtom (ユーザー選択)
│   ├── seeds.atom.ts            seedsAtom
│   ├── neutral.atom.ts          neutralAtom
│   ├── syntax.atom.ts           syntaxAtom
│   ├── ui.atom.ts               uiAtom
│   ├── diagnostic.atom.ts       diagnosticAtom
│   └── palette.atom.ts          paletteAtom (合成)
├── components/
│   ├── editor-palette-view.tsx
│   ├── syntax-palette-view.tsx
│   ├── diagnostic-palette-view.tsx
│   └── seed-view.tsx
└── index.ts
```

### テスト

```
tests/features/palette-generator/
├── seed-selection.test.ts
├── neutral.test.ts
├── syntax.test.ts
├── ui.test.ts
├── diagnostic.test.ts
├── contrast.test.ts
├── blend.test.ts
└── oklch-utils.test.ts
```

---

## §15 外部への影響

| ファイル | 変更内容 |
|---|---|
| `src/features/color-analyzer/usecases/config.ts` | VisionResultSchema から neutral フィールド削除、プロンプトから neutral ルール削除 |
| `src/features/color-analyzer/types/color-analyzer.ts` | VisionResult import は維持 (型が変わるだけ) |
| `src/routes/index.tsx` | visionResultAtom の import パス変更、VisionResult 型変更に追従 |
| `src/features/lua-generator/` | HighlightBundle → Palette 型に変更。マッピングテーブルは palette-generator 内で解決 |
