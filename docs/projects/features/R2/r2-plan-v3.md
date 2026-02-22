# R2 実装プラン v3: bg 生成方式とコンセプトシステム

## なぜ v3 が必要か

v2（実装済みの `color-mapper.ts`）は「単色 Hue 帯パレット問題」を C 値ランク割り当てで解決したが、
**bg 選択**に根本的な問題が残っていた。

### v2 の bg 問題

| 問題 | 症状 |
|---|---|
| 鮮やかな暗色が bg になる | `#57151e`（暗い赤）が bg になりエディタが疲れる |
| パステル系で崩壊 | 全色 L>0.5 のパレットでは L 最小でも明るすぎてダークテーマ不成立 |
| ニュートラル色の欠如 | 灰系の色が面積小で抽出されず bg 候補として出てこない |

v2 は「L 最小の抽出色 → bg」としていたため、これらの問題を根本解決できなかった。

### 解決方向の調査結果

業界調査（`r2-remaining-issues-v2.md` 参照）により、解決策は2つに収束していた：

- **A 方式（Material You）**: bg を生成する（抽出色から取らない）
- **B 方式（vscode-theme-generator 等）**: bg をユーザーに選ばせる

v3 は **A 方式を核心的な修正**として採用し、加えてコンセプト 3 種（B 方式の簡易版）も導入する。

---

## 設計思想

### bg 生成の根本的変更

**v2**: L 最小の抽出色 → bg（崩壊あり）

**v3**: 象徴色（C 最大 = accents[0]）の Hue だけを借用してニュートラル色を生成

```
signatureHue = 抽出色を C 降順で並べた [0] の Hue（undefined → 270° fallback）
bgColor = clampChroma(oklch(concept.bgL, 0.02, signatureHue), "oklch", "rgb")
```

C=0.02 のほぼ無彩色なので鮮やかな色が bg に来ることがなくなる。
Hue だけ引き継ぐのでキャラクターの「空気感」が薄く bg に残る。

### コンセプトシステム（3 種）

bg の明度を含む基本パラメータをコンセプトとして管理する。
B 方式の「ユーザー選択」の簡易版として機能する。

```typescript
export const THEME_CONCEPTS: Record<ConceptName, ConceptConfig> = {
    darkClassic:  { isDark: true,  bgL: 0.12, fgL: 0.88, fgThreshold: 0.70, cRatio: 0.35 },
    darkMuted:    { isDark: true,  bgL: 0.10, fgL: 0.85, fgThreshold: 0.70, cRatio: 0.20 },
    lightPastel:  { isDark: false, bgL: 0.97, fgL: 0.15, fgThreshold: 0.35, cRatio: 0.40 },
};
```

---

## Zone 設計（v3）

```
┌─ Zone A: キャラクター色（抽出パレットから直接使う）
│   Normal.bg    ← 生成（signatureHue + bgL で neutral 色を作る）← v3 変更点
│   Normal.fg    ← 抽出色 or 生成（fgThreshold チェック）← v3 変更点
│   @keyword     ← C 最大（象徴色・テーマの顔）
│   @function    ← C 2位
│   @special     ← C 3位
│   Comment      ← C 最小
│   UI 派生系    ← bg から shiftL（方向はコンセプト依存）
│
├─ Zone B: キャラクター色に「調和させた」補完色（生成）
│   @string      不足 Hue を補完。C を低く抑えた「脇役色」
│   @type        同上
│   @number      同上
│
└─ Zone C: 意味論的慣習色（固定）※将来実装
    DiagnosticError  / DiagnosticWarn / DiagnosticInfo / DiagnosticHint
```

---

## Zone A：アルゴリズム（v3）

### v2 との違い

| 項目 | v2 | v3 |
|---|---|---|
| bg | L 最小の抽出色 | signatureHue を借用した neutral 生成色 |
| fg | L 最大の抽出色 | fgThreshold チェック → 未達は neutral 生成 |
| accent 候補 | bg・fg・comment を除外 → 最大 9 色 | comment のみ除外 → 最大 11 色 |
| C_RATIO | 固定 0.35 | コンセプト別（0.35 / 0.20 / 0.40） |

### bg 生成

```
signatureHue = colors を C 降順ソートした [0].h （fallback: 270°）
bg = clampChroma({oklch, l: concept.bgL, c: 0.02, h: signatureHue}, "oklch", "rgb")
```

### fg 選択ロジック

```
ダークテーマ:
  L 最大の抽出色 >= fgThreshold(0.70) → 採用
  それ以下 → clampChroma({oklch, l: concept.fgL, c: 0.02, h: signatureHue})

Light Pastel:
  L 最小の抽出色 <= fgThreshold(0.35) → 採用
  それ以上 → clampChroma({oklch, l: concept.fgL, c: 0.02, h: signatureHue})
```

### accent pool の拡大

bg は生成色なので抽出色から除外不要。fg の採用有無に関わらず除外しない。
comment のみ除外するため、accent 候補は最大 11 色（v2 は最大 9 色）になる。

```
前処理:
  signatureHue = C 最大抽出色の Hue
  bg = generateNeutral(concept.bgL, signatureHue)  ← 生成
  fg = 抽出色 or generateNeutral(concept.fgL, signatureHue)
  C 最小 → Comment（used に追加）

accents = comment を除いた全色を C 降順で並べたリスト

Zone A 割り当て:
  accents[0] → @keyword   （キャラクターの象徴色）
  accents[1] → @function  （副象徴色）
  accents[2] → @special   （第3色）
```

---

## Zone B：補完色生成アルゴリズム（v3）

### target Hue（変更なし）

```typescript
export const ZONE_B_TARGETS = [
    { group: "String",  targetHue: 130, hueRange: 45 },  // 緑系
    { group: "Type",    targetHue: 195, hueRange: 45 },  // 水色系
    { group: "Number",  targetHue:  55, hueRange: 45 },  // 黄金系
] as const;
```

### L 計算のコンセプト対応（v3 変更点）

```
ダークテーマ:
  L = max(bgL + 0.35, signature.l + 0.08)  ← v2 と同じ

Light Pastel:
  L = max(fgL + 0.25, signature.l - 0.08)  ← 反転
  例: fgL(0.15) + 0.25 = 0.40 → bgL(0.97) に対して十分なコントラスト
```

### C 計算のコンセプト対応（v3 変更点）

```
C = max(signature.c × concept.cRatio, C_FLOOR)
  darkClassic:  cRatio = 0.35（v2 と同じ）
  darkMuted:    cRatio = 0.20（より控えめ）
  lightPastel:  cRatio = 0.40（明るい地に映える）
```

---

## CursorLine / Visual のシフト方向修正

v2 はダークテーマのみ想定でシフト方向が固定されていた。

```typescript
// v2
CursorLine: shiftL(bgHex, +0.04)  // 暗い bg を明るくシフト

// v3: isDark で分岐
CursorLine: shiftL(bgHex, concept.isDark ? +0.04 : -0.04)
Visual:     shiftL(bgHex, concept.isDark ? +0.08 : -0.08)
Pmenu:      shiftL(bgHex, concept.isDark ? +0.03 : -0.03)
```

---

## mapColorsToTheme シグネチャ変更

```typescript
// v2
export const mapColorsToTheme = (palette: ColorPoint[]): HighlightMap

// v3
export const mapColorsToTheme = (
    palette: ColorPoint[],
    conceptName: ConceptName = "darkClassic",
): HighlightMap
```

デフォルト引数により既存の呼び出しは変更不要。
UI からコンセプトを選択して渡すことで複数テーマに対応する。

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `src/features/theme-generator/hue-rules.ts` | `ConceptName`, `ConceptConfig` 型と `THEME_CONCEPTS` 定数を追加。`C_RATIO` を削除（`ConceptConfig.cRatio` に移動） |
| `src/features/theme-generator/color-mapper.ts` | bg 生成変更、fg 選択ロジック追加、Zone B L/C 計算コンセプト対応、shiftL 方向修正、`conceptName` パラメータ追加 |
| `src/routes/index.tsx` | コンセプト選択 UI（3択ボタン）追加、`mapColorsToTheme(result, concept)` 呼び出し更新 |

---

## 検証観点

- `pnpm build` が通ること（biome エラーなし）
- パステル系キャラ：全色 L>0.5 のパレットでも bg が暗色になること
- 鮮やかな暗色キャラ：以前 `#57151e` だった bg が neutral に変わること
- Dark Classic / Dark Muted / Light Pastel の切り替えが機能すること
- Light Pastel でも CursorLine / Visual が bg より暗くなること（シフト方向確認）
