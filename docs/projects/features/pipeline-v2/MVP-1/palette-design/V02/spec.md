# MVP-1/palette-design/V02 仕様

## 全体フロー

```
VisionResult (AI出力)
  │
  ├─ impression 3色 + bg + fg を Oklab に変換
  │
  ├─ findNearestTheme()
  │    ├─ 437 テーマ × 120 通りスロット総当たり
  │    ├─ score = bg距離×5 + fg距離×5 + min(accent順列距離)
  │    └─ 最低スコアのテーマ + 最適スロット割り当てを返す
  │
  ├─ assignPalette()
  │    ├─ AI 3色で最適スロットを上書き
  │    ├─ 残り3色をテーマから借りる
  │    ├─ adjustBorrowed() で L/C を AI 統計に合わせて微調整
  │    └─ 派生色 (color5, color7) を生成
  │
  ├─ V01 と共通:
  │    ├─ generateVariants()
  │    ├─ clampNeutral() + deriveNeutralPalette()
  │    ├─ assignUiRoles() + deriveUiColors()
  │    ├─ gamutClamp()
  │    └─ ensureContrast()
  │
  └─ PaletteResult (出力 JSON) — V01 と同一スキーマ
```

## 配置先ファイル

```
src/features/palette-generator/
├── usecases/
│   ├── nearest-theme.ts       # findNearestTheme, 120通り総当たり
│   ├── theme-palette.ts       # assignPalette, adjustBorrowed
│   ├── hue-gap.ts             # V01: computeGaps, fillGaps
│   ├── accent-palette.ts      # V01: generateAccentPalette
│   ├── neutral-palette.ts     # clampNeutral, deriveNeutralPalette (V01/V02 共通)
│   ├── ui-colors.ts           # assignUiRoles, deriveUiColors (V01/V02 共通)
│   ├── contrast.ts            # ensureContrast (V01/V02 共通)
│   ├── oklab-utils.ts         # hexToOklab, oklabDist
│   └── oklch-utils.ts         # hexToOklch, oklchToHex (V01/V02 共通)
├── repositories/
│   └── theme-data.ts          # 437テーマの Oklab プリコンパイルデータ
├── types/
│   └── palette.ts             # VisionResult, PaletteResult, PrecompiledTheme 等
├── palette-generator.schema.ts  # Valibot スキーマ (V01/V02 共通)
└── index.ts
```

## 追加の型定義

```typescript
// palette-generator.types.ts に追加

/** Oklab 値 (直交座標) */
type OklabValues = { l: number; a: number; b: number };

/** プリコンパイル済みテーマ */
type PrecompiledTheme = {
  name: string;
  bg: OklabValues;
  fg: OklabValues;
  palette: [OklabValues, OklabValues, OklabValues, OklabValues, OklabValues, OklabValues];
  // palette[0]=p1(red), [1]=p2(green), [2]=p3(yellow), [3]=p4(blue), [4]=p5(magenta), [5]=p6(cyan)
  paletteHex: [string, string, string, string, string, string];
};

/** 最近傍テーマ検索の結果 */
type NearestThemeResult = {
  theme: PrecompiledTheme;
  score: number;
  /** AI 3色がどのスロット (0-5) に割り当てられたか */
  assignment: [number, number, number];
};
```

---

## 1. Oklab 距離計算

### oklabDist

```typescript
// oklab-utils.ts

import { useMode, modeOklab, parse } from "culori/fn";

/**
 * 2 色の Oklab ユークリッド距離を計算する
 *
 * OKLCH (極座標) と違い、色相の wrap-around 問題がない。
 * 単純なユークリッド距離で知覚的な色差を正確に測れる。
 *
 * 参考: Björn Ottosson, "A perceptual color space for image processing" (2020)
 */
function oklabDist(a: OklabValues, b: OklabValues): number
```

**アルゴリズム:**

```
ΔE = sqrt((L₂-L₁)² + (a₂-a₁)² + (b₂-b₁)²)
```

### hexToOklab

```typescript
/**
 * hex → Oklab 変換
 * culori の modeOklab を使用
 */
function hexToOklab(hex: string): OklabValues
```

---

## 2. テーマ プリコンパイル

### 対象

ghostty 同梱テーマからネタテーマを除外した 437 テーマ。

### 除外リスト

```typescript
const EXCLUDED_THEMES = new Set([
  // 全色同一
  "HaX0R Blue", "HaX0R Gr33N", "HaX0R R3D",
  "Hot Dog Stand", "Hot Dog Stand (Mustard)",
  "Retro", "Retro Legends",
  // モノクロ・低彩度メタル系
  "Black Metal", "Black Metal (Bathory)", "Black Metal (Burzum)",
  "Black Metal (Dark Funeral)", "Black Metal (Gorgoroth)",
  "Black Metal (Immortal)", "Black Metal (Khold)",
  "Black Metal (Marduk)", "Black Metal (Mayhem)",
  "Black Metal (Nile)", "Black Metal (Venom)",
  // 赤単色系
  "Red Alert", "Red Planet", "Red Sands",
  // 極端な配色
  "Sakura", "Scarlet Protocol", "Cyberpunk Scarlet Protocol",
  "Toy Chest", "Unikitty",
]);
```

### プリコンパイル形式

```typescript
// theme-data.ts (ビルド時に生成)

/** 437 テーマの Oklab プリコンパイルデータ */
const THEMES: PrecompiledTheme[] = [
  {
    name: "Atom One Dark",
    bg: { l: 0.233, a: -0.003, b: -0.011 },
    fg: { l: 0.789, a: -0.005, b: -0.015 },
    palette: [
      { l: 0.532, a: 0.098, b: 0.023 },  // p1 red
      { l: 0.729, a: -0.098, b: 0.078 }, // p2 green
      // ...
    ],
    paletteHex: ["#e06c75", "#98c379", ...],
  },
  // ... 437 テーマ
];
```

---

## 3. 最近傍テーマ検索

### findNearestTheme

```typescript
// nearest-theme.ts

/**
 * AI 5色 (accent 3 + bg + fg) に最も近いテーマを検索する
 *
 * 全 437 テーマ × 120 通りのスロット順列を評価し、
 * 最低スコアのテーマ + スロット割り当てを返す。
 *
 * @param aiColors - AI 3色の Oklab [color1, color2, color3]
 * @param aiBg - AI bg の Oklab
 * @param aiFg - AI fg の Oklab
 * @param themeTone - "dark" | "light"（同じ tone のテーマのみ検索）
 * @param topN - 上位 N 件を返す (デフォルト 1)
 * @returns 最近傍テーマの結果（スコア昇順）
 */
function findNearestTheme(
  aiColors: [OklabValues, OklabValues, OklabValues],
  aiBg: OklabValues,
  aiFg: OklabValues,
  themeTone: "dark" | "light",
  topN?: number,
): NearestThemeResult[]
```

**アルゴリズム:**

```
1. theme_tone でフィルタ (dark: bg.l < 0.5, light: bg.l >= 0.5)

2. 各テーマについて:
   a. bgDist = oklabDist(aiBg, theme.bg) × W_BG
   b. fgDist = oklabDist(aiFg, theme.fg) × W_FG
   c. 120 通りのスロット順列 (i, j, k) を生成:
        for i in 0..5:
          for j in 0..5, j ≠ i:
            for k in 0..5, k ≠ i, k ≠ j:
              accentDist = oklabDist(aiColors[0], theme.palette[i])
                         + oklabDist(aiColors[1], theme.palette[j])
                         + oklabDist(aiColors[2], theme.palette[k])
              if accentDist < minAccentDist:
                minAccentDist = accentDist
                bestAssignment = [i, j, k]
   d. score = bgDist + fgDist + minAccentDist

3. スコア昇順でソート、上位 topN を返す
```

**定数:**

```typescript
const W_BG = 5;  // bg の重み (画面最大面積)
const W_FG = 5;  // fg の重み (テキスト可読性)
```

**計算量:**

```
437 テーマ × 120 順列 = 52,440 回の oklabDist 計算
oklabDist = 加減算 3 回 + 乗算 3 回 + sqrt 1 回
→ 実測 < 1ms
```

---

## 4. パレット割り当て

### assignPalette

```typescript
// theme-palette.ts

/**
 * 最近傍テーマの palette に AI 3色を上書きし、8色パレットを構成する
 *
 * @param aiColorsHex - AI 3色の hex [primary, secondary, tertiary]
 * @param result - findNearestTheme の結果
 * @returns 8色の hex 配列 [color1..color8]
 */
function assignPalette(
  aiColorsHex: [string, string, string],
  result: NearestThemeResult,
): string[]
```

**アルゴリズム:**

```
assignment = result.assignment  // AI 3色が入るスロット [i, j, k]
borrowed = 6色のうち assignment に含まれない 3 スロット

AI 3色をそのまま配置:
  color1 = aiColorsHex[0] (primary)
  color2 = aiColorsHex[1] (secondary)
  color3 = aiColorsHex[2] (tertiary)

borrowed 3色を ANSI セマンティクスに基づいて配置:
  palette[0] (p1, red)   → color8 (error) ※ borrowed の場合
  palette[1] (p2, green) → color4 (string) ※ borrowed の場合
  palette[5] (p6, cyan)  → color6 (special) ※ borrowed の場合

  AI で上書きされたスロットに p1/p2/p6 が含まれる場合:
  → 残りの borrowed から最もセマンティクスに近い色を割り当てる
  → 色相で判定: H < 60° → error 系, 60° < H < 180° → string 系, etc.
```

---

## 5. borrowed 色の L/C 調整

### adjustBorrowed

```typescript
// theme-palette.ts

/**
 * テーマから借りた色の L/C を AI 3色の統計に合わせて微調整する
 *
 * テーマの borrowed 色は元テーマの bg/fg バランスで設計されている。
 * AI の bg/fg に変わるため、L/C を調整して馴染ませる。
 */
function adjustBorrowed(
  borrowed: OklchValues[],
  aiSeeds: [OklchValues, OklchValues, OklchValues],
  themeAccents: OklchValues[],
): OklchValues[]
```

**アルゴリズム:**

```
AI 3色の統計:
  L_med = median(aiSeeds[0].l, aiSeeds[1].l, aiSeeds[2].l)
  C_med = median(aiSeeds[0].c, aiSeeds[1].c, aiSeeds[2].c)

テーマ 6色の統計:
  theme_L_med = median(themeAccents.map(a => a.l))
  theme_C_med = median(themeAccents.map(a => a.c))

各 borrowed 色について:
  L_offset = borrowed.l - theme_L_med     // テーマ内での相対位置を保持
  new_L = L_med + L_offset

  C_ratio = borrowed.c / theme_C_med      // テーマ内での相対比率を保持
  new_C = C_med × C_ratio

  H はそのまま（色相は保持）
```

**意図:** テーマ内で「keyword より暗い string」「accent の 0.8 倍の彩度の parameter」
という **相対関係を保持** したまま、AI の色統計にシフトさせる。

---

## 6. 派生色 (color5, color7)

V01 と同一の方式だが、元の色がテーマから借りた色になる:

```
color5 (type):
  借りた constant/class 系の色から:
  L = borrowed.l ± 0.08 (dark: -, light: +)
  C = borrowed.c
  H = borrowed.h

color7 (parameter):
  借りた special/support 系の色から:
  C = borrowed.c × 0.8
  L = borrowed.l
  H = borrowed.h
```

---

## 7. V01 共通ロジック

以下は V01 spec と同一。再実装せず共通モジュールを使用:

- variant 生成 (V01 §6)
- neutral 検証・補正 + 派生 (V01 §4, §5)
- UI ロール割り当て (V01 §7)
- ui 色導出 (V01 §7.5)
- コントラスト保証 (V01 §8)
- gamut mapping (V01 §8)
- Valibot スキーマ (V01 §9) — 出力は同一スキーマ

---

## 8. ユニットテスト

| 関数 | テスト観点 |
|---|---|
| `oklabDist` | 同一色 (dist=0)、補色 (dist が大きい)、OKLCH wrap-around が問題にならないこと |
| `findNearestTheme` | dark/light フィルタ、120 通りの最適割り当て、W_BG/W_FG の重み効果 |
| `assignPalette` | AI 3色が正しいスロットに入る、borrowed の動的割り当て |
| `adjustBorrowed` | L/C の相対関係が保持される、H が変わらない |

テストファイル:

```
src/features/palette-generator/usecases/__tests__/
├── nearest-theme.test.ts
└── theme-palette.test.ts
```

---

## 依存パッケージ

| パッケージ | 用途 | 新規/既存 |
|---|---|---|
| culori | Oklab / OKLCH 変換 | 既存 |
| valibot | スキーマバリデーション | V01 で追加済み |
