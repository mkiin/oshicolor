# xeno.nvim 調査レポート

> 調査日: 2026-02-22
> リポジトリ: `sample-repo/nvim-generators/xeno.nvim/`

---

## 設計思想

**「2色から10段階トーンスケールを生成し、スケール位置でロールを決める」**

ユーザーが渡すのは `base`（背景色）と `accent`（強調色）の2色のみ。
それぞれを10段階（100〜950）のトーンスケールに展開し、
すべてのハイライトグループはスケール上の位置で決まる。

---

## 色生成メカニズム（`lua/xeno/core/palette.lua`）

### トーンスケール定義

固定明度テーブルで10段階のスケールを生成する。

```lua
lightness = {
  [100] = 0.900,  -- 最も明るい（fg 域）
  [200] = 0.750,
  [300] = 0.650,
  [400] = 0.600,
  [500] = 0.480,  -- 中間
  [600] = 0.280,
  [700] = 0.195,
  [800] = 0.140,
  [900] = 0.115,
  [950] = 0.090,  -- 最も暗い（bg 域）
}
```

### 生成アルゴリズム（HSL 色空間）

入力色の Hue / Saturation を維持しつつ、L だけ各段階の固定値に置き換える。

```lua
-- generate_color_scale(color, contrast, variation)
-- contrast: 中点(0.5)からの距離を拡張する係数
-- variation: スケールの広がりを調整
```

### パラメータ

| パラメータ | 役割 |
|---|---|
| `base` | 背景色（Hue/Sat を基準にスケール生成） |
| `accent` | 強調色（Hue/Sat を基準にスケール生成） |
| `contrast` | 明度の広がり係数 |
| `variation` | スケールの展開幅 |
| `red/green/yellow/orange/blue/purple/cyan` | オプション固定色（上書き可） |

---

## ロール割り当て（`lua/xeno/highlights/base/syntax.lua`）

| スケール位置 | 割り当て |
|---|---|
| `accent_100`（L=0.90） | Keyword / Type / String / Constant / @string |
| `accent_200`（L=0.75） | @keyword / @keyword.function / @keyword.operator |
| `accent_300`（L=0.65） | @number |
| `base_200`（L=0.75） | Function / @function |
| `base_300`（L=0.65） | Identifier / Operator / Special / Boolean |
| `base_500`（L=0.48） | Comment（中間の暗さ） |
| `red`（固定色） | Error |

**注目点**: Keyword / Type / String が同一色（accent_100）になる設計。
差別化は色ではなく「どの token に当たるか」という意味論でのみ行っている。

---

## アーキテクチャ

```
入力: base色 + accent色
       ↓
  HSL分解 → 固定Lテーブルで10段階生成 × 2系統
       ↓
  スケール位置 → ロール割り当て（100=明, 950=暗）
       ↓
  Neovim hi 定義（.vim / .lua）
```

---

## oshicolor への示唆

- **OKLch 対応**: HSL の代わりに OKLch を使えば知覚均一なトーンスケールを生成できる
- **入力の少なさ**: 2色入力というシンプルさは理想。oshicolor では `signatureColor` が1色として機能しうる
- **スケール位置によるロール決定**: `L=0.70 → keyword`, `L=0.50 → comment` 等の固定ルールは設計しやすい
- **bg/fg のスケール派生**: bg は `base_950`（L=0.09）、fg は `base_100`（L=0.90）という設計が自然
