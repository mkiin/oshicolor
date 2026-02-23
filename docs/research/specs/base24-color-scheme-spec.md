# Base24 カラーテーマ仕様 調査メモ

> 調査日: 2026-02-22
> 調査対象: `sample-repo/specs/base24/`
> 参照ファイル: `README.md`, `styling.md`, `builder.md`, `file.md`, `base24schema.json`, `future.md`

---

## 概要

**Base24** は [Base16](https://github.com/chriskempson/base16) の拡張仕様。
Base16 の 16 色に 8 色を追加し、ANSI ターミナルの全 16 色（通常色 8 + 明色 8）に完全対応することが主目的。

- 開発元: [Tinted Theming](https://github.com/tinted-theming)
- バージョン: 0.1.3（styling.md 時点）
- Base16 との後方互換性: **あり**（Base24 スキームは Base16 テンプレートでも動作する）

---

## カラー定義（24 スロット）

### グループ A: 背景・中性色（base00〜base07）

| スロット | ANSI | 用途 |
|---------|------|------|
| `base00` | 0 (Black) | **デフォルト背景色** |
| `base01` | 18 | 明るめ背景（ステータスバー用） |
| `base02` | 19 | 選択領域の背景 |
| `base03` | 8 (Bright Black) | コメント・不可視文字・行ハイライト |
| `base04` | 20 | ダーク前景（ステータスバー用） |
| `base05` | 7 (White) | **デフォルト前景色**・キャレット・演算子 |
| `base06` | 21 | 明るい前景（使用頻度低） |
| `base07` | 15 (Bright White) | 最も明るい前景（使用頻度低） |

### グループ B: アクセントカラー（base08〜base0F）

| スロット | ANSI | 色相 | 用途 |
|---------|------|------|------|
| `base08` | 1 (Red) | 赤 | 変数・XMLタグ・Diff削除行 |
| `base09` | 16 (Orange) | オレンジ | 整数・Boolean・定数・XML属性 |
| `base0A` | 3 (Yellow) | 黄 | クラス・検索ハイライト背景 |
| `base0B` | 2 (Green) | 緑 | 文字列・Diff追加行 |
| `base0C` | 6 (Cyan) | シアン | 正規表現・エスケープ文字 |
| `base0D` | 4 (Blue) | 青 | 関数・メソッド・見出し |
| `base0E` | 5 (Magenta) | 紫 | キーワード・Storage・Markup Italic |
| `base0F` | 17 (Dark Red) | 茶/赤 | Deprecated メソッド・埋め込み言語タグ |

### グループ C: 拡張背景・明色（base10〜base17）← Base24 追加分

| スロット | ANSI | 色相 | 用途 |
|---------|------|------|------|
| `base10` | - | - | **より暗い背景**（base00 より暗い） |
| `base11` | - | - | **最も暗い背景** |
| `base12` | 9 (Bright Red) | 赤（明） | ANSI Bright Red |
| `base13` | 11 (Bright Yellow) | 黄（明） | ANSI Bright Yellow |
| `base14` | 10 (Bright Green) | 緑（明） | ANSI Bright Green |
| `base15` | 14 (Bright Cyan) | シアン（明） | ANSI Bright Cyan |
| `base16` | 12 (Bright Blue) | 青（明） | ANSI Bright Blue |
| `base17` | 13 (Bright Magenta) | 紫（明） | ANSI Bright Magenta |

---

## スキームファイル形式（YAML）

`#` なしの 6 桁 16 進数で色を定義する。

```yaml
scheme: "Scheme Name"
author: "Scheme Author"
base00: "282c34"
base01: "3f4451"
base02: "4f5666"
base03: "545862"
base04: "9196a1"
base05: "abb2bf"
base06: "e6e6e6"
base07: "ffffff"
base08: "e06c75"
base09: "d19a66"
base0A: "e5c07b"
base0B: "98c379"
base0C: "56b6c2"
base0D: "61afef"
base0E: "c678dd"
base0F: "be5046"
base10: "21252b"
base11: "181a1f"
base12: "ff7b86"
base13: "efb074"
base14: "b1e18b"
base15: "63d4e0"
base16: "67cdff"
base17: "e48bff"
```

---

## Base16 フォールバックマッピング

Base16 スキームを Base24 テンプレートで使う場合、拡張スロットは以下の色へフォールバックする。

| Base24 スロット | Base16 フォールバック |
|----------------|----------------------|
| `base10` | `base00` |
| `base11` | `base00` |
| `base12` | `base08`（赤） |
| `base13` | `base0A`（黄） |
| `base14` | `base0B`（緑） |
| `base15` | `base0C`（シアン） |
| `base16` | `base0D`（青） |
| `base17` | `base0E`（紫） |

---

## スタイリング指針

### ダークテーマ

- `base00`〜`base07`: **暗い → 明るい** の順でグラデーション
- `base10`〜`base11`: `base00` よりさらに暗い（2段階の暗背景）

### ライトテーマ

- `base00`〜`base07`: **明るい → 暗い** の順（ダークと逆転）
- `base10`〜`base11`: `base00` よりさらに明るい

### 明色（Bright）の作り方

- `base12`〜`base17` は対応する通常色（`base08`〜`base0E`）より **輝度（Lightness）を高く** する
- 色空間は **OKHSL / OKHSV** の使用を推奨（人間の知覚に線形で優れた均一性）
- 彩度（Saturation）を上げることで強調することも可能（必須ではない）

### 主要な配色ルール

| 状態 | 背景 | 前景 |
|------|------|------|
| 通常テキスト | `base00` | `base05` |
| 現在行 | `base01` | `base05` |
| 選択領域 | `base02` | `base05`/`base06` |
| コメント | `base00` | `base03` |
| エラー | `base00` | `base08` |
| フォーカスタブ | `base0D` | `base00` |
| メニュー通常 | `base00` | `base04` |
| メニュー選択 | `base02` | `base05`/`base06` |
| 検索マッチ | `base00` | `base06` |

---

## ビルダー仕様（Python 実装より）

スキーム YAML を読み込み、Mustache テンプレートへ渡す際に各色を以下の形式へ変換する。

```python
# 生成されるキー（base00 を例に）
"base00-hex"     # "282c34"     (6桁HEX)
"base00-hex-r"   # "28"         (R成分 HEX)
"base00-hex-g"   # "2c"         (G成分 HEX)
"base00-hex-b"   # "34"         (B成分 HEX)
"base00-hex-bgr" # "342c28"     (BGR順 HEX)
"base00-rgb-r"   # "40"         (R成分 10進数 0-255)
"base00-rgb-g"   # "44"         (G成分 10進数 0-255)
"base00-rgb-b"   # "52"         (B成分 10進数 0-255)
"base00-dec-r"   # "0.156..."   (R成分 0.0-1.0)
"base00-dec-g"   # "0.172..."   (G成分 0.0-1.0)
"base00-dec-b"   # "0.203..."   (B成分 0.0-1.0)
```

加えてメタ情報:
```python
"scheme-name"    # スキーム名
"scheme-author"  # 著者名
"scheme-slug"    # ファイルスラッグ（URL等で使える識別子）
```

Base24 拡張スロット（base10〜base17）は、スキームに定義がない場合フォールバック値で自動補完される。

---

## ファイル・ディレクトリ構成

```
base24-builder/
├── sources.yaml              # スキーム/テンプレートのリポジトリ一覧
├── schemes/                  # 各スキームの YAML ファイル
│   └── one-dark.yaml
└── templates/
    └── neovim/               # テンプレートリポジトリ
        ├── config.yaml       # 出力ファイル設定
        └── templates/
            └── default.mustache  # Mustache テンプレート
```

`config.yaml` の構造:

```yaml
default:
  extension: .lua
  output: colors
```

→ `colors/base24-one-dark.lua` のように出力される。

---

## 将来仕様 (future.md より)

`baseXX` 形式の命名を廃止し、セマンティックな名前に移行することを検討中。

```yaml
# 将来の命名案
bg_darkest: "21252b"
bg_dark:    "282c34"
black:      "3f4451"
black_b:    "4f5666"
...
red:        "e06c75"
red_b:      "ff7b86"
green:      "98c379"
green_b:    "b1e18b"
```

**注**: この変更は後方互換性を破壊するため、現在はドラフト段階。

---

## oshicolor への応用メモ

### テーマ生成で必要なデータ

oshicolor のカラー抽出からテーマ生成に至るパイプラインとして:

1. 画像からカラーポイントを抽出
2. 24 スロットへ色をマッピング
   - **背景系（base00, base01, base02, base10, base11）**: 低彩度・低輝度の色を優先
   - **前景系（base03〜base07）**: 背景との十分なコントラスト比を確保
   - **アクセント系（base08〜base0F）**: キャラクターの主要な色相を割り当て
   - **明色系（base12〜base17）**: アクセント色を OKHSL で輝度調整

### Neovim Lua テンプレートでの展開例

```lua
-- {{scheme-name}} by {{scheme-author}}
local colors = {
  bg       = "#{{base00-hex}}",
  bg_light = "#{{base01-hex}}",
  sel      = "#{{base02-hex}}",
  comment  = "#{{base03-hex}}",
  fg_dark  = "#{{base04-hex}}",
  fg       = "#{{base05-hex}}",
  red      = "#{{base08-hex}}",
  green    = "#{{base0B-hex}}",
  blue     = "#{{base0D-hex}}",
  -- ...
}
```

### スロット割り当て戦略

| Base24 スロット | 推奨する色の特性 |
|----------------|----------------|
| base00 | 最も使用頻度が高い背景。画像の暗部から抽出した低彩度色 |
| base08 | キャラクターのメインカラー（赤系）または最も目立つアクセント |
| base0D | キャラクターのサブカラー（青系）またはセカンダリアクセント |
| base0E | キャラクターの第三カラー（紫系） |
| base0B | 補色・緑系（自動生成または色相反転） |
