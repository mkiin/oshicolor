# Lush.nvim 解析レポート

## 1. 色操作関数一覧

Lush は `hsl_like.lua` で全色操作関数を定義している。関数は 3 カテゴリに分かれる。

### 相対調整（Lerp ベース）

値を「現在値から最大/最小値までの残り幅」に対する割合で変化させる。

| 関数 | エイリアス | 引数 | 挙動 |
|---|---|---|---|
| `lighten(n)` | `li` | n: -100~100 | L を残り幅の n% だけ増加。`lighten(50)` で L=40 → 40 + (60 * 0.5) = 70 |
| `darken(n)` | `da` | n: 0~100 | `lighten(-n)` と等価。L を下方向に lerp |
| `saturate(n)` | `sa` | n: -100~100 | S を残り幅の n% だけ増加 |
| `desaturate(n)` | `de` | n: 0~100 | `saturate(-n)` と等価 |

### 絶対調整（加算ベース）

値を直接加減算する。

| 関数 | エイリアス | 引数 | 挙動 |
|---|---|---|---|
| `rotate(n)` | `ro` | n: 度数 | H に n を加算（360 で mod） |
| `abs_lighten(n)` | `abs_li` | n: 数値 | L に n を加算 |
| `abs_darken(n)` | `abs_da` | n: 数値 | L から n を減算 |
| `abs_saturate(n)` | `abs_sa` | n: 数値 | S に n を加算 |
| `abs_desaturate(n)` | `abs_de` | n: 数値 | S から n を減算 |

### オーバーライド（値の直接設定）

| 関数 | 引数 | 挙動 |
|---|---|---|
| `hue(n)` | n: 0~360 | H を n に置換 |
| `saturation(n)` | n: 0~100 | S を n に置換 |
| `lightness(n)` | n: 0~100 | L を n に置換 |

### 合成・ユーティリティ

| 関数 | 引数 | 挙動 |
|---|---|---|
| `mix(target, strength)` | target: HSL 色, strength: 0~100 | 2色をベクトル空間で混合。strength=0 で元色、100 で target 色 |
| `readable()` | なし | L >= 50 なら L=0（黒）、L < 50 なら L=100（白）。自動コントラスト用 |

### プロパティアクセス

| プロパティ | 返り値 |
|---|---|
| `.h` | Hue 値 (0~360) |
| `.s` | Saturation 値 (0~100) |
| `.l` | Lightness 値 (0~100) |
| `.hex` | "#RRGGBB" 文字列 |
| `.hsl` | `{h, s, l}` テーブル |
| `.rgb` | `{r, g, b}` テーブル |

## 2. 内部色空間

Lush は **2 つの色空間**を提供し、ユーザーがコンストラクタで選択する。

### HSL (`lush.hsl`)

- 標準的な HSL (Hue, Saturation, Lightness)
- 変換パイプライン: `HSL → RGB → HEX` / `HEX → RGB → HSL`
- `hsl/convert.lua` に実装。古典的な `hue2rgb` アルゴリズムを使用
- H: 0~360 度, S: 0~100%, L: 0~100%（内部計算時は 0~1 に正規化）

### HSLuv (`lush.hsluv`)

- 知覚的に均一な色空間 [hsluv.org](http://www.hsluv.org/)
- 変換パイプライン: `HSLuv → LCH → LUV → XYZ → linear RGB → sRGB → HEX`
- `hsluv/lib.lua` に Alexei Boronine のリファレンス実装をそのまま同梱
- 同じ lightness 値の色が人間の目に同じ明るさに見える（HSL にはないメリット）

### 色空間の使い分け

- **全関数が同一インターフェースで動作する**。`hsl_like.lua` が共通の操作層を提供し、コンストラクタで渡す `type_fns`（`from_hex` / `to_hex`）だけが異なる
- 色操作（lighten, rotate 等）は**常に H/S/L の数値に対する算術演算**。色空間変換が発生するのは HEX/RGB との入出力時のみ
- `mix()` は H/S を極座標からデカルト座標に変換して混合するため、色空間に依存しないベクトル演算を行う

## 3. メソッドチェーンの実装

### アーキテクチャ

```
hsl(210, 80, 50).lighten(20).rotate(30).hex
       ↓              ↓           ↓        ↓
  decorate_hsl_table  → new {h,s,l}      → to_hex_fn 呼び出し
                       → decorate_hsl_table（再帰）
                                   → new {h,s,l}
                                   → decorate_hsl_table（再帰）
                                              → 文字列返却
```

### 仕組み（`hsl_like.lua` の `decorate_hsl_table`）

1. **`{h, s, l}` プレーンテーブル**に Lua の `setmetatable` で `__index` メタメソッドを設定
2. `__index` で `.lighten` 等のキーアクセスを検知すると、対応する操作関数を呼び出す**クロージャを返す**
3. クロージャが引数を受け取ると：
   - 現在の `{h, s, l}` に対して演算し、新しい `{h, s, l}` プレーンテーブルを生成
   - そのテーブルを **再度 `decorate_hsl_table` で装飾**して返す（再帰的デコレーション）
4. `.hex` アクセス時にはじめて `to_hex_fn` が呼ばれ、色空間変換が実行される

### 重要な設計判断

- **イミュータブル**: 操作ごとに新しいオブジェクトを生成。元の色は変更されない
- **遅延変換**: チェーン中は H/S/L の数値演算のみ。HEX への変換は最終出力時の 1 回だけ
- **中間の色空間変換なし**: `lighten(20).rotate(30)` では HSL→RGB→HSL のような往復変換は発生しない。全操作が H/S/L 空間内で完結する
- **`__newindex` でプロパティ書き込みを禁止**: 完全な不変オブジェクト
- **`__tostring` で自動 HEX 変換**: 文字列結合時に自然に HEX 文字列になる

### clamp 処理

- 各操作後、`hsl_clamp` で H は `% 360`、S/L は `clamp(0, 100)` で正規化
- 値は `round()` で整数に丸められる（小数点以下は保持しない）

## 4. カラースキーム定義の具体例

### 例 1: チュートリアル（`examples/lush_tutorial.lua`）

少数のベースカラーから派生させるパターンを示している。

```lua
-- ベースカラー: 3 色を同一 Hue で定義
local sea_foam  = hsl(208, 100, 80)  -- 明るい青
local sea_crest = hsl(208, 90, 30)   -- 中間の青
local sea_deep  = hsl(208, 90, 10)   -- 暗い青

-- 色相回転で三和音を作成
local sea_foam_triadic = sea_foam.rotate(120)

-- チェーンで補色を生成
local sea_foam_complement = sea_foam.rotate(180).darken(10).saturate(10)

-- ハイライトグループ定義
Normal     { bg = sea_deep, fg = sea_foam }
CursorLine { bg = Normal.bg.lighten(10) }           -- Normal の背景を少し明るく
Visual     { fg = Normal.bg, bg = Normal.fg }        -- Normal の前景/背景を反転
Comment    { fg = Normal.bg.de(25).li(25).ro(-10) }  -- 彩度を下げ、明るくし、色相をずらす

-- グループ間の継承
LineNr       { Comment, gui = "italic" }  -- Comment を継承し、italic を追加
CursorLineNr { LineNr, fg = CursorLine.bg.mix(Normal.fg, 50) }  -- 2色を50%で混合
```

**派生の流れ:**
1. `sea_deep` (H=208, S=90, L=10) をベース背景に設定
2. `CursorLine.bg` = `sea_deep.lighten(10)` → L=10 から残り幅 90 の 10% → L=19
3. `Comment.fg` = `sea_deep.de(25).li(25).ro(-10)` → S を 25% 減少、L を 25% 増加、H を 10 度回転

### 例 2: 拡張パターン（`EXTEND.md` より）

既存テーマから派生させる実用例。

```lua
local harbour = require('lush_theme.harbour')

-- 既存テーマの色を参照して微調整
Comment  { fg = harbour.Comment.fg, bg = harbour.Comment.bg, gui = "italic" }
Function { fg = harbour.Function.fg.da(10) }  -- Function の前景を 10% 暗く

-- プラグイン用のグループを既存グループから派生
TelescopeNormal { harbour.Pmenu }                            -- Pmenu をリンク
TelescopeBorder { fg = TelescopeNormal.bg.li(20) }           -- 背景色を 20% 明るくして枠線に
TelescopeTitle  { fg = TelescopeNormal.bg, bg = TelescopeNormal.fg }  -- 前景と背景を入替
```

## 5. 設計の評価と oshicolor への適用

### Lush の良い点

1. **意図が読めるコード**: `Normal.bg.lighten(10)` は「Normal の背景を少し明るくする」と即座に理解できる。マジックナンバーの `#1a3a5c` より遥かに可読性が高い
2. **イミュータブル設計**: 操作が元の色を変更しないため、同じベース色から安全に複数の派生色を作れる
3. **遅延変換による効率**: チェーン中は HSL 空間内の算術のみ。中間変換のコストがゼロ
4. **Lerp ベースの相対調整**: `lighten(50)` は「現在値から最大値までの残り幅の 50%」を意味する。L=20 でも L=80 でも同じ `lighten(50)` で「半分明るくする」を表現できる。境界値（0 や 100）に到達しにくい自然な挙動
5. **HSLuv サポート**: 知覚的均一性を担保できるオプションがある。「同じ lightness の色は同じ明るさに見える」ことが保証される
6. **2 系統の調整（Lerp / Abs）**: 意図に応じて使い分けられる。「ちょっと明るく」は lerp、「正確に L を 5 上げる」は abs

### oshicolor に適用する際の制約・注意点

1. **整数丸め**: Lush は全操作後に `round()` で H/S/L を整数化する。微妙な色差を表現するには精度が不足する場合がある。oshicolor では小数点を保持するか検討が必要
2. **色空間の選択**: Lush の HSL モードは知覚的均一性がない。「L=50 の赤」と「L=50 の青」は人間の目には異なる明るさに見える。AI が抽出した 3 色間の関係性を保つには **HSLuv（または OKLCH）を既定にする**ことを推奨
3. **mix() のアルゴリズム**: Lush の `mix()` は HSL の H/S を極座標→デカルト変換して混合する。これは RGB 空間での混合とも Lab 空間での混合とも異なる結果になる。oshicolor で使う場合は、どの空間での混合が最も自然に見えるかを検証すべき
4. **Lua 専用の DSL**: Lush は Lua のメタテーブルに強く依存している。TypeScript では class + メソッドチェーン、または関数合成（pipe パターン）で同等の API を実現する必要がある
5. **3 色からの自動生成という文脈の違い**: Lush はテーマ作者が手動で `lighten(10)` 等の値を決める前提。oshicolor では AI が 3 色を出力し、そこから自動的に 60+ のハイライトグループを生成する。Lush の DSL をそのまま使うのではなく、**「背景色は primary.lightness(10)、コメントは primary.desaturate(40).lighten(30)」のようなルールセット（レシピ）**として構造化し、レシピのパラメータを config に集約するのが現実的
6. **readable() の単純さ**: Lush の `readable()` は L >= 50 で黒、そうでなければ白を返すだけ。WCAG コントラスト比に基づく判定のほうが実用的
7. **rotate の非知覚性**: HSL での `rotate(120)` は色相環を 120 度回すが、知覚的に均等な 3 色にはならない。HSLuv/OKLCH での回転を使うことで、より調和のとれた配色が得られる
