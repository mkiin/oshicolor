# カラーマッピング設計書 v3

`color-mapper.ts`（v3）が何をどの順番でやっているかを解説するドキュメント。
v2 からの変更点を中心に記述する。

---

## 全体の流れ

```
ColorPoint[]（抽出色・最大12色）
        │
        ▼
  OKLch 変換（L/C/H の数値に変換）
        │
        ▼
  ── Step 1: signatureHue 取得 ──────────────────────────
  │  C 最大色の Hue → signatureHue（fallback: 270°）
  └──────────────────────────────────────────────────────
        │
        ▼
  ── Step 2: bg 生成 ─────────────────────────────────────
  │  generateNeutral(concept.bgL, signatureHue)
  │  C=0.02 のニュートラル色（鮮やかな色が bg に来ない）
  └──────────────────────────────────────────────────────
        │
        ▼
  ── Step 3: fg 選択 ─────────────────────────────────────
  │  ダーク: L最大 >= fgThreshold → 抽出色採用、未達 → neutral 生成
  │  ライト: L最小 <= fgThreshold → 抽出色採用、未達 → neutral 生成
  └──────────────────────────────────────────────────────
        │
        ▼
  ── Step 4: Comment ─────────────────────────────────────
  │  C 最小の抽出色 → Comment.fg
  └──────────────────────────────────────────────────────
        │
        ▼
  ── Step 5: accents 構築 ─────────────────────────────────
  │  comment のみ除外、残りを C 降順で列挙（最大 11 色）
  └──────────────────────────────────────────────────────
        │
        ├──── Zone A（抽出色を直接割り当て）
        │     C1位 → Keyword
        │     C2位 → Function
        │     C3位 → Special
        │
        └──── Zone B（補完色を生成）
              accents[3]以降を候補として
              String / Type / Number の Hue を補完
              L 計算はコンセプトで分岐

        ↓
  HighlightMap（全ハイライトグループ）
```

---

## v2 からの変更点サマリ

| 箇所 | v2 | v3 |
|---|---|---|
| bg の取得 | L 最小の抽出色 | signatureHue を借用した neutral 生成 |
| fg の取得 | L 最大の抽出色 | fgThreshold チェック → 未達は neutral 生成 |
| accent の除外 | bg + fg + comment | comment のみ |
| accent 最大数 | 9 色 | 11 色 |
| Zone B L 計算 | `max(bgL + 0.35, sig.l + 0.08)` | ダーク同上、ライト `max(fgL + 0.25, sig.l - 0.08)` |
| Zone B C 計算 | `sig.c × 0.35` | `sig.c × concept.cRatio`（コンセプト別） |
| shiftL 方向 | 常に + | `concept.isDark ? + : -` |
| 関数シグネチャ | `(palette)` | `(palette, conceptName = "darkClassic")` |

---

## Step 1: signatureHue の取得

```typescript
const sortedByC = [...colors].sort((a, b) => b.c - a.c);
const signatureHue = sortedByC[0]?.h ?? 270;
```

bg と fg のニュートラル色生成に使う Hue。
パレット全体の「代表色相」として最も鮮やかな色の Hue を使う。
未定義の場合は 270°（紫系）にフォールバックする。

---

## Step 2: bg の生成

```typescript
const bgHex = generateNeutral(concept.bgL, signatureHue);
```

```typescript
const generateNeutral = (l: number, h: number): string => {
    const generated = clampChroma(
        { mode: "oklch" as const, l, c: 0.02, h },
        "oklch",
        "rgb",
    );
    return formatHex(generated) ?? "#000000";
};
```

### なぜ抽出色から取らないのか

v2 では「L 最小の抽出色 = bg」としていたが、以下の問題が発生した：

- **鮮やかな暗色が bg に来る**: `#57151e`（暗い赤）のように C 値が高くても L が低い色が bg になり、長時間の使用でエディタが疲れる
- **パステル系で崩壊**: 全色 L>0.5 のパレットでは「最も暗い色」でも L≈0.55 程度になり、ダークテーマが成立しない

C=0.02 のニュートラル色（ほぼ無彩色）を生成することで、これらの問題を根本解決する。
Hue だけ引き継ぐのでキャラクターの「空気感」が薄く bg に残る。

---

## Step 3: fg の選択

### ダークテーマ（darkClassic / darkMuted）

```typescript
const sortedByLDesc = [...colors].sort((a, b) => b.l - a.l);
const fgCandidate = sortedByLDesc[0];
fgHex =
    fgCandidate && fgCandidate.l >= concept.fgThreshold  // 0.70
        ? fgCandidate.hex
        : generateNeutral(concept.fgL, signatureHue);   // L=0.88 or 0.85
```

### Light Pastel

```typescript
const sortedByLAsc = [...colors].sort((a, b) => a.l - b.l);
const fgCandidate = sortedByLAsc[0];
fgHex =
    fgCandidate && fgCandidate.l <= concept.fgThreshold  // 0.35
        ? fgCandidate.hex
        : generateNeutral(concept.fgL, signatureHue);   // L=0.15
```

---

## Step 4: accent pool の変更（最大 11 色）

v2 は bg・fg・comment を `usedHexes` に入れて accents から除外していた。
v3 は bg が生成色（抽出色に存在しない）なので除外不要。
fg の採用有無に関わらず除外しない。comment のみ除外する。

```typescript
const usedHexes = new Set<string>();
if (commentColor) {
    usedHexes.add(commentColor.hex);
}

const accents = colors
    .filter((c) => !usedHexes.has(c.hex))
    .sort((a, b) => b.c - a.c);
```

結果として最大 11 色（12色 - comment 1色）が accent 候補になる（v2 は最大 9 色）。

---

## Zone A：抽出色を直接割り当て

変更なし。C 値の順位だけで割り当てる。

```
accents[0] → Keyword   （C最大。キャラクター象徴色）
accents[1] → Function  （C2位）
accents[2] → Special   （C3位）
```

---

## Zone B：補完色の生成（L/C 計算がコンセプト対応）

### L 計算の分岐

```typescript
const l = isDark
    ? Math.max(bgL + 0.35, signature.l + 0.08)
    : Math.max(fgL + 0.25, signature.l - 0.08);
```

**ダークテーマ**: bg(暗い) より 0.35 明るく保証。コードは明るいほど視認しやすい。
**Light Pastel**: fg(暗い, L=0.15) より 0.25 明るい = L≈0.40 程度。bg(L=0.97) との間に収まる。

### C 計算の分岐

```typescript
const c = Math.max(signature.c * cRatio, C_FLOOR);
```

コンセプト別の cRatio を使う（darkClassic: 0.35 / darkMuted: 0.20 / lightPastel: 0.40）。
darkMuted はより控えめな補完色になる。

---

## CursorLine / Visual / Pmenu のシフト方向

ダークテーマは bg が暗いので「明るくシフト」、ライトテーマは bg が明るいので「暗くシフト」する。

```typescript
CursorLine: shiftL(bgHex, concept.isDark ? +0.04 : -0.04)
Visual:     shiftL(bgHex, concept.isDark ? +0.08 : -0.08)
Pmenu:      shiftL(bgHex, concept.isDark ? +0.03 : -0.03)
```

---

## フォールバックシステム（v3）

v2 から変更なし。抽出色が少ない場合に段階的に代替色を用意する。

```
┌────────────────────────────────────────────────────────┐
│ Comment: remaining が 0 色なら shiftL(fg, -0.20)       │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ Zone A（accents が不足する場合）                        │
│   accents[0] がない → shiftL(fg, -0.05) を Keyword に  │
│   accents[1] がない → shiftL(fg, -0.10) を Function に │
│   accents[2] がない → shiftL(fg, -0.15) を Special に  │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ Zone B: 候補色なし → 象徴色から補完色を生成            │
└────────────────────────────────────────────────────────┘
```

---

## 実例：4色抽出（ダーク系キャラ）のケース

```
抽出色:
  #57151e  Chocolate Cosmos  L=0.24, C=0.18  → v2 では bg になっていた
  #7f549e  Royal Lilac       L=0.43, C=0.15
  #c1a4c1  Novel Lilac       L=0.70, C=0.10
  #d5233f  Lollipop          L=0.38, C=0.25
```

```
v3 処理（darkClassic）:
  signatureHue = #d5233f の H (≈ 25°)

  bg = generateNeutral(0.12, 25°) → #200e0c（暗い赤みがかったニュートラル）
       ← v2 の #57151e（鮮やかな暗色）から改善

  fg 選択:
    L 最大 = #c1a4c1 の L=0.70 >= fgThreshold(0.70) → 採用
    fgHex = #c1a4c1

  Comment: C 最小 = #c1a4c1 か? 全色の C 最小は #c1a4c1(C=0.10)
    commentColor = #c1a4c1

  accents（comment 除外）= [#d5233f, #57151e, #7f549e]（C 降順）

  Zone A:
    Keyword  = #d5233f（C=0.25, 赤）
    Function = #57151e（C=0.18, 暗赤）
    Special  = #7f549e（C=0.15, 紫）

  Zone B（zoneBCandidates = []、全て生成）:
    String  → H=130° で生成
    Type    → H=195° で生成
    Number  → H=55°  で生成
```

---

## 実例：パステル系キャラのケース

```
仮定パレット（全色 L > 0.5）:
  #f5c2e7  ピンク   L=0.84, C=0.12
  #cba6f7  紫      L=0.75, C=0.18
  #89b4fa  青      L=0.74, C=0.14
  #a6e3a1  緑      L=0.86, C=0.12
```

```
v2 の問題: L 最小 = #89b4fa（L=0.74）が bg になる → ダークテーマ不成立

v3 処理（darkClassic）:
  signatureHue = #cba6f7 の H (≈ 285°)

  bg = generateNeutral(0.12, 285°) → #150e1c（暗い紫みがかったニュートラル）
       ← L=0.12 の十分暗い bg が生成される

  fg 選択:
    L 最大 = #a6e3a1 の L=0.86 >= fgThreshold(0.70) → 採用
    fgHex = #a6e3a1

  以降 Zone A / B は通常通り処理される
```
