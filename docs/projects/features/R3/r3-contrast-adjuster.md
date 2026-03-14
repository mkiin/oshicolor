# R3: コントラスト自動調整

## Context

R2 が出力した `ThemeVariants` を受け取り、WCAG 2.1 コントラスト比を検証・調整した `ThemeVariants` を返す。
調整は **OKLch L 値（明度）のみ**を変更し、Hue と Chroma（色相・彩度）を保持することでキャラクターの色味を維持する。

**配置**: `src/features/theme-generator/contrast-adjuster.ts`

---

## WCAG コントラスト比の基礎

WCAG 2.1 では以下の計算式でコントラスト比を定義する。

```
// 相対輝度（sRGB → 線形変換）
for each channel in [R, G, B]:
  if channel <= 0.04045: linear = channel / 12.92
  else: linear = ((channel + 0.055) / 1.055) ^ 2.4

luminance = 0.2126·R + 0.7152·G + 0.0722·B

// コントラスト比
ratio = (L_lighter + 0.05) / (L_darker + 0.05)
```

`culori` は `wcagLuminance(color)` と `wcagContrast(colorA, colorB)` でこれを提供する。

**MVP で使用する閾値**:

| 基準     | コントラスト比 | 用途                     |
| -------- | -------------- | ------------------------ |
| WCAG AA  | 4.5:1          | 通常テキスト（最低保証） |
| WCAG AAA | 7:1            | 長時間コーディング推奨   |

デフォルトは **4.5:1**（AA）。ユーザーが 7:1 に変更できる設計にする。

---

## 型定義

```typescript
// 調整設定
type ContrastOptions = {
  minRatio: number; // デフォルト 4.5（WCAG AA）
};

// 調整結果（before/after を保持）
type ContrastResult = {
  adjusted: ThemeVariants; // コントラスト調整済みテーマ
  warnings: ContrastWarning[];
};

// 調整できなかった色の警告
type ContrastWarning = {
  group: string; // ハイライトグループ名
  fg: string; // 調整後の fg 色（最大限努力した結果）
  bg: string; // 対応する bg 色
  ratio: number; // 達成できた実際のコントラスト比
  required: number; // 要求されていたコントラスト比
};
```

---

## 検証対象のペア

すべてのペアは「fg が bg に対して十分なコントラストを持つか」を確認する。

### 必須チェック（直接割り当て色）

| fg            | bg          |
| ------------- | ----------- |
| `Normal.fg`   | `Normal.bg` |
| `Comment.fg`  | `Normal.bg` |
| `String.fg`   | `Normal.bg` |
| `Function.fg` | `Normal.bg` |
| `Keyword.fg`  | `Normal.bg` |
| `Type.fg`     | `Normal.bg` |
| `Number.fg`   | `Normal.bg` |
| `Special.fg`  | `Normal.bg` |

### 派生色チェック

| fg                | bg              | 備考                                         |
| ----------------- | --------------- | -------------------------------------------- |
| `CursorLineNr.fg` | `CursorLine.bg` | カーソル行番号は CursorLine 背景に対して判定 |
| `PmenuSel.fg`     | `PmenuSel.bg`   | 補完候補選択時の可読性                       |

### チェック不要

`CursorLine`, `Visual`, `Pmenu` は背景色のみであり fg を持たないため対象外。

---

## L 値調整アルゴリズム（二分探索）

OKLch の L 値（0〜1）は輝度と単調な関係にあるため、**二分探索**で最小の L 変更量を効率的に発見できる。

### 調整方向の決定

```
if wcagLuminance(fg) >= wcagLuminance(bg):
  // fg が bg より明るい → L を上げると差が開く
  方向 = UP（ダークテーマの fg は通常こちら）
else:
  // fg が bg より暗い → L を下げると差が開く
  方向 = DOWN（ライトテーマの fg は通常こちら）
```

ライトテーマでは fg が暗い色になるため方向が逆になる。輝度比較で自動判断するため、dark/light で分岐を書く必要はない。

### 二分探索の実装

```typescript
import { wcagContrast, wcagLuminance, oklch, formatHex } from "culori";

const adjustToContrast = (
  fg: string,
  bg: string,
  minRatio: number,
): { color: string; achieved: number } => {
  // すでに基準を満たしていれば調整不要
  const current = wcagContrast(fg, bg);
  if (current >= minRatio) return { color: fg, achieved: current };

  const base = oklch(fg);
  if (!base) return { color: fg, achieved: current };

  // fg と bg の輝度を比較して調整方向を決定
  const shouldGoLighter = wcagLuminance(fg) >= wcagLuminance(bg);

  let lo = shouldGoLighter ? base.l : 0;
  let hi = shouldGoLighter ? 1 : base.l;
  let bestL = shouldGoLighter ? 1 : 0;

  const TOLERANCE = 0.001;
  const MAX_ITER = 50;

  for (let i = 0; i < MAX_ITER && hi - lo > TOLERANCE; i++) {
    const mid = (lo + hi) / 2;
    const candidate = formatHex({ ...base, l: mid });
    if (!candidate) break;
    const ratio = wcagContrast(candidate, bg);

    if (ratio >= minRatio) {
      bestL = mid;
      // より元の色に近い（変化が小さい）方向へ絞り込む
      if (shouldGoLighter) hi = mid;
      else lo = mid;
    } else {
      if (shouldGoLighter) lo = mid;
      else hi = mid;
    }
  }

  const result = formatHex({ ...base, l: bestL }) ?? fg;
  return { color: result, achieved: wcagContrast(result, bg) };
};
```

### 制約と警告

- L の調整範囲は `[0, 1]` にクランプ（`formatHex` が自動で処理）
- 調整後も `minRatio` を達成できない場合（例: bg が中間グレー付近で fg をどちらに振っても届かない）は `ContrastWarning` に記録し、達成できた最大コントラスト値を使用する
- Hue と Chroma は一切変更しない

---

## before/after 状態の保持

R5 エディタが「調整前後の比較表示」に使用するため、呼び出し元が元の `ThemeVariants` を保持する設計とする。`adjustContrast()` は **新しいオブジェクト**を返し、引数を破壊しない（immutable）。

```typescript
// R5 での使い方イメージ
const raw = mapColorsToTheme(palette); // R2 出力
const { adjusted, warnings } = adjustContrast(raw, { minRatio: 4.5 }); // R3 出力

// raw   → 調整前のキャラクター色（before 表示に使用）
// adjusted → WCAG 準拠済みテーマ（実際にエクスポートする）
// warnings → コントラスト不足が残っている色の一覧
```

---

## 依存パッケージ

| パッケージ | 使用する関数    | 用途                               |
| ---------- | --------------- | ---------------------------------- |
| `culori`   | `wcagLuminance` | 相対輝度の計算                     |
| `culori`   | `wcagContrast`  | コントラスト比の計算と検証         |
| `culori`   | `oklch`         | HEX → OKLch 変換（L 値取得）       |
| `culori`   | `formatHex`     | OKLch → HEX 変換（調整後の色出力） |

**新規パッケージ追加なし。**

---

## ファイル構成

```
src/features/theme-generator/
  ├── types.ts               # ContrastOptions, ContrastResult, ContrastWarning を追記
  └── contrast-adjuster.ts   # メイン: ThemeVariants → ContrastResult
```

### `contrast-adjuster.ts` の公開インターフェース

```typescript
/**
 * ThemeVariants の各 fg 色に対して WCAG コントラスト比を検証・調整する。
 * 調整は OKLch L 値（明度）のみ行い、Hue と Chroma は保持する。
 *
 * @param variants - R2 が生成した ThemeVariants（dark/light 両方）
 * @param options - 調整設定（minRatio デフォルト 4.5）
 * @returns 調整済み ThemeVariants と、調整できなかった色の警告リスト
 */
export const adjustContrast = (
  variants: ThemeVariants,
  options?: ContrastOptions,
): ContrastResult => { ... };
```

---

## 検証方法

- **ユニットテスト**: コントラスト比が不足する色ペアを入力し、調整後に `minRatio` 以上になることを確認
- **警告テスト**: 達成不可能なケース（例: bg=`#808080`、fg=`#808080`）で `warnings` に記録されることを確認
- **不変性テスト**: 入力の `ThemeVariants` が破壊されないことを確認（`adjusted !== variants`）
- **E2E**: R2 → R3 のパイプラインを通した出力を R5 プレビューで目視確認
