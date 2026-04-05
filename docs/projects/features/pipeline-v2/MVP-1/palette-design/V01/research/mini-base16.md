# mini.base16 解析レポート

## 1. Base00〜Base0F の 16 色の意味・役割

### bg 系 (Base00-03): 背景のグラデーション

背景色の色相・彩度を維持しつつ、明度だけを段階的に上げる。

| 色     | 役割               | 明度の位置                   |
| ------ | ------------------ | ---------------------------- |
| Base00 | メイン背景         | bg そのまま                  |
| Base01 | UI サーフェス背景  | bg → focus の 1/3            |
| Base02 | 選択・アクティブ面 | bg → focus の 2/3            |
| Base03 | コメント・薄い文字 | bg → focus の 3/3 (= focus)  |

### fg 系 (Base04-07): 前景のグラデーション

前景色の色相・彩度を維持しつつ、明度を展開する。

| 色     | 役割                 | 明度の位置                      |
| ------ | -------------------- | ------------------------------- |
| Base04 | 暗めの前景（補助）   | fg - 1step（fg と focus の中間） |
| Base05 | メイン前景           | fg そのまま                     |
| Base06 | 明るめの前景         | fg → edge の 1/2               |
| Base07 | 最も明るい前景・極端 | fg → edge の 2/2 (≈ edge)      |

### accent 系 (Base08-0F): シンタックスカラー

4 つの色相ペアで構成。ペア内に **base 明度 (= fg.l)** と **alt 明度 (= focus_l)** がある。

| 色     | 色相ペア | 明度  | 主な用途                                      |
| ------ | -------- | ----- | --------------------------------------------- |
| Base08 | Hue 1    | base  | 変数、エラー、削除、例外                      |
| Base09 | Hue 1    | alt   | 定数、Boolean、数値、検索ハイライト           |
| Base0A | Hue 2    | alt   | 型、ラベル、検索マッチ                        |
| Base0B | Hue 2    | base  | 文字列、追加(diff)、成功                      |
| Base0C | Hue 4    | alt   | 特殊文字、情報(diagnostic)、折りたたみ        |
| Base0D | Hue 3    | base  | 関数、ヒント(diagnostic)、タイトル            |
| Base0E | Hue 4    | base  | キーワード、警告(diagnostic)、変更(diff)      |
| Base0F | Hue 3    | alt   | デリミタ、特殊(SpecialChar)、インデントスコープ |

> **設計意図**: Base0D (関数) と Base0F (デリミタ/括弧) が同じ色相ペア。
> 「コード上で隣り合う要素を同系色にする」という方針。

---

## 2. ハイライトグループ → Base16 色 マッピングテーブル

### 2.1 コアエディタ UI

| ハイライトグループ | fg     | bg     | attr          |
| ------------------ | ------ | ------ | ------------- |
| Normal             | Base05 | Base00 |               |
| NormalNC           | Base05 | Base00 |               |
| NormalFloat        | Base05 | Base01 |               |
| FloatBorder        | →NormalFloat |  |               |
| WinSeparator       | Base02 | Base02 |               |
| VertSplit          | Base02 | Base02 |               |
| CursorLine         | —      | Base01 |               |
| CursorLineNr       | Base04 | Base01 |               |
| Visual             | —      | Base02 |               |
| LineNr             | Base03 | Base01 |               |
| SignColumn         | Base03 | Base01 |               |
| ColorColumn        | —      | Base01 |               |
| Folded             | Base03 | Base01 |               |
| FoldColumn         | Base0C | Base01 |               |
| EndOfBuffer        | Base03 | —      |               |
| NonText            | Base03 | —      |               |
| MatchParen         | —      | Base02 |               |
| Cursor             | Base00 | Base05 |               |

### 2.2 StatusLine / TabLine / WinBar

| ハイライトグループ | fg     | bg     | attr |
| ------------------ | ------ | ------ | ---- |
| StatusLine         | Base04 | Base02 |      |
| StatusLineNC       | Base03 | Base01 |      |
| TabLine            | Base03 | Base01 |      |
| TabLineFill        | Base03 | Base01 |      |
| TabLineSel         | Base0B | Base01 |      |
| WinBar             | Base04 | Base02 |      |
| WinBarNC           | Base03 | Base01 |      |

**パターン**: アクティブ要素は (Base04, Base02)、非アクティブは (Base03, Base01)。

### 2.3 Pmenu (補完メニュー)

| ハイライトグループ | fg     | bg     | attr    |
| ------------------ | ------ | ------ | ------- |
| Pmenu              | Base05 | Base01 |         |
| PmenuSel           | Base05 | Base01 | reverse |
| PmenuSbar          | —      | Base02 |         |
| PmenuThumb         | —      | Base07 |         |
| PmenuMatch         | Base05 | —      | bold    |

### 2.4 Diagnostic

| ハイライトグループ      | fg     | bg     | sp     |
| ----------------------- | ------ | ------ | ------ |
| DiagnosticError         | Base08 | —      |        |
| DiagnosticWarn          | Base0E | —      |        |
| DiagnosticInfo          | Base0C | —      |        |
| DiagnosticHint          | Base0D | —      |        |
| DiagnosticOk            | Base0B | —      |        |
| DiagnosticFloatingError | Base08 | Base01 |        |
| DiagnosticFloatingWarn  | Base0E | Base01 |        |
| DiagnosticFloatingInfo  | Base0C | Base01 |        |
| DiagnosticFloatingHint  | Base0D | Base01 |        |
| DiagnosticUnderline*    | —      | —      | 各色   |

**マッピング規則**:
- Error = Base08 (赤系 accent)
- Warn = Base0E (キーワード色)
- Info = Base0C (特殊色)
- Hint = Base0D (関数色)
- Ok = Base0B (文字列色/緑系)

### 2.5 Diff / Git

| ハイライトグループ | fg     | bg     |
| ------------------ | ------ | ------ |
| DiffAdd            | Base0B | Base01 |
| DiffChange         | Base0E | Base01 |
| DiffDelete         | Base08 | Base01 |
| DiffText           | Base0D | Base01 |
| Added              | Base0B | —      |
| Changed            | Base0E | —      |
| Removed            | Base08 | —      |

### 2.6 検索 / ハイライト

| ハイライトグループ | fg     | bg     |
| ------------------ | ------ | ------ |
| Search             | Base01 | Base0A |
| IncSearch          | Base01 | Base09 |
| CurSearch          | Base01 | Base09 |
| Substitute         | Base01 | Base0A |

### 2.7 標準シンタックス

| ハイライトグループ | fg     | 意味                         |
| ------------------ | ------ | ---------------------------- |
| Comment            | Base03 | コメント                     |
| String             | Base0B | 文字列                       |
| Number / Float     | Base09 | 数値                         |
| Boolean            | Base09 | 真偽値                       |
| Constant           | Base09 | 定数                         |
| Identifier         | Base08 | 識別子・変数                 |
| Function           | Base0D | 関数名                       |
| Keyword            | Base0E | キーワード                   |
| Conditional        | Base0E | if/else 等                   |
| Statement          | Base08 | 文                           |
| Type               | Base0A | 型名                         |
| Structure          | Base0E | 構造体                       |
| Operator           | Base05 | 演算子（前景色＝目立たせない）|
| Delimiter          | Base0F | 括弧・区切り文字             |
| Special            | Base0C | 特殊                         |
| PreProc            | Base0A | プリプロセッサ               |
| Error              | Base00 on Base08 | エラー（反転）       |

---

## 3. 明度グラデーション設計の分析

### 3.1 bg 系の明度進行

```
Base00 ──── Base01 ──── Base02 ──── Base03
bg.l    bg+(Δ×1)   bg+(Δ×2)   bg+(Δ×3)=focus_l

Δ = (focus_l - bg.l) / 3
focus_l = 0.4 × bg.l + 0.6 × fg.l  ← fg 寄りの加重平均
```

- 等間隔 3 ステップで背景から focus（bg-fg 中間点の fg 寄り）まで進む
- 色相と彩度は bg のものを維持（背景のトーンを壊さない）

### 3.2 fg 系の明度進行

```
Base04 ──── Base05 ──── Base06 ──── Base07
fg-step    fg(=入力)  fg+step    fg+2step(≈edge)

step = (edge_l - fg.l) / 2
edge_l = fg.l > 50 ? 99 : 1  ← 前景の明度方向の極端値
```

- Base05 が入力そのまま = メイン前景
- Base04 は fg から focus 方向に 1step 戻る（暗めの補助テキスト）
- Base06-07 は edge に向かって進む（最も高コントラストの前景）

### 3.3 accent 系の明度

```
base 明度 = fg.l       → Base08, Base0B, Base0D, Base0E (高頻度の構文要素)
alt 明度  = focus_l    → Base09, Base0A, Base0C, Base0F (低頻度/補助要素)
```

- accent は全色同一彩度 (accent_chroma) で統一感を出す
- 高頻度色 (変数/文字列/関数/キーワード) を fg と同じ明度にすることで、
  本文との視覚的重みを合わせている
- 低頻度色を focus 明度にすることで、bg 系 UI との相性を確保

### 3.4 dark テーマの典型的明度配置 (minischeme 例)

```
L: 0 ─────────── 50 ─────────── 100
   ├ Base00(≈10) ─ Base03(≈55) ─ accent alt(≈55)
   │    bg系グラデ     └── focus_l
   │                    accent base(≈80) ─ Base05(≈80)
   │                         └── fg.l
   │                              Base07(≈99) ── edge
```

---

## 4. 「16 色では足りない」ケース

### 4.1 足りているもの

mini.base16 は 16 色で以下を**すべて**カバーしている:
- Normal / Float / StatusLine / TabLine / WinBar / WinSeparator
- Pmenu 系
- Diagnostic 5 段階 (Error/Warn/Info/Hint/Ok)
- Diff (Add/Change/Delete)
- Search / IncSearch
- 標準シンタックス全体
- 30+ プラグイン

### 4.2 足りていないもの・トレードオフ

1. **Diagnostic の色とシンタックスの色が共用**
   - Error = Base08 = Identifier/変数 → エラーと変数が同じ色
   - Warn = Base0E = Keyword → 警告とキーワードが同じ色
   - これは 16 色の根本的な制約。差別化は attr (underline, bold) に頼る

2. **Terminal 16 色 (ANSI) の直接定義がない**
   - mini.base16 は `g:terminal_color_*` を設定していない
   - ターミナル統合が必要なら別途マッピングが必要

3. **Semantic Token の色が限定的**
   - `@lsp.type.variable` と `@lsp.mod.deprecated` の 2 つしか定義がない
   - LSP のリッチなセマンティック情報を活かしきれない

4. **bg 系と fg 系の間にギャップが生じうる**
   - Base03 (focus_l) と Base04 (fg.l - step) の間に明度の空白ができることがある
   - 特に bg-fg のコントラストが大きいテーマで顕著

5. **彩度のバリエーションがない**
   - accent は全色同一彩度。「薄い警告背景」「パステルな情報背景」は作れない
   - DiagnosticSign は fg 色 + Base01 bg の組み合わせで擬似的に対処

### 4.3 oshicolor への示唆

oshicolor が 3 色入力 → Neovim テーマ生成をするにあたって:

- **最低限必要な色数**: bg 4段階 + fg 4段階 + accent 4〜8色 = **12〜16 色**
- **mini.base16 の 16 色で全 UI をカバーできることは実証済み**
- ただし 3 色入力から 16 色を導出するには、mini_palette のような
  **色空間上の自動展開アルゴリズム**が必要
- 現状の UiColors 5 色では StatusLine/TabLine/WinBar の
  active/inactive 区別ができない（Base01 vs Base02 の使い分けが必要）
