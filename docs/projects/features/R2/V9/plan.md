# R2/V9 ハイライトグループ割り当て

## なぜ V9 が必要か

V5〜V8 で seed 選定ロジックを確立した（colorthief 準拠 OkLch Vibrant + Muted）。V9 では seed から実際の Neovim ハイライトグループへの色割り当てを実装する。

## 入力

```
6 seeds:
  main-V     鮮やかなメインカラー
  main-M     控えめなメインカラー
  sub-V      鮮やかなサブカラー
  sub-M      控えめなサブカラー
  accent-V   鮮やかなアクセント
  accent-M   控えめなアクセント
```

## 設計方針

### 色源の分担

| 色源 | 用途 | 生成方法 |
| --- | --- | --- |
| neutral | bg / surface / テキスト | main-V.hue + 極小 chroma + L 段階 |
| main-V | 主要 syntax fg | seed の hue/chroma 保持、L を調整 |
| sub-V | 副 syntax fg | 同上 |
| accent-V | アクセント syntax fg | 同上 |
| main-M | UI アクセント | seed の hue/chroma 保持、L を調整 |
| sub-M | UI 控えめ要素 | 同上 |
| accent-M | UI 補助 | 同上 |
| diagnostic | Error/Warn/Info/Hint | 固定 hue、全体の tone に合わせて L/C 調整 |

### fg の lightness 決定

seed の hue/chroma を保ちながら、bg（neutral の最暗色）とのコントラストが取れる lightness に設定する。

### neutral palette

main-V の hue を借り、chroma を極小（0.02〜0.04）にして lightness の段階で bg/surface/テキストを生成:

```
OkLch(L=段階値, C=0.02〜0.04, H=main-V.hue)
```

## ハイライトグループ（初期スコープ: 70 グループ）

xeno.nvim / mini.hues / catppuccin / tokyonight の共通グループから厳選。

### Editor UI（26 グループ）

| グループ | fg | bg | 装飾 | 説明 |
| --- | --- | --- | --- | --- |
| Normal | neutral.fg | neutral.bg | — | 通常テキスト + 背景 |
| NormalFloat | neutral.fg | neutral.surface | — | フローティングウィンドウ |
| FloatBorder | sub-M | — | — | フローティングボーダー |
| CursorLine | — | neutral.cursorline | — | カーソル行背景 |
| CursorLineNr | main-V | — | bold | カーソル行番号 |
| LineNr | neutral.dim | — | — | 行番号 |
| Visual | — | neutral.visual | — | 選択範囲 |
| Search | main-V.fg | main-M | — | 検索ハイライト |
| IncSearch | neutral.bg | main-V | — | インクリメンタル検索 |
| CurSearch | neutral.bg | main-V | bold | 現在の検索マッチ |
| MatchParen | — | neutral.visual | bold | 括弧マッチ |
| Pmenu | neutral.fg | neutral.surface | — | ポップアップメニュー |
| PmenuSel | — | main-M | — | ポップアップ選択行 |
| PmenuSbar | — | neutral.surface | — | ポップアップスクロールバー |
| PmenuThumb | — | neutral.dim | — | ポップアップスクロール位置 |
| StatusLine | neutral.fg | neutral.surface | — | ステータスライン |
| StatusLineNC | neutral.dim | neutral.bg | — | 非アクティブステータスライン |
| TabLine | neutral.dim | neutral.surface | — | タブライン |
| TabLineSel | main-V | neutral.surface | bold | 選択タブ |
| TabLineFill | — | neutral.bg | — | タブライン余白 |
| WinSeparator | neutral.border | — | — | ウィンドウ分割線 |
| Folded | neutral.dim | neutral.surface | — | 折り畳み行 |
| FoldColumn | neutral.dim | — | — | 折り畳みカラム |
| SignColumn | — | neutral.bg | — | サインカラム |
| NonText | neutral.border | — | — | 非テキスト文字 |
| Title | main-V | — | bold | タイトル |

### Syntax 基本（20 グループ）

| グループ | fg | 装飾 | 色源 |
| --- | --- | --- | --- |
| Comment | neutral.comment | italic | neutral |
| Keyword | main-V | — | main |
| Statement | main-V | — | main |
| Conditional | main-V | — | main |
| Repeat | main-V | — | main |
| Function | main-V | — | main |
| Operator | main-M | — | main |
| String | sub-V | — | sub |
| Character | sub-V | — | sub |
| Type | sub-V | — | sub |
| Number | accent-V | — | accent |
| Boolean | accent-V | — | accent |
| Float | accent-V | — | accent |
| Constant | accent-V | — | accent |
| Special | accent-V | — | accent |
| Delimiter | neutral.dim | — | neutral |
| Identifier | neutral.fg | — | neutral |
| PreProc | main-V | — | main |
| Include | main-V | — | main |
| Todo | accent-V | bold | accent |

### Diagnostic（16 グループ）

| グループ | fg | bg | 装飾 | 説明 |
| --- | --- | --- | --- | --- |
| DiagnosticError | diag.error | — | — | エラー |
| DiagnosticWarn | diag.warn | — | — | 警告 |
| DiagnosticInfo | diag.info | — | — | 情報 |
| DiagnosticHint | diag.hint | — | — | ヒント |
| DiagnosticVirtualTextError | diag.error | — | — | 仮想テキスト |
| DiagnosticVirtualTextWarn | diag.warn | — | — | 仮想テキスト |
| DiagnosticVirtualTextInfo | diag.info | — | — | 仮想テキスト |
| DiagnosticVirtualTextHint | diag.hint | — | — | 仮想テキスト |
| DiagnosticUnderlineError | — | — | undercurl | 下線 |
| DiagnosticUnderlineWarn | — | — | undercurl | 下線 |
| DiagnosticUnderlineInfo | — | — | undercurl | 下線 |
| DiagnosticUnderlineHint | — | — | undercurl | 下線 |
| DiagnosticSignError | diag.error | — | — | サイン |
| DiagnosticSignWarn | diag.warn | — | — | サイン |
| DiagnosticSignInfo | diag.info | — | — | サイン |
| DiagnosticSignHint | diag.hint | — | — | サイン |

### Diff（4 グループ）

| グループ | bg | 説明 |
| --- | --- | --- |
| DiffAdd | diag.hint (低 chroma) | 追加行 |
| DiffChange | diag.info (低 chroma) | 変更行 |
| DiffDelete | diag.error (低 chroma) | 削除行 |
| DiffText | diag.info | 変更テキスト |

### Diagnostic 色の生成

固定 hue だが、全体の tone（main-V の lightness/chroma）に合わせて調整:

```
diag.error = OkLch(L=main-V.l, C=main-V.c * 0.8, H=25)   赤
diag.warn  = OkLch(L=main-V.l, C=main-V.c * 0.8, H=85)   黄橙
diag.info  = OkLch(L=main-V.l, C=main-V.c * 0.8, H=250)  青
diag.hint  = OkLch(L=main-V.l, C=main-V.c * 0.8, H=165)  シアン
```

**合計: 66 グループ**

## Neutral Palette 設計

### L 段階値

tokyonight / catppuccin / rose-pine の実測平均から導出:

| 変数名 | OkLch L | 用途 | 参照テーマ平均 |
| --- | --- | --- | --- |
| `neutral.popup` | 0.20 | Pmenu.bg（最暗） | 0.23 |
| `neutral.bg` | 0.22 | Normal.bg | 0.24 |
| `neutral.surface` | 0.24 | StatusLine.bg | 0.24 |
| `neutral.cursorline` | 0.28 | CursorLine.bg | 0.30 |
| `neutral.visual` | 0.34 | Visual.bg | — |
| `neutral.dim` | 0.42 | LineNr.fg | 0.44 |
| `neutral.border` | 0.50 | WinSeparator / NonText | 0.52 |
| `neutral.comment` | 0.58 | Comment.fg | 0.61 |
| `neutral.fg` | 0.88 | Normal.fg | 0.88 |

### 生成方法

全て同一の hue / chroma で lightness のみ変える:

```
neutral[段階] = OkLch(L=段階値, C=0.02〜0.04, H=main-V.hue)
```

main-V の hue を借りることで、背景にキャラクターの色味がほんのり乗る。

## 未決定事項

- neutral の chroma 値（0.02 vs 0.04 — 実色を見て判断）
- syntax fg の L 値（seed の L をそのまま使うか、bg とのコントラスト比で計算するか）
- Treesitter (@*) グループの追加（第2段階）
- ライトテーマ対応

## 実装タスク

1. neutral palette 生成関数（OkLch → hex 変換）
2. seed → fg 色変換関数（L 調整）
3. diagnostic 色生成関数（固定 hue + tone 合わせ）
4. ハイライトグループマッピング定義（66 グループ）
5. デバッグ SVG にハイライトプレビューを追加
