# R2 残課題

現在の `color-mapper.ts` 実装（Hue ルールベース・初期実装）を検証した結果、
以下の問題が明確になった。

---

## 課題 1: Hue 多様性がないパレットで崩壊する（最重要）

### 現象

全12色が紫/マゼンタ帯（Hue 270〜350°）に集中した画像で試したところ、
`String` / `Function` / `Type` が同一色または Normal.fg になった。

```
String   = #95216e  （@keyword と同系色）
Type     = #e2d8f0  （= Normal.fg そのまま）
Function = #95216e  （String と同じ色）
```

### 原因

現アルゴリズムは「パレットに全 Hue レンジの色が揃っている」前提で動く。
Hue ルールにマッチしないグループは、フォールバックとして「Hue 距離最小のアクセント色」を使うが、
全アクセントが同一 Hue 帯に集中していると全グループが同じ色になる。

また `Type` が `REQUIRED_GROUPS` のフォールバックリストから漏れており、
マッチしない場合は無条件に `Normal.fg` になる。

### 必要な対処

→ **課題 3（Zone B: 補完色生成）**で解決する。

---

## 課題 2: キャラクターテーマの設計思想が実装に反映されていない

### 現状

現実装は「抽出色を Hue で分類して syntax グループに当てる」だけ。
「キャラクターの象徴色を keyword に当てる」という意図が存在しない。

### 必要な思想

今後の R2 は以下の3ゾーン構造で設計する：

```
Zone A: キャラクター色（抽出パレットから直接使う）
  Normal.bg    ← L 最小
  Normal.fg    ← L 最大
  @keyword     ← C 最大（象徴色・テーマの顔）
  @function    ← C 2位
  @special     ← C 3位
  Comment      ← C 最小（最も沈んだ色）
  UI 派生系    ← bg から shiftL

Zone B: キャラクター色に「調和させた」補完色（生成）
  @string      ← 不足 Hue を補完。ただし C を低く抑える（脇役）
  @type        ← 同上
  @number      ← 同上

Zone C: 意味論的慣習色（固定）
  DiagnosticError   ← 赤系固定
  DiagnosticWarn    ← 黄系固定
  GitSignsAdd       ← 緑系固定
  GitSignsDelete    ← 赤系固定
```

---

## 課題 3: Zone B の補完色生成アルゴリズムが未実装

### 概要

パレットに `@string`（緑系）や `@type`（青系）に対応する色がない場合、
その Hue を補完する色を生成する仕組みが必要。

### 設計方針

キャラクターの象徴色（C 最大の色）の L・C を参照しながら、
Hue だけ回転させた「脇役色」を生成する。

```
象徴色: oklch(L₀, C₀, H₀)  ← 例: oklch(0.55, 0.28, 305°)

@string の補完色:
  L = L₀ + 0.08  （わずかに明るく）
  C = C₀ × 0.35  （彩度を大幅に下げる → 目立ちすぎない脇役）
  H = 130°        （緑系の慣習 Hue に固定）

@type の補完色:
  L = L₀ + 0.05
  C = C₀ × 0.35
  H = 195°        （水色系の慣習 Hue）

@number の補完色:
  L = L₀ + 0.12
  C = C₀ × 0.40
  H = 55°         （黄系の慣習 Hue）
```

C を C₀ × 0.35 程度に抑えることで、
「キャラクター象徴色だけが鮮やかで、補完色は同じ世界にいる脇役」
という構図が生まれる。

### 判定ロジック

パレット内に各 Hue レンジの色が存在するかを判定し、
存在しなければ補完色生成にフォールバックする。

---

## 課題 4: Zone C（semantic 慣習色）が未実装

### 現状

`DiagnosticError`, `DiagnosticWarn`, `GitSigns` 系が HighlightMap に含まれていない。

### 方針

これらはキャラクターパレットから導出しない。固定の base 色と bg とのブレンドで生成する。

```typescript
// semantic 色の固定 base（慣習色）
const SEMANTIC_BASE = {
    error: "#e82424", // samuraiRed
    warning: "#ff9e3b", // roninYellow
    info: "#658594", // dragonBlue
    hint: "#6a9589", // waveAqua1
    gitAdd: "#76946a", // autumnGreen
    gitDel: "#c34043", // autumnRed
    gitChg: "#dca561", // autumnYellow
};

// bg とブレンドして bg の色温度に馴染ませる
const diagFg = blend(SEMANTIC_BASE.error, normalBg, 0.15);
```

---

## 課題 5: bg 階調が不足している

### 現状

現実装の bg 派生は以下のみ：

```
CursorLine.bg = shiftL(bg, +0.04)
Visual.bg     = shiftL(bg, +0.08)
Pmenu.bg      = shiftL(bg, +0.03)
```

### 必要な階調（kanagawa を参考に）

```
bg_m2  = shiftL(bg, -0.03)  ← Float, StatusLine など最暗部
bg_m1  = shiftL(bg, -0.01)
bg                           ← Normal.bg（基準）
bg_p1  = shiftL(bg, +0.04)  ← ColorColumn, Gutter
bg_p2  = shiftL(bg, +0.07)  ← CursorLine
bg_p3  = shiftL(bg, +0.12)  ← Visual, Search
```

これらを内部的な `ThemeSpec` として持ち、各グループへのマッピングに使う。

---

## 課題 6: ライトテーマ生成の精度

### 現状

`(1 - L) × factor` による単純な明度反転。
ダークとライトで色の印象が大きく変わりやすく、特に低彩度色で白飛びが起きる。

### 方針

現フェーズではライトテーマの精度は優先度低として据え置く。
kanagawa の lotus テーマのように、ライト専用のパレット色を持つ設計も将来の選択肢。

---

## 課題 7: ターミナル ANSI 16色が未実装

### 現状

HighlightMap に `terminal_color_0` 〜 `terminal_color_15` が含まれていない。

### 方針

kanagawa の `term` 配列を参考に、以下の慣習色 + キャラクター色のハイブリッドで生成する：

```
black   → Normal.bg
red     → diag.error
green   → vcs.added（Zone C）
yellow  → diag.warning
blue    → @function（Zone A）
magenta → @keyword（Zone A = キャラクター象徴色）
cyan    → @type（Zone B）
white   → Normal.fg
```

---

## 課題 8: `variable = "none"` パターンの明示

### 現状

`Variable.fg = Normal.fg` を明示的に設定している。

### 方針

kanagawa に倣い `"none"` を使うことで「Normal.fg を継承する」ことを明示する設計を検討。
現状は機能的には同等なので優先度低。

---

## 優先度まとめ

| 優先度 | 課題         | 理由                                                |
| ------ | ------------ | --------------------------------------------------- |
| 🔴 高  | 課題 1, 2, 3 | キャラクターテーマとして成立しない根本問題          |
| 🟡 中  | 課題 4, 5    | Neovim テーマとして使えるレベルに到達するために必要 |
| 🟢 低  | 課題 6, 7, 8 | 将来の品質向上。現フェーズはスキップ可              |
