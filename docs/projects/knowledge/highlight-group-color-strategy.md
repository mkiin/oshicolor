# ハイライトグループ × 色割り当て戦略 分析レポート

> 作成日: 2026-02-23
> 参照: kanagawa.nvim / tokyonight.nvim / xeno.nvim / root-loops / nvim-highlite / node-vibrant

---

## 目的

1. 広く使われているカラースキーマがどういう色を各ハイライトに割り当てているかを知る
2. 少ない色から Neovim カラースキーマを生成するロジックを理解する
3. node-vibrant の 64 代表色 → カラースキーマ用スロットへのスコアリング設計の指針を得る

---

## 1. Vim 標準ハイライトグループ × 色割り当てテーブル

### 1-A. 構文グループ（core syntax）

| グループ       | 役割               | 色の特性                              | Kanagawa (wave)                          | TokyoNight (night)              |
| -------------- | ------------------ | ------------------------------------- | ---------------------------------------- | ------------------------------- |
| **Comment**    | コメント文         | 低彩度グレー・暗め / italic           | `fujiGray #727169`（灰）                 | `comment #565f89`（青みグレー） |
| **Constant**   | 定数全般           | 暖色系・中彩度                        | `surimiOrange #FFA066`（橙, 30°）        | `orange #ff9e64`（橙）          |
| **String**     | 文字列             | 緑系・中明度                          | `springGreen #98BB6C`（緑, 130°）        | `green #9ece6a`（黄緑）         |
| **Character**  | 文字定数           | String に準じる                       | link → String                            | `green #9ece6a`                 |
| **Number**     | 数値               | 赤-ピンク系 or 橙                     | `sakuraPink #D27E99`（ピンク, 340°）     | `orange #ff9e64`（橙）          |
| **Boolean**    | 真偽値             | Constant または Number と同色         | `surimiOrange #FFA066` / bold            | link → Number                   |
| **Float**      | 浮動小数           | Number と同色                         | link → Number                            | link → Number                   |
| **Identifier** | 変数名・フィールド | 黄色系（高頻度のため控えめ）          | `carpYellow #E6C384`（黄, 60°）          | `magenta #bb9af7`（紫）         |
| **Function**   | 関数名             | 青系・高彩度                          | `crystalBlue #7E9CD8`（青, 220°）        | `blue #7aa2f7`（青）            |
| **Statement**  | 文全般             | keyword と同色                        | `oniViolet #957FB8`（紫, 280°）/ bold    | `magenta #bb9af7`               |
| **Operator**   | 演算子             | 黄-金系 or シアン                     | `boatYellow2 #C0A36E`（黄金, 50°）       | `blue5 #89ddff`（シアン）       |
| **Keyword**    | 予約語             | 紫系・中彩度 / italic                 | `oniViolet #957FB8`（紫, 280°）          | `cyan #7dcfff`（水色）          |
| **Exception**  | 例外 (throw/raise) | 赤系・強調                            | `waveRed #E46876`（赤, 0°）              | link → Statement                |
| **PreProc**    | プリプロセッサ     | 赤系 or シアン                        | `waveRed #E46876`                        | `cyan #7dcfff`                  |
| **Type**       | 型名               | 水色-シアン系                         | `waveAqua2 #7AA89F`（青緑, 180°）        | `blue1 #2ac3de`（水色）         |
| **Special**    | 特殊記号           | 水色系                                | `springBlue #7FB4CA`（水色, 200°）       | `blue1 #2ac3de`                 |
| **Delimiter**  | 区切り記号         | 紫がかった灰青                        | `springViolet2 #9CABCA`（青紫, 210°）    | link → Special                  |
| **Underlined** | URLなど下線        | 特殊色 + underline                    | `springBlue` / underline                 | underline のみ                  |
| **Error**      | エラー表示         | **赤・強い彩度（diag.error と同色）** | `samuraiRed #E82424`                     | `error #db4b4b`                 |
| **Todo**       | TODO/FIXME         | 反転 or 黄bg + 強調 / bold            | fg=`ui.fg_reverse` bg=`diag.info` / bold | bg=`yellow` fg=`bg`             |

### 1-B. エディタ UI グループ

| グループ            | 役割           | 色の特性                         | Kanagawa (wave)                               | TokyoNight (night)         |
| ------------------- | -------------- | -------------------------------- | --------------------------------------------- | -------------------------- |
| **Normal**          | 基本 fg / bg   | fg: 低彩度の明色; bg: 非常に暗い | fg=`fujiWhite #DCD7BA`, bg=`sumiInk3 #1F1F28` | fg=`#c0caf5`, bg=`#1a1b26` |
| **CursorLine**      | カーソル行     | bg に薄いハイライト              | bg=`sumiInk5 #363646`                         | bg=`bg_highlight #292e42`  |
| **LineNr**          | 行番号         | 暗めグレー                       | `sumiInk6 #54546D`                            | `fg_gutter #3b4261`        |
| **Comment（再掲）** | —              | bg より2〜3段明るいグレー        | `fujiGray #727169`                            | `#565f89`                  |
| **Visual**          | 選択範囲 bg    | bgより明るい同色系               | bg=`waveBlue1`                                | bg=`bg_visual`             |
| **Search**          | 検索ハイライト | 対比色（青系）                   | bg=`waveBlue2`                                | bg=`bg_search`             |
| **DiagnosticError** | エラー下線     | 赤                               | `samuraiRed #E82424`                          | `error #db4b4b`            |
| **DiagnosticWarn**  | 警告下線       | 橙-黄                            | `roninYellow #FF9E3B`                         | `warning #e0af68`          |
| **DiagnosticInfo**  | 情報下線       | 青                               | `dragonBlue`                                  | `info #0db9d7`             |
| **DiagnosticHint**  | ヒント下線     | 水色-緑青                        | `waveAqua1 #6A9589`                           | `hint #1abc9c`             |
| **DiffAdd**         | diff 追加 bg   | 暗い緑（低彩度）                 | bg=`winterGreen #2B3328`                      | bg=diff.add（暗緑）        |
| **DiffDelete**      | diff 削除 bg   | 暗い赤（低彩度）                 | bg=`winterRed #43242B`                        | bg=diff.delete             |
| **DiffChange**      | diff 変更 bg   | 暗い青（低彩度）                 | bg=`winterBlue #252535`                       | bg=diff.change             |

### 1-C. TreeSitter 主要グループ

| グループ                   | 役割                   | 色の特性                       | Kanagawa (wave)                     | TokyoNight (night)  |
| -------------------------- | ---------------------- | ------------------------------ | ----------------------------------- | ------------------- |
| **@variable**              | ローカル変数           | **`none`（Normal.fg を継承）** | `ui.fg = fujiWhite`（実質 none）    | `c.fg #c0caf5`      |
| **@variable.builtin**      | self/this 等           | 赤系 / italic（特別感）        | `waveRed #E46876` / italic          | `red #f7768e`       |
| **@variable.parameter**    | 関数引数               | keyword と近い紫系             | `oniViolet2 #b8b4d0`                | `yellow #e0af68`    |
| **@variable.member**       | フィールド/プロパティ  | Identifier と同色              | `carpYellow #E6C384`                | `green1 #73daca`    |
| **@string.regexp**         | 正規表現               | 橙-黄 or 水色                  | `boatYellow2 #C0A36E`               | `blue6 #b4f9f8`     |
| **@string.escape**         | エスケープシーケンス   | regex と同色 / bold            | `boatYellow2` / bold                | `magenta #bb9af7`   |
| **@keyword.return**        | return 文              | 赤-橙の強調色                  | `peachRed #FF5D62` / keywordStyle   | link → @keyword     |
| **@keyword.exception**     | throw/raise            | 赤-橙系 / bold                 | `peachRed #FF5D62` / statementStyle | link → Exception    |
| **@keyword.operator**      | `and` / `or` 等        | keyword より少し暖かい         | `boatYellow2` / bold                | link → @operator    |
| **@constructor**           | コンストラクタ         | 水色 or 紫（型と関数の中間）   | `springBlue #7FB4CA`                | `magenta #bb9af7`   |
| **@operator**              | `+` `-` `*` 等         | シアン or 黄金                 | link → Operator                     | `blue5 #89ddff`     |
| **@punctuation.delimiter** | `,` `.` `;`            | 紫がかった青灰                 | `springViolet2 #9CABCA`             | `blue5 #89ddff`     |
| **@punctuation.bracket**   | `(` `)` `[` `]`        | 同上                           | `springViolet2`                     | `fg_dark #a9b1d6`   |
| **@type.builtin**          | int/str 等組み込み型   | Type と同色系（やや暗め）      | link → Type                         | blend(`blue1`, 0.8) |
| **@property**              | オブジェクトプロパティ | Identifier/member 系           | link → Identifier                   | `green1 #73daca`    |

### 1-D. LSP グループ（要点のみ）

| グループ                         | 役割          | 割り当て方針                                   |
| -------------------------------- | ------------- | ---------------------------------------------- |
| `@lsp.type.variable`             | 変数          | **空（TreeSitter に委ねる）** – 両スキーマ共通 |
| `@lsp.type.parameter`            | 引数          | link → @variable.parameter                     |
| `@lsp.type.method`               | メソッド      | link → @function.method                        |
| `@lsp.type.namespace`            | 名前空間      | link → @module                                 |
| `@lsp.mod.readonly`              | readonly 変数 | link → Constant                                |
| `@lsp.typemod.function.readonly` | 純粋関数      | `syn.fun` / bold（Kanagawa のみ強調）          |

---

## 2. 色割り当て戦略の抽出

### 2-A. Hue マップ（両スキーマ共通の設計哲学）

```
Hue 0°（赤）    → waveRed / red       : Exception, @variable.builtin, エラー強調
Hue 20°-40°（橙）→ surimiOrange / orange : Constant, Number（暖かさ・具体性）
Hue 50°-70°（黄）→ carpYellow / yellow   : Identifier, @variable.member
Hue 120°-150°（緑）→ springGreen / green : String（最も一般的なアクセント）
Hue 170°-200°（水色）→ waveAqua / blue1  : Type（型の「冷たい」印象と対応）
Hue 200°-230°（青）→ crystalBlue / blue  : Function（主要アクセント）
Hue 210°-230°（青紫）→ springBlue        : Special, Delimiter（控えめな記号類）
Hue 260°-290°（紫）→ oniViolet / magenta : Keyword（言語構造の核）
Hue 340°（ピンク）→ sakuraPink           : Number（Kanagawa 独自）
```

**重要な知見**: Hue の配置は「意味の温度感」に対応している。

- 緑（穏やか）→ String
- 水色（論理的）→ Type
- 青（主役感）→ Function
- 紫（制御・命令）→ Keyword
- 橙/赤（注意・強調）→ Constant / Exception

### 2-B. 最重要設計パターン：「variable = none」

両スキーマとも **変数名にはアクセント色を付けない**。

```
@variable = Normal.fg をそのまま継承
```

理由：変数は最頻出トークン。アクセント色を付けると目が疲れ、
他の色との差別化が失われる。

**この1つのルールが、全体の可読性を最も左右する。**

### 2-C. 必要な独立 Hue 数

Kanagawa の syn グループを分析すると、独立した Hue は **7色**：

| 順位 | 色スロット   | おおよその Hue | 対応グループ                            |
| ---- | ------------ | -------------- | --------------------------------------- |
| 1    | `function`   | 220°           | Function (@function, @function.method)  |
| 2    | `keyword`    | 280°           | Keyword, Statement (@keyword系)         |
| 3    | `string`     | 130°           | String (@string)                        |
| 4    | `type`       | 180°           | Type (@type)                            |
| 5    | `constant`   | 30°            | Constant, Number (@number, @constant)   |
| 6    | `identifier` | 60°            | Identifier, @variable.member, @property |
| 7    | `special`    | 200°           | Special, Delimiter, @punctuation        |

- `comment`（低彩度グレー、Hue は bg に合わせる）
- `variable.builtin`（赤系、例外・組み込みの強調）

### 2-D. 独立した固定色グループ（syn と混在させない）

| グループ         | 色特性                 | 管理方針                       |
| ---------------- | ---------------------- | ------------------------------ |
| `diag.error`     | 赤・高彩度             | **固定値**（赤系から外れない） |
| `diag.warning`   | 橙-黄                  | **固定値**                     |
| `diag.info`      | 青系                   | **固定値**                     |
| `diag.hint`      | 水色-緑青              | **固定値**                     |
| `diff.add` bg    | 暗い緑（winter系）     | **固定値**（低彩度・暗め）     |
| `diff.delete` bg | 暗い赤                 | **固定値**                     |
| `vcs.added` fg   | 鮮やかな緑（autumn系） | **固定値**                     |
| `vcs.removed` fg | 鮮やかな赤             | **固定値**                     |

**Diagnostic / Diff は画像から抽出した色を使わない。** WCAG コントラスト要件を
満たすことが実用上必須であるため、スキーマ作者が手動で調整した固定色を使う。

---

## 3. 既存ジェネレーターの色生成ロジック比較

### 3-A. 入力の少なさと色生成方法の対応

| ツール            | 入力                 | 生成方式                             | 特徴                                            |
| ----------------- | -------------------- | ------------------------------------ | ----------------------------------------------- |
| xeno.nvim         | 2色（base + accent） | HSL Lを固定テーブルで10段階展開      | 最小入力。keyword/string/typeが同色になる       |
| Root Loops        | 6パラメータ          | Okhsl 60°均等分割で6アクセント色生成 | 知覚均一なHue分割。ANSIカラー意味ベース割り当て |
| nvim-highlite     | 50+色手動定義        | フレームワークが自動展開             | 粒度最細。keyword/loop/conditionalを分離        |
| colorgen-nvim     | TOML宣言             | テンプレート展開                     | データとロジックの完全分離                      |
| oshicolor（現在） | 画像→12色            | OKLch C順ランク割り当て              | accents[0]=Keyword, [1]=Function...             |

### 3-B. 最も重要な示唆：「色のクラスター化」

全ロールに独立した色を与えるのは自動生成では困難。
**色クラスターに分類し、クラスター内は同色 or 明度差のみで対応する**のが現実解。

```
クラスターA (keyword 系): Keyword / Statement / Conditional / Repeat / Exception
  → 同色（Hue: 260-290°の紫系）、一部 italic / bold で差別化

クラスターB (function 系): Function / @function.method / @constructor
  → 同色（Hue: 210-230°の青系）

クラスターC (string 系): String / Character / @string.escape(bold)
  → 同色（Hue: 120-150°の緑系）

クラスターD (type 系): Type / @type.builtin（やや暗め）/ Typedef
  → 同色（Hue: 170-200°の水色系）

クラスターE (constant 系): Constant / Number / Boolean / Float
  → 同色（Hue: 20-60°の橙-黄系）

クラスターF (identifier 系): Identifier / @variable.member / @property
  → 同色（Hue: 50-80°の黄系）

クラスターG (special 系): Special / Delimiter / @punctuation
  → 同色（Hue: 200-220°の水色-青灰系）

クラスターH (comment): Comment
  → 低彩度グレー（bg の Hue を引き継いで軽く色付け）

クラスターI (variable): @variable
  → none（Normal.fg そのまま）
```

### 3-C. bg / fg の生成戦略

| 属性             | 生成方法                                 | 具体例          |
| ---------------- | ---------------------------------------- | --------------- |
| `bg`             | signatureHue を継承した极低彩度 OKLch 色 | L≈0.10, C≈0.015 |
| `bg_p1`〜`bg_p2` | bg を OKLch L で +0.02〜0.05 ずつシフト  | 7段階           |
| `fg`             | 極低彩度の明色（bg と同 Hue で十分）     | L≈0.85, C≈0.01  |
| `comment.fg`     | bg Hue + C=0.05 程度の中間グレー         | L≈0.45          |

---

## 4. node-vibrant スコアリング → カラースキーマ用スロット設計

### 4-A. 問題の整理

node-vibrant の DefaultGenerator が出す 6 スロット：

```
Vibrant      (中輝度 × 高彩度) L:0.3-0.7  S:0.35-1.0
DarkVibrant  (暗い   × 高彩度) L:0-0.45   S:0.35-1.0
LightVibrant (明るい × 高彩度) L:0.55-1.0 S:0.35-1.0
Muted        (中輝度 × 低彩度) L:0.3-0.7  S:0-0.4
DarkMuted    (暗い   × 低彩度) L:0-0.45   S:0-0.4
LightMuted   (明るい × 低彩度) L:0.55-1.0 S:0-0.4
```

**問題**: これらは L/S の次元のみで分類され、**Hue 情報を持たない**。
カラースキーマには「緑→string」「紫→keyword」のような Hue 制約が必要。

### 4-B. 提案：Hue ゾーン × L/S スコアリングの2段階方式

#### ステップ1: 64代表色の前処理

```
node-vibrant: maxColorCount=64 の Swatch[]
  ↓
各 Swatch を OKLch（L/C/H）に変換
  → L: 知覚的明度 0-1
  → C: 知覚的彩度 0-0.4 程度
  → H: 色相角 0-360°
```

#### ステップ2: カラースキーマ用スロット定義

カラースキーマに必要なスロット（9種）：

| スロット          | 役割              | 目標 Hue（OKLch H°）   | 目標 L    | 目標 C    |
| ----------------- | ----------------- | ---------------------- | --------- | --------- |
| `slot_function`   | Function / 青系   | 220-260°               | 0.60-0.75 | >0.10     |
| `slot_keyword`    | Keyword / 紫系    | 270-310°               | 0.55-0.70 | >0.08     |
| `slot_string`     | String / 緑系     | 130-170°               | 0.70-0.80 | >0.10     |
| `slot_type`       | Type / 水色系     | 180-220°               | 0.65-0.78 | >0.08     |
| `slot_constant`   | Constant / 橙系   | 50-90°                 | 0.70-0.82 | >0.12     |
| `slot_identifier` | Identifier / 黄系 | 80-120°                | 0.75-0.85 | >0.08     |
| `slot_special`    | Special / 青灰系  | 200-230°               | 0.62-0.72 | 0.04-0.10 |
| `slot_comment`    | Comment / グレー  | any (bg Hue preferred) | 0.40-0.55 | <0.06     |
| `slot_bg_accent`  | bg の色調         | 任意                   | <0.20     | <0.03     |

#### ステップ3: スコアリング式（各スロット）

各 Swatch のスコアは以下の加重和で計算する：

```
score(swatch, slot) =
  w_hue  × hueScore(swatch.H, slot.targetH, slot.hueRange)
  + w_luma × (1 - |swatch.L - slot.targetL|)
  + w_chroma × (1 - |swatch.C - slot.targetC|) / slot.targetC
  + w_pop  × (swatch.population / maxPopulation)

重み（推奨初期値）:
  w_hue   = 5.0   ← Hue 一致が最優先
  w_luma  = 3.0   ← 明度
  w_chroma= 2.0   ← 彩度
  w_pop   = 0.5   ← 人口（多少優遇する程度）

hueScore(H, targetH, range):
  angleDiff = min(|H - targetH|, 360 - |H - targetH|)
  if angleDiff <= range/2: return 1 - angleDiff / (range/2)
  else: return 0   ← Hue ゾーン外は完全除外
```

#### ステップ4: 選択プロセス

```
1. 各スロットで hueScore > 0 の候補を絞り込む
2. その中でスコア最大の Swatch を採用
3. 採用済み Swatch は他のスロットで使えない（重複防止）
4. 候補なし（hueScore=0 のみ）の場合:
   a. 画像に近い Hue があるか Hue ゾーンを±30°拡張して再検索
   b. それでもなければ OKLch で targetH / targetL / targetC から直接生成（合成色）
```

#### ステップ5: フォールバック合成（最重要）

アニメキャラクターのイラストでは特定の Hue がない場合がある。
（例: 青髪キャラ → 赤緑橙が画像に存在しない）

```
合成優先度:
slot_string（緑系）が空 → slot_function（青系）の Swatch の H を 130° に変更して合成
slot_type（水色系）が空 → slot_function から H を 200° に変更して合成
slot_constant（橙系）が空 → signatureHue + 120°（補色系）で OKLch 合成
slot_identifier（黄系）が空 → slot_constant から L を +0.10 して合成
slot_special（青灰系）が空 → slot_function の C を 0.07 に下げて合成
slot_comment が空 → signatureHue + L=0.45, C=0.04 で直接合成（ほぼ必ず合成）
```

### 4-C. node-vibrant の既存スロットとの対応

node-vibrant のスロットをそのまま使う場合の参考マッピング（精度低め）：

```
DarkMuted   → bg の参考色（暗い・低彩度という性質が一致）
LightMuted  → fg の参考色（明るい・低彩度）
Vibrant     → signatureColor（最も「らしい」色 → keyword に使える可能性）
DarkVibrant → 補助アクセント
LightVibrant → 明るいアクセント（string 系に向く場合あり）
Muted       → comment（低彩度）
```

ただしこれは近似。**Hue ゾーンスコアリング（4-B）の方が精度が大幅に高い**。

---

## 5. 統括: oshicolor カラーマッピング設計への提言

### 5-A. 現在の v3 設計の問題点

`r2-color-mapping-v3.md` によると現在は「C（彩度）順で accents を並べ、
上位3色を Keyword/Function/Special に割り当て」している。

**問題**:

1. **Hue 制約がない**: 彩度が高い橙がある場合に Function が橙色になりうる
2. **String/Type の色が補完頼り**: 画像に緑/水色がないと合成品質が低下
3. **スロット数が少ない**: 9色が理想のところを3色で割り当てている

### 5-B. 推奨する新設計の骨格

```
入力: node-vibrant → maxColorCount=64 の Swatch[] 64色

Step 1: OKLch 変換（全 Swatch）

Step 2: bg/fg の決定
  bg = signatureHue + OKLch(L=0.10, C=0.015, H=signatureH)
  fg = signatureHue + OKLch(L=0.88, C=0.008, H=signatureH)
  ※ 画像から直接抽出しない（極端な色になるリスクがあるため）

Step 3: Hue ゾーンスコアリングで 7 アクセントスロットを埋める
  slot_function  (H:220-260°, L:0.65-0.78, C:>0.10)
  slot_keyword   (H:270-310°, L:0.58-0.72, C:>0.08)
  slot_string    (H:130-170°, L:0.70-0.82, C:>0.10)
  slot_type      (H:180-220°, L:0.65-0.78, C:>0.08)
  slot_constant  (H:50-90°,   L:0.72-0.84, C:>0.12)
  slot_identifier(H:80-120°,  L:0.76-0.86, C:>0.08)
  slot_special   (H:200-235°, L:0.62-0.72, C:0.04-0.09)

Step 4: comment の決定
  L=0.45, C=0.04, H=signatureH（合成固定）

Step 5: Diagnostic / diff 色の固定割り当て（画像非依存）
  diag.error   = OKLch(L=0.55, C=0.20, H=25°)  ← 赤
  diag.warning = OKLch(L=0.72, C=0.18, H=70°)  ← 橙-黄
  diag.info    = OKLch(L=0.68, C=0.15, H=230°) ← 青
  diag.hint    = OKLch(L=0.70, C=0.12, H=190°) ← 水色
  diff.add bg  = OKLch(L=0.20, C=0.04, H=135°) ← 暗緑
  diff.del bg  = OKLch(L=0.20, C=0.04, H=25°)  ← 暗赤

Step 6: ハイライトグループへのクラスター展開
  function   → Function, @function, @function.method, @function.builtin
  keyword    → Keyword, Statement, @keyword, @keyword.return(bold), Conditional
  string     → String, Character, @string, @string.regexp
  type       → Type, @type, @type.builtin(blend 0.85)
  constant   → Constant, Number, Boolean, Float, @constant, @number
  identifier → Identifier, @variable.member, @property, @string.special.symbol
  special    → Special, Delimiter, @punctuation, @operator
  none       → @variable（Normal.fg 継承）
  comment    → Comment（italic）
```

### 5-C. スコアリング重みの調整指針

```
ケース別の重み調整:

【単色系（同一Hue が多い画像）】
  w_hue を下げ（3.0）、w_pop を上げる（1.5）
  → 同一 Hue の中でも彩度/明度で分散させる

【多色系（カラフルな画像）】
  w_hue を上げ（6.0）、w_pop を下げる（0.3）
  → 目標 Hue に最も近い色を優先採用

【モノクロ・パステル系】
  全スロットを合成モードで埋める（スコアリング不要）
  signatureHue が取れない場合は Hue=270°（紫）をデフォルトとする
```

---

## 6. まとめ

### 色の必要数

| 種類           | 独立色数             | 生成方法                         |
| -------------- | -------------------- | -------------------------------- |
| 構文アクセント | 7色（各 Hue ゾーン） | Hue ゾーンスコアリング from 64色 |
| comment        | 1色                  | signatureHue + L/C 固定で合成    |
| bg 階調        | 7段階                | OKLch L をシフト                 |
| fg             | 1色                  | bg Hue + 高 L で合成             |
| Diagnostic     | 4色                  | **固定値（画像非依存）**         |
| Diff bg        | 4色                  | **固定値（低彩度暗色）**         |
| vcs fg         | 3色                  | **固定値（高彩度）**             |

### スコアリングの核心

```
Hue ゾーン制約 >> 明度一致 >> 彩度一致 >> 人口

「正しい色相の中から最も適切な明度・彩度の色を選ぶ」
```

この優先順位が、kanagawa/tokyonight の設計哲学と整合している。
両スキーマとも、`string=緑`, `type=水色`, `keyword=紫` という
Hue マッピングの一貫性を最優先で維持している。
