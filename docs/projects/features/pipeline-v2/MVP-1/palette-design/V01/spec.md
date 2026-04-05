# MVP-1/palette-design/V01 仕様

## 全体フロー

```
VisionResult (AI出力)
  │
  ├─ impression.{primary,secondary,tertiary}.hex
  │    │
  │    ├─ hexToOklch() で OKLCH に変換
  │    ├─ stabilizeHue() で低彩度入力を補正 (C < 0.015 → Tinted Gray)
  │    ├─ color1〜3 に直接割り当て
  │    ├─ computeGaps() + fillGaps() で color4〜7 の色相を導出
  │    ├─ enforceMinHueGap() で最小色相距離 ≥ 30° を保証
  │    ├─ computeTargetLC() で C + L分散値を算出 (Luminance Jittering)
  │    ├─ color8 は hue 25° 固定
  │    ├─ generateVariants() で color1_variant, color3_variant を生成
  │    ├─ gamutClamp() で sRGB gamut mapping (culori clampChroma)
  │    └─ ensureContrast() で全 accent 色のコントラスト保証
  │
  ├─ neutral.{bg_base_hex, fg_base_hex}
  │    │
  │    ├─ clampNeutral() で L/C を検証・補正
  │    ├─ deriveNeutralPalette() で 10 色を派生
  │    └─ ensureContrast() で neutral fg 系のコントラスト保証
  │
  ├─ theme_tone
  │    └─ dark/light で L の方向を切り替え
  │
  ├─ assignUiRoles() で AI 3 色の UI ロールを判定
  │    │  (bg/fg とのコントラスト比 + Oklab 距離で判定)
  │    │
  │    └─ deriveUiColors() で ui 5 色を導出
  │         (frame = navigation 色の低彩度派生)
  │
  ├─ checkDiscrimination() で accent 間弁別性を検証 (ΔE_ok ≥ 0.08)
  │
  └─ PaletteResult (出力 JSON)
```

## 配置先ファイル

```
src/features/palette-generator/
├── usecases/
│   ├── hue-gap.ts             # computeGaps, fillGaps, enforceMinHueGap
│   ├── accent-palette.ts      # generateAccentPalette (Step 0〜5 統合)
│   ├── stabilize-hue.ts       # stabilizeHue (低彩度入力の Tinted Gray 補正)
│   ├── neutral-palette.ts     # clampNeutral, deriveNeutralPalette
│   ├── ui-colors.ts           # assignUiRoles, deriveUiColors
│   ├── contrast.ts            # ensureContrast
│   ├── discrimination.ts      # checkDiscrimination (弁別性検証)
│   ├── oklab-utils.ts         # hexToOklab, oklabDist
│   └── oklch-utils.ts         # hexToOklch, oklchToHex, gamutClamp
├── types/
│   └── palette.ts             # VisionResult, PaletteResult, HueGap, OklabValues 等
├── palette-generator.schema.ts  # Valibot スキーマ
└── index.ts
```

## 型定義

```typescript
// palette-generator.types.ts

/** AI Vision の出力 */
type VisionResult = {
  impression: {
    primary: { hex: string; reason: string };
    secondary: { hex: string; reason: string };
    tertiary: { hex: string; reason: string };
  };
  theme_tone: "dark" | "light";
  neutral: {
    bg_base_hex: string;
    fg_base_hex: string;
  };
};

/** パレット生成の最終出力 */
type PaletteResult = {
  theme_tone: "dark" | "light";
  neutral: NeutralPalette;
  accent: AccentPalette;
  ui: UiColors;
};

type NeutralPalette = {
  bg: string;
  fg: string;
  bg_surface: string;
  bg_cursor_line: string;
  bg_visual: string;
  bg_popup: string;
  comment: string;
  line_nr: string;
  border: string;
  delimiter: string;
};

type AccentPalette = {
  color1: string;
  color1_variant: string;
  color2: string;
  color3: string;
  color3_variant: string;
  color4: string;
  color5: string;
  color6: string;
  color7: string;
  color8: string;
};

type UiColors = {
  navigation: string;      // TabLineSel, FolderName, RootFolder
  attention: string;       // CursorLineNr, Git dirty
  frame: string;           // FloatBorder, WinSeparator
  search_bg: string;
  pmenu_sel_bg: string;
};

/** UI ロール割り当て結果（color1〜3 のインデックス） */
type UiRoleAssignment = {
  navigation: number;  // 0 | 1 | 2
  attention: number;   // 0 | 1 | 2
};

/** 色相環上の隣接 2 色間のギャップ */
type HueGap = {
  start: number; // 開始色相 (0〜360)
  end: number;   // 終了色相 (0〜360)
  size: number;  // ギャップの角度幅 (0〜360)
};

/** OKLCH 値 */
type OklchValues = { l: number; c: number; h: number };

/** Oklab 値 (直交座標 — 距離計算用) */
type OklabValues = { l: number; a: number; b: number };
```

---

## 0. 低彩度入力の補正

### stabilizeHue

```typescript
// stabilize-hue.ts

/**
 * 低彩度 (C < 0.015) の入力色の hue を安定化する
 *
 * Oklab の JND (ΔE_ok ≈ 0.02) に基づき、C < 0.015 では
 * 色相の変化は知覚不可能と判定し、primary の hue を借用する。
 * C を 0.025 に引き上げて Tinted Gray 化し、同時対比による錯覚を防ぐ。
 *
 * @param seeds - AI 3 色の OKLCH 値 [primary, secondary, tertiary]
 * @returns 補正済みの OKLCH 値（primary はそのまま）
 */
function stabilizeHue(seeds: OklchValues[]): OklchValues[]
```

**アルゴリズム:**

```
primaryHue = seeds[0].h

for each seed (i > 0):
  if seed.c < ACHROMATIC_C_THRESHOLD:
    seed.h = primaryHue
    seed.c = TINTED_GRAY_C
  // primary (i=0) はそのまま
```

**定数:**

```typescript
const ACHROMATIC_C_THRESHOLD = 0.015;  // JND 由来
const TINTED_GRAY_C = 0.025;           // Tinted Gray の目標彩度
```

**根拠:**
- Oklab JND = ΔE_ok ≈ 0.02。C = 0.01 の色は色相が 180° 変わっても ΔE = 0.02 以下
- 真の無彩色 (C=0) は周囲の補色が知覚される「同時対比」を引き起こす
- Tinted Gray (C=0.02〜0.03) は錯覚を打ち消し、パレット全体に調和する

---

## 1. 色相環ギャップ計算

### computeGaps

```typescript
// hue-gap.ts

/**
 * 色相リストから色相環上のギャップを計算する
 *
 * @param hues - 色相の配列 (0〜360°)。未ソートでもよい
 * @returns ギャップの配列（時計回り順）。要素数 = hues.length
 */
function computeGaps(hues: number[]): HueGap[]
```

**アルゴリズム:**

```
1. hues を昇順ソート → sorted
2. i = 0 〜 sorted.length - 1 について:
     start = sorted[i]
     end   = sorted[(i + 1) % sorted.length]
     size  = end - start
     if size <= 0: size += 360    // wrap-around
     gaps.push({ start, end, size })
3. return gaps
```

**例: hues = [40, 80, 230]**

```
sorted = [40, 80, 230]
gaps = [
  { start: 40,  end: 80,  size: 40  },
  { start: 80,  end: 230, size: 150 },
  { start: 230, end: 40,  size: 170 },  // 360 - 230 + 40
]
```

---

## 2. 隙間充填アルゴリズム

### fillGaps

```typescript
// hue-gap.ts

/**
 * 色相環のギャップに色相を充填する
 *
 * 最大ギャップの中間に色を置き、ギャップを二分割する。これを count 回繰り返す。
 * どんな入力でも色相環上で最大限に散る。
 *
 * @param gaps - computeGaps の出力
 * @param count - 生成する色相の数
 * @returns 充填された色相の配列 (0〜360°)。要素数 = count
 */
function fillGaps(gaps: HueGap[], count: number): number[]
```

**アルゴリズム:**

```
1. gaps をコピーして workGaps とする
2. count 回繰り返す:
   a. workGaps を size 降順でソートする
   b. 最大の gap を取り出す
   c. mid = gap.start + gap.size / 2
      if mid >= 360: mid -= 360
   d. filledHues に mid を追加する
   e. 元の gap を 2 つに分割して workGaps に戻す:
        { start: gap.start, end: mid, size: gap.size / 2 }
        { start: mid, end: gap.end, size: gap.size / 2 }
3. return filledHues
```

### Albedo での実行トレース

```
入力: hues = [40, 230, 80]

computeGaps → gaps = [40°, 150°, 170°]

fillGaps(gaps, 4):

  1回目: 最大 170° (230→40) → mid=315° → [315]
         分割: 85° + 85°

  2回目: 最大 150° (80→230) → mid=155° → [315, 155]
         分割: 75° + 75°

  3回目: 最大 85° (230→315) → mid=272° → [315, 155, 272]

  4回目: 最大 85° (315→40) → mid=358° → [315, 155, 272, 358]

最終 7 色の色相環上の分布:
  40° -- 80° -- 155° -- 230° -- 272° -- 315° -- 358°
```

### エッジケース

**暖色系キャラ (H=20°, 40°, 60°):**

```
gaps = [20°, 20°, 320°]
320° のギャップを 4 回分割 → 140°, 220°, 300°, 100°
暖色が密集しても、補完色が広く散る ✓
```

**均等配置 (H=0°, 120°, 240°):**

```
gaps = [120°, 120°, 120°]
同率は先頭から → 60°, 180°, 300°, 30°
7 色が均等に散る ✓
```

---

## 2.5. 最小色相距離保証

### enforceMinHueGap

```typescript
// hue-gap.ts

/**
 * gap-fill 後の全色相ペアが最小距離 (30°) 以上離れるよう調整する
 *
 * Cohen-Or et al. (SIGGRAPH 2006) の色相テンプレート理論の簡易適用。
 * seed (AI 入力) は固定し、filled のみ調整対象。
 *
 * @param seedHues - AI 3 色の色相（固定）
 * @param filledHues - fillGaps で生成された色相（調整対象）
 * @returns 調整後の filledHues
 */
function enforceMinHueGap(seedHues: number[], filledHues: number[]): number[]
```

**アルゴリズム:**

```
最大 10 回イテレーション:
  for each filled hue:
    for each other hue (seed + filled):
      dist = 色相環上の最短距離
      if dist < MIN_HUE_GAP (30°) AND dist > 0:
        other から離れる方向に (MIN_HUE_GAP - dist) / 2 + 1° 押す
  変更がなければ終了
```

**定数:**

```typescript
const MIN_HUE_GAP = 30;  // Cohen-Or 2006 簡易適用
```

**hueDist ヘルパー:**

```typescript
/** 色相環上の最短距離 (0〜180°) */
function hueDist(h1: number, h2: number): number {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
}
```

---

## 3. AI 3 色の L/C 統計から target L/C を算出

### computeTargetLC

```typescript
// accent-palette.ts

/**
 * AI 3 色の OKLCH 値から、隙間充填色の target C と L 分散値を算出する
 *
 * L は固定値ではなく Luminance Jittering で分散させる (O'Donovan 2011)。
 *
 * @param seeds - AI 3 色の OKLCH 値
 * @param themeTone - "dark" | "light"
 * @returns { lValues: number[], c: number }
 */
function computeTargetLC(
  seeds: [OklchValues, OklchValues, OklchValues],
  themeTone: "dark" | "light",
): { lValues: number[]; c: number }
```

**アルゴリズム:**

```
C の算出:
  chromas = [seeds[0].c, seeds[1].c, seeds[2].c] を昇順ソート
  C_target = chromas[1] × 0.9    // 中央値の 9 割

L の算出 (Luminance Jittering):
  dark:  lValues = [0.68, 0.76, 0.72, 0.80]  — 中心 0.74、ΔL=0.04 ステップ
  light: lValues = [0.42, 0.50, 0.46, 0.38]  — 中心 0.44、ΔL=0.04 ステップ

  各 gap-filled 色 (color4〜7) に異なる L を割り当てる:
    color4 → lValues[0], color5 → lValues[1], color6 → lValues[2], color7 → lValues[3]
```

**定数:**

```typescript
const CHROMA_SCALE = 0.9;
const L_JITTER_DARK = [0.68, 0.76, 0.72, 0.80];
const L_JITTER_LIGHT = [0.42, 0.50, 0.46, 0.38];
```

**なぜ Luminance Jittering か (O'Donovan 2011):**
O'Donovan の研究で「調和的なパレットは hue entropy が低く lightness variance が高い」ことが示されている。
全 gap-filled 色を同一 L にすると単調で弁別性が低下する。
隣接 ΔL=0.04、非隣接 ΔL≥0.08 で Solarized と同程度の L ステップを確保。
dark テーマの optimal L 帯 0.70〜0.85 (Gemini research) の範囲内に収まっている。

**なぜ中央値か:** 平均値は外れ値（極端に彩度が低い tertiary など）に引っ張られる。
中央値なら安定する。0.9 倍で AI 3 色よりやや控えめにし、主役を食わない。

**color8 の例外:** color8 (error) は意味色のため、C に下限を設ける:

```typescript
const ERROR_CHROMA_MIN = 0.15;
// color8 の C = max(C_target, ERROR_CHROMA_MIN)
// color8 の L = dark: 0.72, light: 0.45 (固定)
```

淡い色のキャラでも error が常に目を引くようにする。

---

## 4. neutral 検証・補正ロジック

### clampNeutral

```typescript
// neutral-palette.ts

/**
 * AI が提案した bg/fg を OKLCH で検証し、範囲外なら補正する
 * H（色相）は AI の判断を尊重しそのまま使う
 *
 * @param bgHex - AI 提案の bg_base_hex
 * @param fgHex - AI 提案の fg_base_hex
 * @param themeTone - "dark" | "light"
 * @returns { bg: OklchValues, fg: OklchValues } 補正済み
 */
function clampNeutral(
  bgHex: string,
  fgHex: string,
  themeTone: "dark" | "light",
): { bg: OklchValues; fg: OklchValues }
```

**定数と補正ルール:**

```typescript
const NEUTRAL_LIMITS = {
  dark: {
    bg: { lMin: 0.10, lMax: 0.18, cMax: 0.02, cFallback: 0.015 },
    fg: { lMin: 0.82, lMax: 0.92 },
  },
  light: {
    bg: { lMin: 0.92, lMax: 0.95, cMax: 0.02, cFallback: 0.015 },
    fg: { lMin: 0.15, lMax: 0.25 },
  },
};
```

**アルゴリズム:**

```
bg:
  oklch = hexToOklch(bgHex)
  L = clamp(oklch.l, limits.bg.lMin, limits.bg.lMax)
  C = oklch.c > limits.bg.cMax ? limits.bg.cFallback : oklch.c
  H = oklch.h  // そのまま

fg:
  oklch = hexToOklch(fgHex)
  L = clamp(oklch.l, limits.fg.lMin, limits.fg.lMax)
  C = oklch.c  // fg の彩度は補正しない
  H = oklch.h  // そのまま
```

---

## 5. neutral 派生色生成

### deriveNeutralPalette

```typescript
// neutral-palette.ts

/**
 * 補正済み bg/fg から neutral 10 色を派生する
 *
 * @param bg - 補正済み bg の OKLCH
 * @param fg - 補正済み fg の OKLCH
 * @param themeTone - "dark" | "light"
 * @returns NeutralPalette (全て hex 文字列)
 */
function deriveNeutralPalette(
  bg: OklchValues,
  fg: OklchValues,
  themeTone: "dark" | "light",
): NeutralPalette
```

**派生テーブル:**

bg 系は bg の H/C を保持し、L をオフセット:

| key | L の算出 |
|---|---|
| bg | bg.l（そのまま） |
| bg_surface | bg.l + 0.02 |
| bg_cursor_line | bg.l + 0.05 |
| bg_popup | bg.l + 0.04 |
| bg_visual | bg.l + 0.08 |

fg 系は fg の H を保持し、C は bg.c（低彩度）、L は絶対値:

| key | L |
|---|---|
| fg | fg.l（そのまま） |
| comment | 0.45 |
| line_nr | 0.40 |
| border | 0.30 |
| delimiter | 0.60 |

**light theme の場合:**

bg 系のオフセットは符号反転（L を下げる方向）:

| key | L の算出 |
|---|---|
| bg | bg.l |
| bg_surface | bg.l - 0.02 |
| bg_cursor_line | bg.l - 0.05 |
| bg_popup | bg.l - 0.04 |
| bg_visual | bg.l - 0.08 |

fg 系の L:

| key | L |
|---|---|
| fg | fg.l |
| comment | 0.55 |
| line_nr | 0.60 |
| border | 0.70 |
| delimiter | 0.55 |

---

## 6. variant 生成

### generateVariants

```typescript
// accent-palette.ts

/**
 * color1, color3 から variant を生成する
 *
 * @param color1 - OKLCH (keyword 色)
 * @param color3 - OKLCH (constant 色)
 * @param themeTone - "dark" | "light"
 * @returns { color1_variant: OklchValues, color3_variant: OklchValues }
 */
function generateVariants(
  color1: OklchValues,
  color3: OklchValues,
  themeTone: "dark" | "light",
): { color1_variant: OklchValues; color3_variant: OklchValues }
```

**ルール:**

```
color1_variant:
  H = color1.h
  L = color1.l
  C = color1.c × 0.6    // 彩度を落として tag 用

color3_variant:
  H = color3.h
  C = color3.c
  L = dark:  color3.l + 0.08    // 明度を上げて number 用
      light: color3.l - 0.08
```

**定数:**

```typescript
const VARIANT1_CHROMA_SCALE = 0.6;
const VARIANT3_L_OFFSET = 0.08;
```

---

## 7. UI ロール割り当て

AI 3 色の「象徴色としての順位」は「UI 映えする順位」とは限らない。
bg/fg とのコントラスト比で UI に使える色を判定し、役割を振り分ける。

### assignUiRoles

```typescript
// ui-colors.ts

/**
 * AI 3 色から UI ロール（navigation / attention）を割り当てる
 *
 * コントラスト条件を満たす色のうち、bg からの Oklab 距離が大きい順に
 * ロールを割り当てる。Oklab 距離は L/a/b の総合的な知覚差を測るため、
 * chroma のみの判定より「bg 上で最も目立つ色」を正確に選択できる。
 *
 * @param colors - AI 3 色の OKLCH 値 [color1, color2, color3]
 * @param bgHex - neutral.bg の hex
 * @param fgHex - neutral.fg の hex
 * @returns 各ロールに割り当てられた色のインデックス (0〜2)
 */
function assignUiRoles(
  colors: [OklchValues, OklchValues, OklchValues],
  bgHex: string,
  fgHex: string,
): UiRoleAssignment
```

**アルゴリズム:**

```
1. bg を Oklab に変換: bgOklab = hexToOklab(bgHex)

2. 3 色それぞれについて:
     bgCR = bg とのコントラスト比
     fgCR = fg とのコントラスト比
     bgDist = oklabDist(hexToOklab(color), bgOklab)  // Oklab 距離
     UI 適格 = bgCR >= 3.0 AND fgCR >= 2.0

3. UI 適格な色を bgDist (Oklab 距離) 降順でソートする

4. 割り当て:
     navigation = bg から最も遠い適格色のインデックス
     attention  = 次に遠い適格色のインデックス

5. フォールバック:
     適格色が 1 つ → navigation = attention = その色
     適格色が 0   → bgDist 降順で割り当て
```

**定数:**

```typescript
const UI_BG_CR_MIN = 3.0;   // bg との最小コントラスト比 (WCAG AA large text)
const UI_FG_CR_MIN = 2.0;   // fg との最小コントラスト比 (fg と被らない)
```

**Albedo での例:**

```
※ stabilizeHue 適用後: tertiary #ECE8E1 (C=0.01) → primary hue 借用、C=0.025

color1 = #D6AD60 (L=0.76, C=0.11) → bgCR=7.8 ✓,  fgCR=1.6 ✗ → 不適格
color2 = #4553A0 (L=0.42, C=0.12) → bgCR=3.2 ✓,  fgCR=3.9 ✓ → 適格
  bgDist(Oklab) = 0.38
color3 = #F1E7D6 (L=0.93, C=0.025) → bgCR=12.8 ✓, fgCR=1.3 ✗ → 不適格

適格: [color2 (bgDist=0.38)]
→ 1 色のみ → navigation = color2, attention = color2
→ frame = color2 から派生
```

---

## 7.5. ui 色導出

### deriveUiColors

```typescript
// ui-colors.ts

/**
 * UI ロール割り当て結果から UI 5 色を導出する
 *
 * @param colors - AI 3 色の OKLCH 値
 * @param roles - assignUiRoles の出力
 * @param bgVisualHex - neutral.bg_visual の hex
 * @param themeTone - "dark" | "light"
 * @returns UiColors (全て hex 文字列)
 */
function deriveUiColors(
  colors: [OklchValues, OklchValues, OklchValues],
  roles: UiRoleAssignment,
  bgVisualHex: string,
  themeTone: "dark" | "light",
): UiColors
```

**ルール:**

```
navigation = oklchToHex(colors[roles.navigation])
attention  = oklchToHex(colors[roles.attention])

frame = navigation 色から派生:
  H = colors[roles.navigation].h
  C = colors[roles.navigation].c × 0.5
  L = dark: 0.35 / light: 0.65

search_bg:
  H = colors[roles.navigation].h
  C = colors[roles.navigation].c
  L = dark: 0.30 / light: 0.85

pmenu_sel_bg = bgVisualHex
```

**frame の派生について:**
navigation と同じ色相で彩度を落とすことで、枠全体（TabLineSel → FolderName → FloatBorder）が
同系色で統一される。定数は暫定値であり、24 キャラの SVG 検証後に調整する。

**UI ロール → ハイライトグループの対応:**

| UI ロール | ハイライトグループ |
|---|---|
| navigation | TabLineSel.fg, NvimTreeFolderName.fg, NvimTreeRootFolder.fg |
| attention | CursorLineNr.fg, NvimTreeGitDirty.fg |
| frame | FloatBorder.fg, WinSeparator.fg |
| search_bg | Search.bg, IncSearch.bg |
| pmenu_sel_bg | PmenuSel.bg |

**定数（暫定、SVG 検証後に調整）:**

```typescript
const FRAME_CHROMA_SCALE = 0.5;
const FRAME_L_DARK = 0.35;
const FRAME_L_LIGHT = 0.65;
const SEARCH_BG_L_DARK = 0.30;
const SEARCH_BG_L_LIGHT = 0.85;
```

---

## 8. コントラスト保証（WCAG AA）

### 適用順序

コントラスト保証はパレット生成の **最終ステップ** として適用する:

```
1. accent 色を生成（AI 3 色 + 隙間充填 + variant）
2. neutral 派生色を生成（固定 L 値で配置）
3. gamutClamp() で sRGB 範囲外を補正
4. ensureContrast() で全色のコントラストを保証  ← ここ
```

neutral の固定 L 値（border=0.30 等）は bg.l の上限（0.18）との組み合わせで
コントラスト不足になる可能性がある。ensureContrast が最終補正として吸収する。

### ensureContrast（双方向対応版）

```typescript
// contrast.ts

/**
 * fg の H/C を保ったまま L を調整し、bg とのコントラスト比を保証する
 *
 * 既存の fg-adjuster.ts は dark theme 専用（L を上方向にのみ探索）。
 * 本実装は themeTone に応じて探索方向を切り替える。
 *
 * @param fgHex - 前景色の hex
 * @param bgHex - 背景色の hex
 * @param minRatio - 最小コントラスト比
 * @param themeTone - "dark" | "light"
 * @returns コントラスト保証済みの hex
 */
function ensureContrast(
  fgHex: string,
  bgHex: string,
  minRatio: number,
  themeTone: "dark" | "light",
): string
```

**アルゴリズム:**

```
1. 現在のコントラスト比が minRatio 以上ならそのまま返す
2. dark theme:  L を L_STEP (0.01) ずつ上げて探索（L_MAX = 0.95 まで）
   light theme: L を L_STEP (0.01) ずつ下げて探索（L_MIN = 0.05 まで）
3. minRatio を満たす最小変更の L を返す
4. 限界に達しても満たせない場合は限界値を返す
```

**定数:**

```typescript
const L_STEP = 0.01;
const L_MAX = 0.95;
const L_MIN = 0.05;
const CONTRAST_AA = 4.5;
const CONTRAST_SUBDUED = 3.0;
```

### 適用対象と閾値

| 対象 | 比較先 | 最小コントラスト比 |
|---|---|---|
| color1〜7, color1_variant, color3_variant | neutral.bg | 4.5 (WCAG AA) |
| color8 | neutral.bg | 4.5 (WCAG AA) |
| neutral.fg | neutral.bg | 4.5 (WCAG AA) |
| neutral.comment | neutral.bg | 3.0 (緩和) |
| neutral.line_nr | neutral.bg | 3.0 (緩和) |
| neutral.border | neutral.bg | 3.0 (緩和) |
| neutral.delimiter | neutral.bg | 3.0 (緩和) |

### sRGB gamut mapping

OKLCH 空間で L/C/H を自由に設定すると、sRGB gamut 外の色が生成される場合がある。
特に高彩度 + 青紫系（C > 0.15, H = 250°〜300°）で発生しやすい。

```typescript
// oklch-utils.ts

/**
 * OKLCH → hex 変換時に sRGB gamut 内に収める
 *
 * culori の clampChroma を使用 (binary search で精度が高い)。
 * H と L を保持し、C のみを減少させて gamut 内に収める。
 *
 * 旧実装: C を 0.01 刻みで手動ループ（最大 100 回、精度が低い）
 * 新実装: culori.clampChroma() による binary search（高精度、1 行）
 */
function gamutClamp(l: number, c: number, h: number): string {
  const clamped = culori.clampChroma({ mode: "oklch", l, c, h }, "oklch", "rgb");
  return culori.formatHex(clamped);
}
```

---

## 8.5. Oklab ユーティリティ

### hexToOklab / oklabDist

```typescript
// oklab-utils.ts

/**
 * hex → Oklab 変換
 * culori の oklab モードを使用
 */
function hexToOklab(hex: string): OklabValues

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

**用途:**
- `assignUiRoles`: bg からの知覚的距離で UI ロールを判定
- `checkDiscrimination`: accent 色間の弁別性を検証

---

## 8.6. 弁別性検証

### checkDiscrimination

```typescript
// discrimination.ts

/**
 * accent 色間の Oklab 距離を検証し、弁別性が不足するペアを報告する
 *
 * Gramazio et al. (2017) Colorgorical の知見に基づく。
 * シンタックスハイライトのような細い文字では ΔE_ok > 0.08〜0.10 が弁別に必要。
 *
 * @param accentHexes - accent 8 色の hex 配列
 * @param labels - 色のラベル配列（警告メッセージ用）
 * @returns 弁別性不足のペアの警告メッセージ配列
 */
function checkDiscrimination(accentHexes: string[], labels: string[]): string[]
```

**アルゴリズム:**

```
全ペア (C(8,2) = 28 通り) について:
  dist = oklabDist(hexToOklab(color_i), hexToOklab(color_j))
  if dist < MIN_DELTA_E (0.08):
    warnings に追加
```

**定数:**

```typescript
const MIN_DELTA_E = 0.08;  // Gramazio 2017 / Gemini research
```

**現在の制限:**
- 警告のみで自動修正は行わない
- 将来的に L/C 自動調整を追加する可能性がある

---

## 9. Valibot スキーマ定義

```typescript
// palette-generator.schema.ts

import * as v from "valibot";

const HexColor = v.pipe(v.string(), v.regex(/^#[0-9a-fA-F]{6}$/));
const ThemeTone = v.picklist(["dark", "light"]);

/** AI Vision 出力のバリデーション */
const VisionResultSchema = v.object({
  impression: v.object({
    primary: v.object({ hex: HexColor, reason: v.string() }),
    secondary: v.object({ hex: HexColor, reason: v.string() }),
    tertiary: v.object({ hex: HexColor, reason: v.string() }),
  }),
  theme_tone: ThemeTone,
  neutral: v.object({
    bg_base_hex: HexColor,
    fg_base_hex: HexColor,
  }),
});

/** パレット出力のバリデーション */
const NeutralPaletteSchema = v.object({
  bg: HexColor,
  fg: HexColor,
  bg_surface: HexColor,
  bg_cursor_line: HexColor,
  bg_visual: HexColor,
  bg_popup: HexColor,
  comment: HexColor,
  line_nr: HexColor,
  border: HexColor,
  delimiter: HexColor,
});

const AccentPaletteSchema = v.object({
  color1: HexColor,
  color1_variant: HexColor,
  color2: HexColor,
  color3: HexColor,
  color3_variant: HexColor,
  color4: HexColor,
  color5: HexColor,
  color6: HexColor,
  color7: HexColor,
  color8: HexColor,
});

const UiColorsSchema = v.object({
  navigation: HexColor,
  attention: HexColor,
  frame: HexColor,
  search_bg: HexColor,
  pmenu_sel_bg: HexColor,
});

const PaletteResultSchema = v.object({
  theme_tone: ThemeTone,
  neutral: NeutralPaletteSchema,
  accent: AccentPaletteSchema,
  ui: UiColorsSchema,
});
```

---

## 10. テスト用 SVG 出力で視覚検証

既存の `scripts/test-vision-ai.ts` の SVG 生成を拡張し、
パレット生成結果を視覚検証する SVG を出力する。

### SVG レイアウト

```
[キャラ名]
[impression 3色: primary | secondary | tertiary]    ← AI 入力（参考表示）
[accent 10色: color1〜8 + variant 2色]              ← 生成結果
[neutral 10色: bg系5 + fg系5]                       ← 生成結果
[ui 3色: accent | search_bg | pmenu_sel_bg]         ← 生成結果
[theme: dark/light]
```

### 保存先

```
debug/vision-ai/{game}/{char}.svg
```

### テスト対象キャラ

色相環 12 色を網羅する 24 キャラで検証する。

**原神 (genshin):**

| # | 色相 | キャラ | 理由 |
|---|---|---|---|
| 1 | 赤 | Klee | 帽子・服・カバン・スキルすべてが真っ赤 |
| 2 | 朱色 | Yanfei | 朱色・コーラル系の髪と衣装 |
| 3 | オレンジ | Yoimiya | 全キャラで最もオレンジの印象が強い |
| 4 | 黄橙 | Navia | 黄金の金髪と華やかな色使い |
| 5 | 黄 | Traveler (Geo) | 岩元素の純粋な黄色 |
| 6 | 黄緑 | Baizhu | 鮮やかな黄緑の髪色 |
| 7 | 緑 | Nahida | 混じりけのない植物の緑 |
| 8 | 青緑 | Faruzan | トルコ石のような青緑 |
| 9 | 青 | Furina | 澄んだ「水」の青 |
| 10 | 青紫 | Clorinde | 青みの強い落ち着いた紫 |
| 11 | 紫 | RaidenShogun | 「雷」を象徴する力強い紫 |
| 12 | 赤紫 | Chevreuse | 鮮やかなマゼンタの髪色 |

**スターレイル (starrail):**

| # | 色相 | キャラ | 理由 |
|---|---|---|---|
| 1 | 赤 | Argenti | 騎士道とバラの濁りのない真紅 |
| 2 | 朱色 | Lingsha | 温かみのある朱・伝統的な赤橙 |
| 3 | オレンジ | Guinaifen | 花火のエネルギー、オレンジの極み |
| 4 | 黄橙 | Trailblazer (Harmony) | 琥珀色・時計屋の黄金 |
| 5 | 黄 | Aglaea | 黄金を織る者、純粋なゴールド |
| 6 | 黄緑 | Luocha | 金髪とスキルの淡いライム |
| 7 | 緑 | Huohuo | 十王司の深緑、和のテイスト |
| 8 | 青緑 | Anaxa | 透き通るターコイズブルー |
| 9 | 青 | Gepard | シルバーメインの冷たく力強い青 |
| 10 | 青紫 | DrRatio | 知性と論理のバイオレット |
| 11 | 紫 | BlackSwan | 赤みも青みもバランスの良い純紫 |
| 12 | 赤紫 | kafka | マゼンタ・ボルドー |

---

## 11. ユニットテスト戦略

純粋関数を優先的にテストする。Vitest を使用。

### テスト対象と観点

| 関数 | テスト観点 |
|---|---|
| `stabilizeHue` | C < 0.015 で hue が primary に置換される、C >= 0.015 はそのまま、primary は常にそのまま |
| `computeGaps` | wrap-around（例: [350, 10, 180]）、2 色入力、同一色相 |
| `fillGaps` | 均等ギャップ（120°×3）、暖色密集（20°,40°,60°）、count=1 |
| `enforceMinHueGap` | 近接色相が 30° 以上に押し広げられる、seed は固定される、既に離れている場合は変更なし |
| `computeTargetLC` | 彩度の外れ値（C=0.01 の tertiary）、dark/light で L 分散値が切り替わる |
| `clampNeutral` | 範囲内（補正なし）、範囲外（L/C 両方補正）、H 保持の確認 |
| `ensureContrast` | dark で L 上昇、light で L 下降、既に満たしている場合はそのまま |
| `gamutClamp` | gamut 内（そのまま）、gamut 外（C が下がる）、H/L が保持される |
| `generateVariants` | C スケール、L オフセットの方向（dark/light） |
| `assignUiRoles` | 全色適格、1 色のみ適格、0 色適格（フォールバック）、Oklab 距離でソートされる |
| `oklabDist` | 同一色 (dist=0)、補色 (dist が大きい)、wrap-around が問題にならない |
| `checkDiscrimination` | ΔE < 0.08 のペアが検出される、全ペア ΔE >= 0.08 なら空配列 |

### テストファイル配置

```
src/features/palette-generator/usecases/__tests__/
├── stabilize-hue.test.ts
├── hue-gap.test.ts
├── accent-palette.test.ts
├── neutral-palette.test.ts
├── contrast.test.ts
├── oklab-utils.test.ts
└── discrimination.test.ts
```

---

## 依存パッケージ

| パッケージ | 用途 | 新規/既存 |
|---|---|---|
| culori | OKLCH ↔ hex 変換 | 既存 |
| valibot | スキーマバリデーション | 新規追加 |
