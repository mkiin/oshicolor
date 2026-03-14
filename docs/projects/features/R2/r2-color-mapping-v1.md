# R2: Neovim ハイライトグループへの自動カラーマッピング

## Context

R1 で抽出した `ColorPoint[]` を受け取り、Neovim カラースキームとして使用できる `HighlightMap` を自動生成する。
アルゴリズムは OKLch 色空間の Hue・Chroma・Lightness を軸にしたルールベース分類で、ダーク／ライト両バリアントを生成する。

**配置**: `src/features/theme-generator/`

---

## 型定義

```typescript
// 入力（R1 から受け取る）
type ColorPoint = {
  id: number;
  x: number; // 正規化座標（0〜1）
  y: number; // 正規化座標（0〜1）
  color: string; // "#RRGGBB"
  name?: string;
};

// ハイライトグループの属性
type HighlightAttr = {
  fg?: string; // "#RRGGBB"
  bg?: string; // "#RRGGBB"
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

// 出力: グループ名 → 属性のマップ
type HighlightMap = Record<string, HighlightAttr>;

// ダーク＋ライト両バリアント
type ThemeVariants = {
  dark: HighlightMap;
  light: HighlightMap;
};
```

---

## 対象ハイライトグループ（MVP）

### 直接割り当て（抽出色から選ぶ）

| グループ   | 意味                 | 典型的な色                 |
| ---------- | -------------------- | -------------------------- |
| `Normal`   | 背景・前景（基準）   | bg=最暗色, fg=最明色       |
| `Comment`  | コメント文字色       | 低彩度・中明度             |
| `String`   | 文字列リテラル       | 緑系（H 90〜150）          |
| `Function` | 関数・メソッド名     | 黄/橙系（H 30〜90）        |
| `Keyword`  | 予約語               | 青/紫系（H 210〜330）      |
| `Type`     | 型名・クラス名       | 青緑系（H 150〜210）       |
| `Number`   | 数値・Boolean        | 黄/橙系（Function に近い） |
| `Special`  | 特殊記号・エスケープ | ピンク/赤系（H 330〜30）   |

### 派生（計算で生成）

| グループ       | 派生元               | 生成方法               |
| -------------- | -------------------- | ---------------------- |
| `Variable`     | `Normal.fg`          | そのまま使用           |
| `Operator`     | `Keyword`            | 同色または OKLch L ±5% |
| `Boolean`      | `Number`             | 同色                   |
| `CursorLine`   | `Normal.bg`          | OKLch L +4%            |
| `Visual`       | `Normal.bg`          | OKLch L +8%            |
| `LineNr`       | `Comment`            | 同色                   |
| `CursorLineNr` | `Normal.fg`          | OKLch L -10%           |
| `Pmenu`        | `Normal.bg`          | OKLch L +3%            |
| `PmenuSel`     | 最高彩度の accent 色 | bg として使用          |

---

## マッピングアルゴリズム（ダークテーマ）

### ステップ 1: OKLch に変換

全 `ColorPoint` を `culori` の `oklch()` で変換し、各色の `{ L, C, H }` を取得する。

```typescript
import { oklch, formatHex, parse } from "culori";

// "oklch" モードに変換。null になる場合は除外する
const toOklch = (hex: string) => oklch(parse(hex));
```

### ステップ 2: 基準色の確定

```
最小 L の色     → Normal.bg（最も暗い色を背景に）
最大 L の色     → Normal.fg（最も明るい色を前景に）
最小 C の残り色 → Comment.fg（最も彩度が低い色をコメントに）
```

残りの色を C（彩度）降順で並べ、上位を **accent 候補** として保持する。

### ステップ 3: Hue レンジによるグループ分類

各 accent 候補色の H 値を下表のレンジに照合し、グループを決定する。

| H レンジ         | 優先割り当てグループ          |
| ---------------- | ----------------------------- |
| 330〜360 / 0〜30 | `Special`                     |
| 30〜90           | `Function`, `Number`          |
| 90〜150          | `String`                      |
| 150〜210         | `Type`                        |
| 210〜270         | `Keyword`                     |
| 270〜330         | `Keyword`（青紫）/ `Operator` |

- 各レンジに候補色が複数ある場合: **最高彩度の色** を採用する
- 候補がない場合: **最も Hue 距離が近い accent 色** を代用する

### ステップ 4: 未割り当てグループの補完

重要グループ（`String` / `Function` / `Keyword`）が未割り当ての場合:

1. accent 候補を Hue 距離でソートして最近傍を再アサイン
2. accent 候補が完全に枯渇した場合: `Normal.fg` の OKLch L 値を調整した派生色を使用

### ステップ 5: 派生色の計算

OKLch L 値の加算で明度をずらして派生色を生成する。

```typescript
// CursorLine: 背景より L +4% 明るい色
const shiftLightness = (hex: string, delta: number): string => {
  const color = oklch(parse(hex));
  if (!color) return hex;
  return formatHex({ ...color, l: Math.min(1, Math.max(0, color.l + delta)) });
};

// 使用例
const cursorLine = shiftLightness(normalBg, 0.04);
const visual = shiftLightness(normalBg, 0.08);
const pmenu = shiftLightness(normalBg, 0.03);
const cursorLineNr = shiftLightness(normalFg, -0.1);
```

---

## ライトテーマ生成

ダークテーマの `HighlightMap` から変換する。Hue と Chroma はそのまま保持し、**明度（L）のみ反転**する。
キャラクターの色相（雰囲気）を維持しながら視認性を確保するのが目的。

```
Normal.bg ↔ Normal.fg を入れ替え（背景↔前景を反転）

各 fg 色: L_light = (1 - L_dark) × 0.8  // 暗くして読みやすくする
各 bg 色: L_light = (1 - L_dark) × 0.9  // わずかに明るさを確保
Hue (H), Chroma (C) は変更しない
```

```typescript
const invertForLight = (hex: string, isFg: boolean): string => {
  const color = oklch(parse(hex));
  if (!color) return hex;
  const factor = isFg ? 0.8 : 0.9;
  return formatHex({ ...color, l: (1 - color.l) * factor });
};
```

---

## 色数が少ない場合の縮退戦略（5色パレット）

5色のみの場合はハイライトグループが不足する。以下の優先度で割り当てる。

| 優先度 | 割り当て先                   | 方法                                                  |
| ------ | ---------------------------- | ----------------------------------------------------- |
| 1      | `Normal.bg`                  | 最小 L の色                                           |
| 2      | `Normal.fg`                  | 最大 L の色                                           |
| 3      | `Comment.fg`                 | 最小 C の残り色                                       |
| 4      | `Keyword.fg`                 | 最高彩度の青紫系（H 210〜330）または彩度最大色        |
| 5      | `String.fg`                  | 2番目の accent 色                                     |
| 派生   | `Function`, `Type`, `Number` | `String` または `Keyword` から Hue 固定・L 調整で生成 |

---

## 依存パッケージ

| パッケージ | バージョン | 用途                                  |
| ---------- | ---------- | ------------------------------------- |
| `culori`   | ^4.0.2     | OKLch 変換・Hue/L/C 操作（R1 と共用） |

**新規パッケージの追加なし。**

### 調査・不採用ライブラリ

| ライブラリ                           | 不採用理由                                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `@material/material-color-utilities` | 単一ソースカラーから Material Design ロールを生成する設計。我々は既に抽出済みの多色パレットを持つため用途が合わない |
| `dittoTones`                         | 既存デザインシステムの L/C カーブをコピーしてパレットを生成するツール。ロール割り当てには不要                       |
| `color-harmony` / `colord`           | 補色・類似色のハーモニー生成用。Hue 分類には不要                                                                    |
| `iwanthue`                           | 知覚的に均一なパレット生成ツール。R1 で色は既に抽出済み                                                             |

R2 の核心は「Hue レンジによるカスタム分類」であり、汎用セマンティックロール割り当てライブラリとはユースケースが異なる。`culori` が提供する OKLch 操作だけで全ステップを実装できる。

---

## ファイル構成

```
src/features/theme-generator/
  ├── types.ts            # HighlightAttr, HighlightMap, ThemeVariants 型定義
  ├── hue-rules.ts        # Hue レンジ定義テーブル（定数）
  └── color-mapper.ts     # メイン: ColorPoint[] → ThemeVariants
```

### `types.ts`

```typescript
export type HighlightAttr = {
  fg?: string;
  bg?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};
export type HighlightMap = Record<string, HighlightAttr>;
export type ThemeVariants = { dark: HighlightMap; light: HighlightMap };
```

### `hue-rules.ts`

```typescript
// Hue レンジ → 割り当てグループのマッピングテーブル
// レンジを変更する際はここだけ修正する
export const HUE_RULES: Array<{ min: number; max: number; group: string }> = [
  { min: 330, max: 360, group: "Special" },
  { min: 0, max: 30, group: "Special" },
  { min: 30, max: 90, group: "Function" },
  { min: 90, max: 150, group: "String" },
  { min: 150, max: 210, group: "Type" },
  { min: 210, max: 270, group: "Keyword" },
  { min: 270, max: 330, group: "Keyword" },
];
```

### `color-mapper.ts` の公開インターフェース

```typescript
/**
 * ColorPoint[] からダーク・ライト両バリアントの HighlightMap を生成する
 *
 * @param palette - R1 が出力した ColorPoint の配列
 * @returns ダーク・ライト両テーマの HighlightMap
 */
export const mapColorsToTheme = (palette: ColorPoint[]): ThemeVariants => { ... };
```

---

## 検証方法

- **ユニットテスト**: 5色 / 8色 / 16色の入力で全必須グループが埋まることを確認
- **コントラスト**: R3 と連携し `Normal.bg` × 各 fg のコントラスト比が 4.5:1 以上かを検証
- **目視**: 生成された `HighlightMap` を R5 プレビューに流して実際のテーマ見た目を確認

---

## 将来の拡張点

- 現実装はルールベース。将来的に LLM によるロール推論（「この色はキャラの主張色なので Keyword に使いたい」等）へ移行できる拡張点として設計を保持する
- `mini.hues`・`catppuccin` の Hue テーブル設計を参考実装として参照可能（実装パターンの参考に留め、依存はしない）
