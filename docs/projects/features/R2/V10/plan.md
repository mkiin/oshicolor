# R2/V10 neutral 源ユーザー選択 + WCAG コントラスト保証 + ロールベース可変長割り当て

## なぜ V10 が必要か

V9 で dominant 5色 → 66 ハイライトグループの基盤を構築したが、以下の構造的問題が判明した（[V9/issues.md](../V9/issues.md)）:

1. **seed にロールの概念がない（#3）** — d1 を無条件に neutral 源にしているが、d1 が鮮やかな色の場合は neutral に不向き
2. **個性が出ない（#4）** — population 順にフラット割り当てしており、色の意味がない
3. **要所にアクセント色がない（#5）** — dominant 5色は面積大 = 低彩度傾向。swatch Vibrant 系にキャラの個性色があるが拾えていない
4. **全体的に渋い + コントラスト不足（#1, #2）** — fg-adjuster が L のみ調整。WCAG コントラスト比の保証がない
5. **5色タプル固定の限界** — function と string が同色、operator と type が同色になり、syntax の色分けが不十分

## 前版との変更対照表

| 項目 | V9 | V10 |
| ---- | ---- | ------ |
| neutral 源 | d1（population 最大）固定 | swatch Muted 系からユーザーがタブで選択。DkMuted / Muted / LtMuted を切り替え可能 |
| seed → ロール割り当て | population 順に5色タプル固定 | 候補プールからスコアリングで可変長ロール割り当て |
| syntax fg の色源 | dominant 5色のみ | dominant 5 + swatch Vibrant 系（V/DkV/LtV）の候補プール |
| fg コントラスト | 固定 L clamp (0.65〜0.85) | WCAG コントラスト比ベースの動的 L 調整（`ensureContrast`） |
| 色のバリエーション | 1ロール = 1色 | 各ロールから 3トーン展開（fg / dim / bold） |

## 設計方針

### 1. neutral 源のユーザー選択（実装済み）

swatch の Muted 系（DkMuted / Muted / LtMuted）をタブ UI で切り替え可能にする。ユーザーが bg の色味を選ぶことで、自動選定のフォールバックに頼らず好みの雰囲気を出せる。

```
画像 → getSwatches(colorCount: 16) → swatch 6スロット

neutral hue のタブ候補:
  - DkMuted（null でなければ表示）
  - Muted（null でなければ表示）
  - LtMuted（null でなければ表示）

選択された swatch の hue → neutral palette 生成
neutral[段階] = OkLch(L=段階値, C=0.02, H=選択された hue)
```

### 2. WCAG コントラスト保証（実装済み）

固定 L clamp を廃止し、bg hex との実際の WCAG コントラスト比に基づいて L を動的に調整する。

```
ensureContrast(fgHex, bgHex, minRatio)
  → 元の hue/chroma を保持
  → L を元の値から上方向に最小限調整
  → コントラスト比 ≥ minRatio を満たす hex を返す
```

適用対象と閾値:

| 対象 | 閾値 |
| ---- | ---- |
| d1〜d5+ (seed fg 全色) | 4.5:1 (WCAG AA) |
| neutral.fg | 4.5:1 |
| neutral.comment, dim, border | 3:1（補助テキスト） |
| diagnostic 4色 | 4.5:1 |

### 3. 候補プールの構築

dominant 5色と Vibrant 系 swatch を統合し、重複を除外した候補プールを作る。

```
画像
 ├→ getPalette(colorCount: 5)   → dominant 5色
 └→ getSwatches(colorCount: 16) → swatch 6スロット

候補プール = dominant 5色 + [V, DkV, LtV のうち null でないもの]
  → OkLch 色差 ΔE で重複除外（閾値 TBD）
  → 5〜8色の可変長プール
```

Vibrant 系は原色をそのまま使う。`ensureContrast` が hue/chroma を保ったまま L だけ調整するので、鮮やかさを殺さない。

### 4. ロールベース可変長割り当て

5色タプル固定を廃止し、ロール名で引く可変長構造にする。

ロール一覧:

| ロール | 用途 | 選定基準 |
| --- | --- | --- |
| accent | CursorLineNr, Search, Title 等の UI 強調 | neutral と hue 差が最大 + 高 C（Vibrant が最有力） |
| keyword | Keyword, Statement, Conditional, Repeat | accent と hue が異なる + 高 C |
| function | Function | keyword と hue が異なる |
| string | String, Character | function と hue が異なる |
| operator | Operator | 残りから hue 多様性を最大化 |
| type | Type | 同上 |
| number | Number, Boolean, Constant | 同上 |

スコアリングアルゴリズム:

```
1. accent を選ぶ: neutral hue との差 × C でスコアリング → 最高スコアを採用
2. keyword を選ぶ: accent との hue 差 × C → 最高スコアを採用
3. 以降、既選択との hue 分散を最大化しながら順に選ぶ
4. 候補プール < ロール数の場合: 同色にフォールバック（function = keyword 等）
```

### 5. 3トーン展開

各ロールから L の派生で fg / dim / bold の3段階を生成する。

```
role.bold = oklchToHex(L + 0.05, C, H)  // やや明るい
role.fg   = ensureContrast(原色, bg, 4.5)
role.dim  = oklchToHex(L - 0.05, C, H)  // やや暗い（3:1 保証）
```

これにより、同じロールの hue を使いつつ function と string を区別できる。

## 捨てた方針

| 方針 | 理由 |
| ---- | ---- |
| MCU QuantizerCelebi + Score | Hue 分散・高 C 優先で「カラフル」にはなるが、キャラの象徴色を拾えない。目視で却下 |
| MIN_CHROMA による彩度底上げ | Vibrant 系の導入 + WCAG コントラスト保証で不要に。人工的な C 操作は色の忠実度を下げる |
| 理想 Hue テーブル（方向B） | 「keyword は赤橙が理想」のような固定観念。紫系キャラに赤橙がなければ破綻する |
| HCT カラースペースへの移行 | 青の紫シフト問題。OkLch + WCAG コントラスト計算で HCT の利点を取り込める |

## 未決定事項

- 候補プールの重複除外閾値（OkLch ΔE でいくつ以下を重複と見なすか）
- 3トーン展開の L オフセット値（±0.05 は仮値）
- フォールバックチェーンの詳細（function ← keyword? constant ← number?）
- ロールスコアリングの hue 差と C の重み付けバランス

## 実装タスク

1. ~~neutral 源のタブ切り替え UI~~（実装済み）
2. ~~WCAG コントラスト保証（`ensureContrast`）~~（実装済み）
3. 候補プールの構築（dominant + Vibrant 系、重複除外）
4. ロールベース可変長割り当て（スコアリング）
5. 3トーン展開
6. `mapHighlightGroups` のロールベース化
7. デバッグ SVG で新旧比較
