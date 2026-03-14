# 赤系テーマのカラースキーム設計分析

> 作成日: 2026-02-23
> 調査目的: signatureColor が赤系（H: 0°〜25°）の場合のハイライトグループ Hue 割り当て戦略を探る（判断B の解決）
> 調査対象: reddish.nvim / rose-pine / gruvbox / monokai-pro.nvim（Ristretto 含む）

---

## 1. 調査の動機

oshicolor v4 の未解決課題「判断B」は次の問いである：

> **signatureColor が赤系（H: 0°〜25°）のとき、どのゾーンに配置すべきか？**
>
> - 赤系 signature を `constant`（H=55°）に近似させて押し込む
> - 赤系 signature を `keyword`（H=285°） or `function`（H=225°）の代わりとして使う
> - diag.error（固定 H=25°）との混同をどう回避するか

上記を4テーマのコードから実証的に分析し、設計方針を導く。

---

## 2. テーマ別パレット分析

### 2-A. reddish.nvim（純粋な単色赤テーマ）

**パレット（全色が赤〜橙スペクトラム）:**

| 色名       | Hex       | OKLch 近似             | 役割                                   |
| ---------- | --------- | ---------------------- | -------------------------------------- |
| bright3    | `#f6c2a5` | L≈0.83, C≈0.10, H≈30°  | Normal.fg / Number / Identifier        |
| bright2    | `#ea9a7d` | L≈0.70, C≈0.14, H≈25°  | Comment / String / Function / Operator |
| bright1    | `#e16a5e` | L≈0.56, C≈0.18, H≈20°  | Type / LineNr                          |
| normal     | `#d22f32` | L≈0.43, C≈0.22, H≈20°  | Keyword / Statement / Boolean / Error  |
| dark1      | `#b1274e` | L≈0.34, C≈0.20, H≈0°   | Ignore                                 |
| dark2      | `#931b46` | L≈0.27, C≈0.18, H≈355° | Search bg                              |
| dark3      | `#631033` | L≈0.18, C≈0.13, H≈350° | Pmenu bg                               |
| background | `#101010` | L≈0.06, C≈0.00, H≈0°   | Normal.bg                              |

**ハイライトグループ割り当て:**

| グループ          | 色      | OKLch H°                        |
| ----------------- | ------- | ------------------------------- |
| Normal.fg         | bright3 | 30°                             |
| Comment           | bright2 | 25°                             |
| String            | bright2 | 25° **← Comment と同色**        |
| Function          | bright2 | 25° **← Comment/String と同色** |
| Keyword/Statement | normal  | 20°                             |
| Type              | bright1 | 20°                             |
| Number/Float      | bright3 | 30°                             |
| Boolean           | normal  | 20°                             |
| Identifier        | bright3 | 30°                             |

**設計哲学:**

- **Hue による意味の差別化を一切行わない**。全構文色が H: 20°〜30° の赤〜橙スペクトラム内に収まる。
- 唯一の差別化手段は **L（明度）のみ**。Keyword(L=0.43) < Type(L=0.56) < Function(L=0.70) < Normal(L=0.83) の段差で読み分ける。
- String と Comment と Function が同色という思い切った割り切り。
- 「このキャラクターの世界はすべて赤で染まっている」という**単色世界観の完全な表現**。

**oshicolor への示唆:**

- 「赤系 signatureColor = 全ての構文色を赤系にする」という最も極端な選択肢。
- 可読性より**世界観優先**の場合に有効。ただし実用性は低い。
- 実装するとしたら「単色テーマモード」として独立させるべき設計。

---

### 2-B. rose-pine（ピンク/赤バラをシグネチャカラーとするテーマ）

**パレット（main バリアント）:**

| 色名     | Hex       | OKLch 近似                 | 意味                              |
| -------- | --------- | -------------------------- | --------------------------------- |
| base     | `#191724` | L≈0.11, C≈0.02, H≈275°     | Normal.bg                         |
| text     | `#e0def4` | L≈0.90, C≈0.04, H≈280°     | Normal.fg                         |
| love     | `#eb6f92` | L≈0.64, C≈0.19, H≈350°     | Error / @variable.builtin         |
| **rose** | `#ebbcba` | **L≈0.81, C≈0.08, H≈15°**  | **Function / @function**          |
| **gold** | `#f6c177` | **L≈0.82, C≈0.20, H≈55°**  | **String / Constant / Number**    |
| **pine** | `#31748f` | **L≈0.46, C≈0.10, H≈195°** | **Keyword / Statement**           |
| foam     | `#9ccfd8` | L≈0.79, C≈0.10, H≈195°     | Type / Special / @variable.member |
| iris     | `#c4a7e7` | L≈0.73, C≈0.14, H≈285°     | @variable.parameter / Macro       |
| subtle   | `#908caa` | L≈0.59, C≈0.07, H≈275°     | Comment / Delimiter               |
| muted    | `#6e6a86` | L≈0.47, C≈0.07, H≈275°     | LineNr                            |

**ハイライトグループ割り当て（主要グループ）:**

| グループ          | 色名     | OKLch H° | 業界標準との差異                             |
| ----------------- | -------- | -------- | -------------------------------------------- |
| Comment           | subtle   | 275°     | ほぼ標準（低 C グレー）                      |
| **Function**      | **rose** | **15°**  | **⚠️ 業界標準は 220°（青）。ピンクを使う！** |
| **Keyword**       | **pine** | **195°** | **⚠️ 業界標準は 285°（紫）。teal を使う！**  |
| **String**        | **gold** | **55°**  | **⚠️ 業界標準は 130°（緑）。黄〜橙を使う！** |
| Type              | foam     | 195°     | やや異なる（標準 185°と近い）                |
| Constant          | gold     | 55°      | 標準（橙系）と近い                           |
| @variable         | text     | 275°     | none 相当（標準）                            |
| @variable.member  | foam     | 195°     |                                              |
| @variable.builtin | love     | 350°     | 赤系（標準）                                 |
| @string.regexp    | iris     | 285°     | 紫（特殊扱い）                               |
| Boolean           | rose     | 15°      | ピンク（独自）                               |

**rose-pine の核心的設計判断:**

```
signatureColor（rose, H≈15°）の扱い:
  → Function に割り当てる（業界標準の青を使わない）

その結果、残りのゾーン再配置:
  Function(H≈15°)  ← signatureColor（rose/pink）
  String(H≈55°)   ← gold（黄橙系）
  Keyword(H≈195°) ← pine（teal）← 業界標準 285° を捨てて補色方向へ
  Type(H≈195°)    ← foam（水色）← pine と近いが L が異なる
  @variable.parameter ← iris(285°)（keyword 的な紫は parameter へ）
```

**観察:**

- rose-pine は「signatureColor を Function に使う」戦略を採用。
- Keyword を teal（H≈195°）に置くことで、rose（H≈15°）の **補色方向**（H+180°≈195°）に配置。これにより function/keyword のコントラストが最大化される。
- String を gold（H≈55°）に置くのは、rose(15°) と gold(55°) が **類似色（隣接 Hue）** で温かみある統一感を出すため。

---

### 2-C. gruvbox（暖色系・レトロテーマ。赤がアクセントカラー）

**パレット（dark モード bright 系）:**

| 色名             | Hex       | OKLch 近似                 | 意味                                    |
| ---------------- | --------- | -------------------------- | --------------------------------------- |
| dark0            | `#282828` | L≈0.18, C≈0.00             | Normal.bg                               |
| fg1              | `#ebdbb2` | L≈0.89, C≈0.07, H≈60°      | Normal.fg（温かみのある米色）           |
| gray_245         | `#928374` | L≈0.57, C≈0.05, H≈50°      | Comment                                 |
| **bright_red**   | `#fb4934` | **L≈0.52, C≈0.27, H≈25°**  | **Keyword / Statement / Conditional**   |
| **bright_green** | `#b8bb26` | **L≈0.72, C≈0.28, H≈110°** | **Function / String**                   |
| bright_yellow    | `#fabd2f` | L≈0.81, C≈0.25, H≈60°      | Type / Typedef                          |
| bright_blue      | `#83a598` | L≈0.63, C≈0.07, H≈180°     | Identifier                              |
| bright_purple    | `#d3869b` | L≈0.64, C≈0.12, H≈345°     | Constant / Number / Boolean / Character |
| bright_aqua      | `#8ec07c` | L≈0.71, C≈0.13, H≈145°     | PreProc / Structure                     |
| bright_orange    | `#fe8019` | L≈0.66, C≈0.22, H≈40°      | Special / StorageClass                  |

**ハイライトグループ割り当て:**

| グループ       | 色名             | OKLch H° | 業界標準との差異                              |
| -------------- | ---------------- | -------- | --------------------------------------------- |
| Comment        | gray_245         | 50°      | 標準（低 C）                                  |
| **Keyword**    | **bright_red**   | **25°**  | **⚠️ 業界標準は 285°（紫）。赤を使う！**      |
| Statement      | bright_red       | 25°      |                                               |
| Conditional    | bright_red       | 25°      |                                               |
| **Function**   | **bright_green** | **110°** | ⚠️ 業界標準は 220°（青）。黄緑を使う！        |
| **String**     | **bright_green** | **110°** | ⚠️ Function と同色。業界標準は 130°（緑）     |
| Type           | bright_yellow    | 60°      | ⚠️ 業界標準は 185°。gruvbox では黄            |
| Typedef        | bright_yellow    | 60°      |                                               |
| Constant       | bright_purple    | 345°     | ⚠️ 業界標準は 30°（橙）。gruvbox では紫ピンク |
| Number         | bright_purple    | 345°     |                                               |
| Boolean        | bright_purple    | 345°     |                                               |
| **Identifier** | bright_blue      | 180°     | ⚠️ 名前は blue だが実際は teal                |
| Special        | bright_orange    | 40°      | 標準に近い                                    |
| PreProc        | bright_aqua      | 145°     | 緑系                                          |
| StorageClass   | bright_orange    | 40°      |                                               |

**gruvbox の核心的設計判断:**

```
signatureColor 相当（最も特徴的なアクセント色）:
  → bright_orange (#fe8019, H≈40°) が実質的 signature
  → Keyword には bright_red (#fb4934, H≈25°) を使う

Hue マッピング（gruvbox 独自）:
  Keyword(H≈25°)  ← 赤系（signatureColor 近傍）
  Function(H≈110°) ← 黄緑系（補色方向）
  String(H≈110°)  ← Function と同色（意図的な省略）
  Type(H≈60°)     ← 黄色系
  Constant(H≈345°) ← ピンク（独自）
  Identifier(H≈180°) ← teal（「blue」と命名されているが）
```

**観察:**

- gruvbox は「赤 = Keyword」という設計。diag.error の赤とは L で差別化（bright_red L≈0.52）。
- Function と String を**同色**にする思い切った省略。7ゾーン → 6スロットへの縮退。
- Type に黄（H≈60°）を使うのは Catppuccin と同じ判断。
- 全体が暖色系（H: 25°〜60°）に寄っており、その中で機能色として aqua(145°), blue(180°) を使う。

---

### 2-D. monokai-pro.nvim（赤ピンクを主役にした古典的テーマ）

#### Pro バリアント

**パレット:**

| 色名        | Hex       | OKLch 近似                 | scheme.base での意味                        |
| ----------- | --------- | -------------------------- | ------------------------------------------- |
| background  | `#2d2a2e` | L≈0.19, C≈0.01, H≈285°     | Normal.bg                                   |
| text        | `#fcfcfa` | L≈0.99, C≈0.00             | Normal.fg                                   |
| **accent1** | `#ff6188` | **L≈0.65, C≈0.27, H≈345°** | **base.red → Keyword**                      |
| accent2     | `#fc9867` | L≈0.73, C≈0.22, H≈35°      | base.blue（!）→ Special/@variable.parameter |
| accent3     | `#ffd866` | L≈0.89, C≈0.28, H≈60°      | base.yellow → String                        |
| accent4     | `#a9dc76` | L≈0.82, C≈0.24, H≈125°     | base.green → Function                       |
| accent5     | `#78dce8` | L≈0.84, C≈0.15, H≈200°     | base.cyan → Type                            |
| accent6     | `#ab9df2` | L≈0.73, C≈0.21, H≈270°     | base.magenta → Constant                     |
| dimmed3     | `#727072` | L≈0.47, C≈0.01, H≈330°     | Comment                                     |

**ハイライトグループ割り当て（syntax + treesitter）:**

| グループ             | 色（base 名）          | OKLch H° | 備考                                            |
| -------------------- | ---------------------- | -------- | ----------------------------------------------- |
| Comment              | dimmed3                | ≈330°    | 低 C グレー                                     |
| **Keyword**          | **red（accent1）**     | **345°** | **⚠️ 業界標準は 285°（紫）。ピンク-赤を使う！** |
| Conditional / Repeat | red                    | 345°     |                                                 |
| Operator             | red                    | 345°     |                                                 |
| Exception            | red                    | 345°     |                                                 |
| **Function**         | **green（accent4）**   | **125°** | 業界標準（青）とは異なるが近い                  |
| @function            | green                  | 125°     |                                                 |
| **String**           | **yellow（accent3）**  | **60°**  | ⚠️ 業界標準は 130°（緑）。黄を使う              |
| @string              | yellow                 | 60°      |                                                 |
| **@type**            | **cyan（accent5）**    | **200°** | 業界標準（185°）に近い                          |
| Type                 | white                  | —        | テキスト色（実質色なし）                        |
| StorageClass         | red                    | 345°     | Keyword と同色                                  |
| Structure            | cyan                   | 200°     |                                                 |
| Constant             | magenta（accent6）     | 270°     |                                                 |
| Number / Boolean     | magenta                | 270°     |                                                 |
| Special              | blue（accent2=orange） | 35°      | "blue" と命名されているがオレンジ               |
| @variable            | white                  | —        | none 相当                                       |
| @variable.parameter  | blue（accent2=orange） | 35°      |                                                 |
| @punctuation.bracket | red                    | 345°     | ⚠️ 括弧が Keyword と同色                        |

**monokai-pro の核心的設計判断:**

```
accent1（#ff6188, H≈345°, 鮮やかなピンク-赤）が signatureColor:
  → Keyword に直接割り当て

残りは「Hue 間隔を均等に」配置する虹色設計:
  Keyword(H≈345°) ← accent1 = signatureColor（赤-ピンク）
  String(H≈60°)   ← accent3（黄）
  Function(H≈125°) ← accent4（黄緑）
  Type(H≈200°)    ← accent5（シアン）
  Constant(H≈270°) ← accent6（ラベンダー）
  Special(H≈35°)  ← accent2（オレンジ） ← 命名が "blue" で紛らわしい
```

#### Ristretto バリアント（赤みのある bg + 同じ HUE 構造）

| 色名       | Hex       | OKLch 近似                                     |
| ---------- | --------- | ---------------------------------------------- |
| background | `#2c2525` | L≈0.17, C≈0.03, **H≈5°（赤みがかった暗色！）** |
| text       | `#fff1f3` | L≈0.98, C≈0.02, H≈0°                           |
| accent1    | `#fd6883` | L≈0.64, C≈0.26, H≈345°                         |
| accent2    | `#f38d70` | L≈0.70, C≈0.20, H≈30°                          |
| accent3    | `#f9cc6c` | L≈0.87, C≈0.25, H≈60°                          |
| accent4    | `#adda78` | L≈0.82, C≈0.23, H≈128°                         |
| accent5    | `#85dacc` | L≈0.83, C≈0.12, H≈178°                         |
| accent6    | `#a8a9eb` | L≈0.73, C≈0.18, H≈268°                         |

**Ristretto の注目点:**

- bg が `#2c2525`（L≈0.17, H≈5°）— bg に **赤みを持たせる** 設計。
- アクセント色の Hue 構造は Pro と同じ（345°→345°→60°→125°→200°→270°）。
- bg の H を signature に合わせることで、「赤い世界にいる感覚」を bg から演出。
- アクセント色の L は Pro とほぼ同じ（0.64〜0.87）。

---

## 3. Hue マッピング比較表（業界標準 vs 赤系テーマ）

| ゾーン         | 業界標準 H | reddish     | rose-pine         | gruvbox              | monokai-pro          |
| -------------- | ---------- | ----------- | ----------------- | -------------------- | -------------------- |
| **Keyword**    | 285°       | 20°（赤）   | **195°（teal）**  | **25°（赤）**        | **345°（ピンク赤）** |
| **Function**   | 220°       | 25°（赤橙） | **15°（ローズ）** | **110°（黄緑）**     | 125°（黄緑）         |
| **String**     | 130°       | 25°（赤橙） | **55°（金）**     | **110°（黄緑）**     | **60°（黄）**        |
| **Type**       | 185°       | 20°（赤）   | 195°（foam）      | **60°（黄）**        | 200°（シアン）       |
| **Constant**   | 30°        | 20°（赤）   | 55°（gold）       | **345°（紫ピンク）** | 270°（ラベンダー）   |
| **Identifier** | 60°        | 30°（淡橙） | 195°（foam）      | **180°（teal）**     | —（白）              |
| **@variable**  | none       | 30°（淡橙） | none              | —                    | none（白）           |
| **Comment**    | 低C・bgH   | 25°（赤橙） | bgH+低C           | 暖色グレー           | ほぼ中性グレー       |

---

## 4. 赤系 signatureColor の設計戦略パターン

4テーマの分析から、赤系 signatureColor を扱う戦略は **3パターン** に分類できる。

### パターン1: signatureColor → Keyword（gruvbox / monokai-pro）

```
signatureColor(H≈20°〜345°) → Keyword に配置
残りのゾーンは非赤系の標準的な Hue で合成:
  Function ← 黄緑系（H≈110°〜125°）
  String   ← 黄系（H≈60°〜110°）
  Type     ← 水色系（H≈185°〜200°）
  Constant ← 紫・ラベンダー系（H≈270°〜345°）
```

**利点:**

- 赤 = 制御（keyword）という意味論的整合性がある（制御フローは注意・警告の色）
- diag.error（赤固定）との差別化は **L/C で可能**（keyword: L≈0.65 vs diag.error: L≈0.55）
- gruvbox・monokai-pro（広く使われているテーマ）が採用しており実証済み

**欠点:**

- diag.error と同 Hue になるリスクは残る
- 業界標準（keyword=紫）を外れるため見慣れない人には違和感

### パターン2: signatureColor → Function（rose-pine）

```
signatureColor(H≈15°) → Function に配置
Keyword には補色方向（H≈195°, teal）を使う:
  Function ← signatureColor（ローズ/ピンク）
  Keyword  ← teal（H≈195°, signatureH + 180°の補色）
  String   ← gold（H≈55°, signatureH + 40°の類似色）
  Type     ← foam（H≈195°, Keyword と近いが L 差あり）
```

**利点:**

- signatureColor がそのままテーマの「顔」として Function に現れる
- diag.error との混同ゼロ（Function は Error と別の意味）
- 補色配置（function:ピンク ↔ keyword:teal）が視覚的に美しい

**欠点:**

- Function = 青という業界標準を大きく外れる
- Keyword = teal（H≈195°）は Type（H≈185°）と Hue が近すぎる問題

### パターン3: 単色化（reddish.nvim）

```
全構文色を signatureColor の Hue 範囲（H: 15°〜35°）内で展開
差別化は L のみ（明度段差で読み分け）
```

**用途:** 「世界観全振り」テーマ専用。一般的な使用には向かない。

---

## 5. oshicolor 判断B/A/C への示唆

### 判断B: signatureColor が赤系（H: 0°〜25°）の処理 ← 今回の主テーマ

**推奨: パターン1（signatureColor → Keyword）を採用**

理由:

1. **gruvbox・monokai-pro が同じ選択をしており実績がある**
2. diag.error（`OKLch(L=0.55, C=0.20, H=25°)`）との差別化は L+C で可能:
   - keyword: `OKLch(L≈0.65〜0.72, C≈0.18〜0.27, H≈signatureH)`
   - 差: ΔL ≥ 0.10、視覚的に十分区別できる
3. Function を「赤に近い Hue」にしてしまう（rose-pine 方式）と、
   「Function = 青」という期待を持つユーザーに混乱を与えるリスクが高い

**具体的な実装案:**

```
signatureColor が H ∈ [0°, 35°] の場合:
  keyword ゾーン = signatureColor の H をそのまま使う（クランプのみ適用）
  function ゾーン = 合成（canonical: 225°）
  diag.error との差別化:
    → diag.error は L=0.55 固定
    → keyword は L = clamp(signatureColor.L, 0.65, 0.82) → L ≥ 0.65 を保証
    → ΔL ≥ 0.10 を確認（不足なら keyword の L を強制的に +0.10）
```

**検討すべき追加ルール:**

```
赤系 signatureColor の場合のゾーン再配置:
  constant(55°) と signatureColor(20°) が近すぎる問題:
    → constant ゾーンは "keyword から +35°" で合成する
    → OKLch(L=signatureL_clamp, C=signatureC_clamp, H=signatureH + 35°)
    → 例: signature が H=20° なら constant は H=55°（橙）← ちょうどよい
```

### 判断A: constant / identifier ゾーンの重複問題

**gruvbox の観察:**

- gruvbox は Function と String を**同色**（同じ H=110°）にしており、「重複を許容する」選択をしている
- これが実用上問題にならないのは、**bold** や **italic** などのスタイル修飾で差別化しているから

**示唆:**

- constant(H≈55°) と identifier(H≈90°) が競合する場合、**L で分離する**戦略は正しい
  - constant: L を signatureColor.L に合わせる（暖色・具体性）
  - identifier: L = constant.L + 0.08 でシフト（より明るい）
- 統合案（5ゾーン化）より**6ゾーン維持 + L 差分離**の方が表現力が高い

### 判断C: 合成色の L_target

**4テーマの構文色 L 分布:**

| テーマ       | 構文色 L 範囲           | 中央値                     |
| ------------ | ----------------------- | -------------------------- |
| reddish.nvim | 0.43〜0.83              | 0.63（L の段差で意味分け） |
| rose-pine    | 0.46〜0.82（pine 除く） | 0.78                       |
| gruvbox      | 0.52〜0.89              | 0.72                       |
| monokai-pro  | 0.65〜0.89              | 0.78                       |

**示唆:**

- `clamp(signatureColor.L, 0.65, 0.85)` が実績から妥当な範囲
- reddish.nvim のように L を段差として使うのは意図的な設計が必要
- **L_target の下限 0.65 は最低ライン**（gruvbox の Keyword が L≈0.52 で低すぎると感じられる）

---

## 6. まとめ：赤系テーマの設計哲学の3分類

```
         Hue 多様性
         高い（7ゾーン以上活用）
              ↑
              │  monokai-pro: 赤をKeywordに。虹色展開
              │  rose-pine:   赤をFunctionに。補色でKeyword=teal
              │  gruvbox:     赤をKeywordに。Function/String=黄緑
              │
              ↓
         低い（Hue 単色）
              │  reddish.nvim: 全色 H=20°〜30°。L だけで差別化
```

**oshicolor v4 への最終推奨（赤系 signatureColor の場合）:**

1. signatureColor (H: 0°〜35°) → **keyword ゾーンに割り当てる**（gruvbox/monokai-pro 方式）
2. function/string/type は **canonical Hue で合成**（標準配置を維持）
3. constant は `signatureH + 35°` で合成して橙系に自動調整
4. diag.error との差別化: `keyword.L ≥ diag.error.L + 0.10` を保証するチェックを追加

```
// 疑似コード
if (signatureH >= 0 && signatureH <= 35) {
  // 赤系 signatureColor の特別処理
  keywordColor = OKLch(max(signatureL, diagErrorL + 0.10), signatureC, signatureH);
  constantColor = OKLch(signatureL_clamp, signatureC_clamp, signatureH + 35);
  // 残り (function, string, type, identifier) は canonical で合成
}
```
