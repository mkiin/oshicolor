# R2/V9 ドミナント5色 seed + ハイライトグループ割り当て

## なぜ V9 が必要か

V5〜V8 で K-means 3軸 → 各軸 Vibrant+Muted のパイプラインを構築してきたが、以下の問題が判明した（[V8/issues.md](../V8/issues.md)）:

1. **軸ベース seed 選定が不必要に複雑** — ドミナント5色がそもそもキャラ特徴を捉えている
2. **上位5色にない特徴色が seed に入らない** — population に潰される問題（V10 以降で対処）
3. **単調な seed 構成** — 同系色が多いキャラで seeds が似通う（V10 以降で対処）

V9 では軸ベースを廃止し、最速でリリース可能な構成を目指す:
- colorthief `getPalette(colorCount: 5)` のドミナント5色をそのまま seed にする
- 5 seed → Neovim ハイライトグループへの割り当てを定義・実装する

くすみ問題（Vibrant 系による彩度補完）は実際の配色結果を見た上で V10 で設計する。

## 前版との変更対照表

| 項目 | V8 | V9 |
| ---- | ---- | ------ |
| seed 選定 | 3軸 × Vibrant+Muted スコアリング（6 seeds） | ドミナント5色そのまま（5 seeds） |
| 依存 | K-means (ml-kmeans) + OkLch スコアリング | colorthief `getPalette` のみ |
| color-axes.ts | 使用 | 不要（削除候補） |
| ハイライト割り当て | 未実装 | 本バージョンで実装 |

## 設計方針

### seed 構成

```
画像 → getPalette(colorCount: 5) → [d1, d2, d3, d4, d5]
                                     population 順（d1 が最多）
```

5色に以下のロールを割り当てる:

| ロール | seed | 用途 |
| --- | --- | --- |
| primary | d1 | neutral palette の hue 源 + 主要 UI |
| secondary | d2 | 副 syntax fg |
| tertiary | d3 | syntax fg |
| quaternary | d4 | syntax fg |
| quinary | d5 | syntax fg / アクセント |

**ロール割り当てロジック**: population 順をそのまま使う。d1 が最も面積が大きい = キャラの「地の色」であり、neutral の hue として最適。d2〜d5 は syntax fg に使う。

### neutral palette

d1 の hue を借り、chroma を極小にして lightness の段階で bg/surface/テキストを生成:

```
neutral[段階] = OkLch(L=段階値, C=0.02〜0.04, H=d1.hue)
```

| 変数名 | OkLch L | 用途 |
| --- | --- | --- |
| `neutral.popup` | 0.20 | Pmenu.bg |
| `neutral.bg` | 0.22 | Normal.bg |
| `neutral.surface` | 0.24 | StatusLine.bg |
| `neutral.cursorline` | 0.28 | CursorLine.bg |
| `neutral.visual` | 0.34 | Visual.bg |
| `neutral.dim` | 0.42 | LineNr.fg |
| `neutral.border` | 0.50 | WinSeparator |
| `neutral.comment` | 0.58 | Comment.fg |
| `neutral.fg` | 0.88 | Normal.fg |

### syntax fg の lightness 決定

seed の hue/chroma を保ちながら、bg（neutral.bg = L:0.22）とのコントラストが取れる L に調整する。

### diagnostic 色

固定 hue、全体の tone に合わせて L/C 調整:

```
diag.error = OkLch(L=d1.l, C=d1.c * 0.8, H=25)   赤
diag.warn  = OkLch(L=d1.l, C=d1.c * 0.8, H=85)   黄橙
diag.info  = OkLch(L=d1.l, C=d1.c * 0.8, H=250)  青
diag.hint  = OkLch(L=d1.l, C=d1.c * 0.8, H=165)  シアン
```

## ハイライトグループ（66 グループ）

### Editor UI（26 グループ）

| グループ | fg | bg | 装飾 | 色源 |
| --- | --- | --- | --- | --- |
| Normal | neutral.fg | neutral.bg | — | neutral |
| NormalFloat | neutral.fg | neutral.surface | — | neutral |
| FloatBorder | d2 | — | — | secondary |
| CursorLine | — | neutral.cursorline | — | neutral |
| CursorLineNr | d1 | — | bold | primary |
| LineNr | neutral.dim | — | — | neutral |
| Visual | — | neutral.visual | — | neutral |
| Search | d1(fg) | d2(bg, 低opacity) | — | primary+secondary |
| IncSearch | neutral.bg | d1 | — | primary |
| CurSearch | neutral.bg | d1 | bold | primary |
| MatchParen | — | neutral.visual | bold | neutral |
| Pmenu | neutral.fg | neutral.surface | — | neutral |
| PmenuSel | — | d2(bg, 低opacity) | — | secondary |
| PmenuSbar | — | neutral.surface | — | neutral |
| PmenuThumb | — | neutral.dim | — | neutral |
| StatusLine | neutral.fg | neutral.surface | — | neutral |
| StatusLineNC | neutral.dim | neutral.bg | — | neutral |
| TabLine | neutral.dim | neutral.surface | — | neutral |
| TabLineSel | d1 | neutral.surface | bold | primary |
| TabLineFill | — | neutral.bg | — | neutral |
| WinSeparator | neutral.border | — | — | neutral |
| Folded | neutral.dim | neutral.surface | — | neutral |
| FoldColumn | neutral.dim | — | — | neutral |
| SignColumn | — | neutral.bg | — | neutral |
| NonText | neutral.border | — | — | neutral |
| Title | d1 | — | bold | primary |

### Syntax 基本（20 グループ）

| グループ | fg | 装飾 | 色源 |
| --- | --- | --- | --- |
| Comment | neutral.comment | italic | neutral |
| Keyword | d2 | — | secondary |
| Statement | d2 | — | secondary |
| Conditional | d2 | — | secondary |
| Repeat | d2 | — | secondary |
| Function | d3 | — | tertiary |
| Operator | d4 | — | quaternary |
| String | d3 | — | tertiary |
| Character | d3 | — | tertiary |
| Type | d4 | — | quaternary |
| Number | d5 | — | quinary |
| Boolean | d5 | — | quinary |
| Float | d5 | — | quinary |
| Constant | d5 | — | quinary |
| Special | d5 | — | quinary |
| Delimiter | neutral.dim | — | neutral |
| Identifier | neutral.fg | — | neutral |
| PreProc | d2 | — | secondary |
| Include | d2 | — | secondary |
| Todo | d5 | bold | quinary |

### Diagnostic（16 グループ）

旧 V9 と同じ。固定 hue + d1 の tone に合わせて L/C 調整。

### Diff（4 グループ）

旧 V9 と同じ。diagnostic 色の低 chroma 版。

## 未決定事項

- neutral の chroma 値（0.02 vs 0.04 — 実色を見て判断）
- syntax fg の L 値計算方法（seed の L をそのまま使うか、bg とのコントラスト比で計算するか）
- d1 が極端にくすんでいる場合の diagnostic 色の品質（d1.c が低すぎると diagnostic 色もくすむ）
- Treesitter (@*) グループの追加（Phase 2）
- ライトテーマ対応

## 実装タスク

1. seed 選定の簡素化（`getPalette(colorCount: 5)` → 5 seeds）
2. neutral palette 生成関数
3. seed → fg 色変換関数（L 調整）
4. diagnostic 色生成関数
5. 66 グループのハイライトマッピング定義
6. デバッグ SVG にハイライトプレビューを追加
7. `src/features/` への移植
