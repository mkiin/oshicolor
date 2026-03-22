# R2/V10 neutral 源精査 + seed ロールスコアリング + Vibrant 系アクセント導入

## なぜ V10 が必要か

V9 で dominant 5色 → 66 ハイライトグループの基盤を構築したが、以下の構造的問題が判明した（[V9/issues.md](../V9/issues.md)）:

1. **seed にロールの概念がない（#3）** — d1 を無条件に neutral 源にしているが、d1 が鮮やかな色の場合は neutral に不向き。5色から neutral にふさわしい色を精査していない
2. **個性が出ない（#4）** — population 順にフラット割り当てしており、どの色が keyword に向いているか、storage に向いているかの判断がない
3. **要所にアクセント色がない（#5）** — dominant 5色は面積が大きい = 彩度が低い傾向。swatch Vibrant 系（V/DkV/LtV）にはキャラの個性色があるが拾えていない
4. **全体的に渋い + コントラスト不足（#1, #2）** — fg-adjuster が L のみ調整し C をそのまま使うため、くすんだ seed はくすんだ fg になる

## 前版との変更対照表

| 項目 | V9 | V10 |
| ---- | ---- | ------ |
| neutral 源 | d1（population 最大）固定 | swatch Muted 系（DkMuted → Muted）の hue を使用。null 時は dominant C 最低で代用 |
| seed → ロール割り当て | population 順にフラット | スコアリングで適性判定 |
| syntax fg の色源 | dominant 5色のみ | dominant + swatch Vibrant 系（V/DkV/LtV） |
| fg-adjuster | L のみ調整 | L + C 下限（MIN_CHROMA）で彩度底上げ |

## 設計方針

### 1. neutral 源の精査

swatch の Muted 系から neutral palette の hue 源を選定する。colorthief が「控えめな色」と判定した色を使うことで、dominant の C 最低を探すより信頼性が高い。

```
画像 → getSwatches(colorCount: 16) → swatch 6スロット

neutral hue の選定:
  1. DkMuted が non-null → DkMuted.hue（暗い + 控えめ = bg に最適）
  2. DkMuted が null、Muted が non-null → Muted.hue
  3. 両方 null → dominant 5色から C 最低の色の hue（フォールバック）
```

DkMuted が最優先な理由:
- targetL=0.30 で暗い → dark theme の bg (L=0.22) に近い色相を持つ
- targetC=0.04 で低彩度 → neutral に適している
- minC=0.00 なのでグレーでも通過する（null になりにくい）

neutral palette の生成自体は V9 と同じ。hue だけ借りて L と C は固定:

```
neutral[段階] = OkLch(L=段階値, C=0.02, H=選定された hue)
```

### 2. seed ロールスコアリング

残り4色 + Vibrant 系から、各ロールに適した色を選定する。

| ロール | 適性基準 | 用途 |
| --- | --- | --- |
| statement | C が高い + neutral と hue 差が大きい | keyword / conditional / loop（最も目立つべき） |
| storage | statement と hue が異なる | constant / number / string |
| 残り | hue の多様性を最大化するように配置 | function / type / operator 等 |

### 3. Vibrant 系アクセントの導入

swatch Vibrant 系（V / DkV / LtV）から null でないものを収集し、keyword 等の要所に配置する。

```
画像
 ├→ getPalette(colorCount: 5)   → dominant 5色
 └→ getSwatches(colorCount: 16) → swatch 6スロット

Vibrant 候補 = [V, DkV, LtV] のうち null でないもの
  → statement ロールに最も C が高い Vibrant を割り当て
  → dominant の残り4色は storage / func / type 等に配置
```

Vibrant 系が 0色（全 null）の場合は dominant から C 順で代用する。

### 4. fg-adjuster の改善

L 調整に加えて C の下限を設ける:

```
L = clamp(seed.l, 0.65, 0.85)
C = max(seed.c, MIN_CHROMA)  // 例: 0.08
```

## 未決定事項

- MIN_CHROMA の値（0.06 / 0.08 / 0.10 — 実色を見て判断）
- Vibrant 系が複数ある場合の配置優先度（C 順？swatch role 順？）
- dominant 4色のロールスコアリングの具体的なアルゴリズム（hue 差 + C のバランス）
- nvim-highlite 的なフォールバックチェーン構造を導入するか（statement → keyword / conditional 等を同色派生にするか）

## 実装タスク

1. neutral 源選定ロジック（DkMuted → Muted → dominant C 最小のフォールバック）
2. swatch Vibrant 系の収集
3. seed ロールスコアリング（neutral 以外の色 + Vibrant 系 → statement / storage 等に割り当て）
4. fg-adjuster に MIN_CHROMA 追加
5. build-highlight-map の更新（新しい seed 構成に対応）
6. デバッグ SVG で新旧比較
