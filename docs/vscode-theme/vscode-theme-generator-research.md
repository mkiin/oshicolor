# vscode-theme-generator 調査レポート

> 調査対象: `sample-repo/vscode-theme-generator/`
> 調査日: 2026-02-22

---

## 概要

`vscode-theme-generator` は、**6色のベースカラーを入力するだけで VS Code テーマ JSON を自動生成する**ライブラリ。
"New themes are typically forked from other themes, carrying the bugs with them" という問題意識のもと、ゼロから書きやすい設計を目指している。

---

## アーキテクチャ

```
IColorSet（入力）
  ├── base         … 必須。background / foreground / color1-4
  ├── syntax       … 任意。各トークンへの直接指定
  ├── ui           … 任意。カーソル・選択・ハイライト等
  ├── terminal     … 任意。ANSI 16色
  └── overrides    … 任意。任意の VS Code color key を直接上書き

generateTheme(name, colorSet, outputFile)
  └── VscodeThemeGenerator.generateTheme()
        ├── generateFallbackColorSet()  … base colors からデフォルト syntax を導出
        ├── tokenRules[]                … TextMate scope → color のマッピング
        ├── globalRules[]               … background / foreground のグローバル設定
        └── _applyWorkbenchColors()     … UIパーツ全体への色適用
              └── JSON.stringify() → theme.json 出力
```

---

## カラースキーム生成の仕組み

### Step 1: ベースカラーの定義（必須）

ユーザーが渡すのは **6色のみ**。

| キー | 役割 |
|---|---|
| `background` | エディタ背景 |
| `foreground` | デフォルト前景（通常テキスト） |
| `color1` | アクセント色1（blue系推奨）。フォーカスボーダー・バッジ・ボタンに使われる "ブランドカラー" |
| `color2` | アクセント色2（red系推奨） |
| `color3` | アクセント色3（green系推奨） |
| `color4` | アクセント色4（yellow系推奨） |

### Step 2: フォールバック syntax カラーの自動導出

`syntax` を省略した場合、`generateFallbackColorSet()` が以下のルールで自動マッピングする。

| syntax トークン | フォールバック元 |
|---|---|
| `boolean`, `keyword`, `storage`, `cssClass` | `color1` |
| `string`, `cssId` | `color2` |
| `stringEscape` | `color2` を lighten/darken 50% |
| `function`, `class`, `classMember`, `type`, `cssTag` | `color3` |
| `functionCall`, `number` | `color4` |
| `identifier` | `color1` を lighten/darken 50% |
| `comment` | `background` を lighten/darken 200% |
| `modifier`, `markdownQuote` | null（未設定） |

lighten/darken の方向は `type: 'light' | 'dark'` で決まる。

### Step 3: TextMate トークンルールへの展開（`tokenRules`）

`rules.ts` に定義された約40件のルールが、syntax カラーを TextMate scope に紐付ける。

```
syntax.string       → "string"
syntax.keyword      → "keyword, modifier, variable.language.this, ..."
syntax.functionCall → "entity.name.function, support.function"
syntax.type         → "support.type", "entity.name.type, ..."
syntax.comment      → "comment"  (italic)
syntax.class        → "entity.name.type.class"  (underline)
...
```

各ルールは `{ color: ColorFetcher, generate: ColorGenerator }` のペア。
`colorSet` に値があればそれを使い、なければ `fallbackColorSet` から取る。

### Step 4: Workbench カラーの自動展開（`_applyWorkbenchColors`）

`background` を起点に 5段階のトーンを自動生成し、UI パーツに割り当てる。

```
background1 = background を darken 20%  → peekViewEditor, statusBar, titleBar
background2 = background そのまま       → editor.background
background3 = background を lighten 20% → sideBar, editorWidget, panel
background4 = background を lighten 40% → activityBar, dropdown, tab.inactive
background5 = background を lighten 60% → input, dropdown
```

`color1` は以下にも使われる:
- `focusBorder`, `button.background`, `activityBarBadge.background`
- `tab.activeBorder`, `list.highlightForeground`, `peekView.border`
- ブラケットカラーリング (`editorBracketHighlight.foreground1`)

コントラスト自動計算: `contrast()` 関数が輝度 192 を閾値に `#000000` / `#ffffff` を選ぶ。

```
luminance = R × 0.299 + G × 0.587 + B × 0.114
luminance > 192 → 黒テキスト / それ以外 → 白テキスト
```

---

## color.ts のユーティリティ

| 関数 | 処理 |
|---|---|
| `lighten(color, amount)` | 各チャンネルに `amount` 倍を加算（RGB空間での操作） |
| `darken(color, amount)` | `lighten(color, -amount)` のエイリアス |
| `addAlpha(color, alpha)` | `#rrggbb` に `aa` を付加して `#rrggbbaa` へ |
| `contrast(color)` | 輝度計算で黒 or 白を返す |

**注意点**: lighten/darken は RGB チャンネルを直接操作するため、知覚的な均一性はない。
oshicolor では OKLab / OKLch を使っており、より知覚均一な操作が可能。

---

## 出力フォーマット

```json
{
  "name": "テーマ名",
  "tokenColors": [
    {
      "name": "Global settings",
      "settings": { "background": "#...", "foreground": "#..." }
    },
    {
      "name": "String",
      "scope": "string",
      "settings": { "foreground": "#..." }
    }
    // ... 約40件
  ],
  "colors": {
    "editor.background": "#...",
    "editor.foreground": "#...",
    // ... 約50件の workbench color key
  }
}
```

---

## oshicolor との比較・差分

| 観点 | vscode-theme-generator | oshicolor（現状） |
|---|---|---|
| 入力 | 6色（手動指定） | イラストから自動抽出 |
| 色空間 | RGB（lighten/darken） | OKLch（知覚均一） |
| トークンマッピング | color1〜4 → 固定ルール | Zone A/B 方式（抽出色→役割） |
| ターゲット | VS Code | Neovim |
| ライト/ダーク | `type` で切り替え | concept（darkClassic / lightPastel） |
| カスタム性 | `overrides` で任意key上書き | 現状なし |
| 出力 | `theme.json`（ファイル書き出し） | Lua スクリプト（想定） |

---

## oshicolor への応用ポイント

1. **4色役割モデルの参考**: color1（ブランド） / color2（string系） / color3（function/type系） / color4（number系）という役割分担は、現在の Zone B ターゲット（String→緑、Type→水色、Number→黄金）と対応しており整合性がある。

2. **フォールバック連鎖の設計**: `syntax` が未指定でも `base` から自動導出するフォールバック方式は、oshicolor のパレット抽出失敗時の対策として参考になる。

3. **`contrast()` の活用**: バッジ・ボタンの前景色を自動決定する仕組みは、生成した Neovim テーマのステータスライン等にも応用できる。

4. **`lighten/darken` の限界**: RGB 空間での操作は知覚的に不均一になる。oshicolor が OKLch を採用していることは正しい判断。
