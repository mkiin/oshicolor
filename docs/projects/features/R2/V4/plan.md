# R2 設計プラン v4：node-vibrant × Hue ゾーンスコアリング

> 作成日: 2026-02-23
> 前提ドキュメント: r2-plan-v3.md / r2-remaining-issues-v2.md / highlight-group-color-strategy.md

---

## 1. なぜ v4 が必要か

v3 は「bg を neutral 生成に切り替える」という重要な修正を施した。
しかし色抽出そのものは **k-means** のままで、アクセント色の割り当ては
「C 降順で accents[0]=keyword、[1]=function…」というランク方式だった。

### v3 の根本的な限界

```
v3 の割り当て方式:
  accents[0] (C最大) → keyword
  accents[1] (C2位)  → function
  accents[2] (C3位)  → special

問題: Hue 制約がない
  → C最大の色がどんな Hue であろうと keyword に入る
  → 橙が keyword になる、緑が function になる、等が起きうる
  → string/type/number は Zone B で補完するが、
    Zone A の3色と Hue が近すぎる or 遠すぎるケースが多い
```

また k-means による抽出は「代表色の多様性」に限界があり、
特に単色系キャラクターで同 Hue の色が大量に重複して抽出される問題があった。

---

## 2. v4 の核心：node-vibrant への切り替え

### なぜ node-vibrant か

node-vibrant の MMCQ（Modified Median Cut Quantization）は
RGB 色空間を 2 段階の優先度で再帰分割し、最大 **64 色**の代表 Swatch を生成する。

```
Phase 1 (48色): population（ピクセル数）優先の分割
  → 画像に多く現れる色を漏れなくカバー

Phase 2 (16色): population × volume 優先の分割
  → 少ないが多様性のある色もカバー

結果: 主要色 + 多様色 の両方を 64 色でバランスよく代表できる
```

k-means の「最大 12 色」に比べ、64 色は**全 Hue ゾーンを探索できる解像度**がある。

### DefaultGenerator は使わない

node-vibrant の DefaultGenerator は L/S 範囲のみで 6 スロットを分類する
（Vibrant / DarkVibrant / LightVibrant / Muted / DarkMuted / LightMuted）。
**Hue 情報を使わない**ため、カラースキーマには流用できない。

v4 では MMCQ の出力（64 Swatch[]）だけを受け取り、
**カラースキーマ専用のスコアリングを自作する**。

---

## 3. アニメ調テーマ事例（参考）

### 既存の "アニメ寄り" Neovim テーマ

色の方向性を決める前に、アニメ・サブカルチャー系のカラースキーマがどんな
Hue / L / C の構成を取っているかを把握しておく必要がある。

| テーマ                           | 傾向                                           | 参考ポイント                              |
| -------------------------------- | ---------------------------------------------- | ----------------------------------------- |
| **Catppuccin** (Mocha/Macchiato) | パステル・低彩度だが鮮やか、Mocha は bg が暗め | 彩度を抑えながら視認性を保つ配色の手本    |
| **Rose Pine**                    | 暖色系・柔らかい、ピンク・ゴールドが主役       | L低めの紫/ピンクで keyword を表現         |
| **Tokyonight**                   | 青紫系、日本の夜景イメージ                     | 冷色系でも syntax が鮮やかに見える配置    |
| **Kanagawa**                     | 和の渋い色調、波/竜/蓮の 3 変種                | dragon テーマがアニメの「陰キャ系」に近い |
| **Fluoromachine**                | ネオン・レトロ、高彩度                         | 彩度全開テーマの限界点を学べる            |

### アニメ調テーマの色の特徴（観察）

Catppuccin（Mocha）の構文色 Hue を測定すると：

```
rosewater (#f5e0dc) H≈15°  → Number/Identifier
flamingo  (#f2cdcd) H≈5°   → @variable.builtin
pink      (#f5c2e7) H≈330° → @keyword.operator
mauve     (#cba6f7) H≈270° → Keyword  ← 紫・定番
red       (#f38ba8) H≈355° → @exception
peach     (#fab387) H≈25°  → Number
yellow    (#f9e2af) H≈50°  → @type.builtin
green     (#a6e3a1) H≈125° → String   ← 緑・定番
teal      (#94e2d5) H≈175° → @variable.member
sky       (#89dceb) H≈190° → @keyword.import
sapphire  (#74c7ec) H≈200° → @constructor
blue      (#89b4fa) H≈220° → Function ← 青・定番
lavender  (#b4befe) H≈240° → @variable.parameter
```

**観察**: kanagawa/tokyonight と同じ Hue マッピングを採用している。
`string=緑(130°)`, `function=青(220°)`, `keyword=紫(280°)` は
**業界横断で収束している事実上の標準**。

Catppuccin がアニメ系ユーザーに人気な理由は Hue 配置よりも
**L が全体的に高め（0.70〜0.90）・C が中程度（0.10〜0.25）** という
「明るくてパステルよりも鮮やか」な域値にある。

### oshicolor への示唆

アニメキャラクターのイラストの色は：

- 明るいハイライト（L=0.80〜0.90）
- 鮮やかな基本色（L=0.55〜0.75, C=0.15〜0.30）
- 深い影（L=0.20〜0.40, C=0.10〜0.20）

という 3 層構造が多い。構文色として使いやすいのは中間層（基本色）。
Catppuccin の成功は「基本色レンジを構文色に持ってきた」設計にある。

---

## 4. 設計の核心：何を抽出し、何を派生させるか

v4 の根本的な設計方針：

```
抽出する（64 Swatch から取る）:
  - signatureColor（キャラクターを最も代表する色）
  - bg 候補（暗い・低彩度のクラスター）
  - fg 候補（明るい・低彩度のクラスター）
  - 各 Hue ゾーンで実在する色（あれば）

派生・合成する（算出する）:
  - signatureColor が見つからないゾーンの構文色
  - comment（signatureHue + 低 C で算出）
  - bg 階調（bg から L をシフト）
  - Diagnostic / Diff（固定値。画像非依存）
```

### なぜこの分担か

64 色から全 7 ゾーンを埋めようとしても、
アニメキャラのイラストでは 2〜3 ゾーンしかカバーされない場合が多い。
残りは必然的に合成になる。

その合成色を「signatureColor の L/C を継承」することで、
合成色がキャラクターの雰囲気（明るさ感・鮮やかさ感）を保つ。

> **signatureColor は「テーマのエネルギーテンプレート」。**
> その L と C が、全合成色の「明るさ」と「鮮やかさ」を決定する。

---

## 5. Step 1：signatureColor の抽出

### スコアリング式

```
signatureScore(swatch) = swatch.C² × (swatch.population / maxPopulation)

フィルタ:
  L ∈ [0.40, 0.85]  （bg/fg の極端な色を除外）
  C > 0.08           （無彩色を除外）
```

### C² にする理由

キャラクターの髪色（C=0.25, pop=15%）と背景の暗色（C=0.03, pop=40%）の比較：

```
背景: 0.03² × 0.40 = 0.00036
髪:  0.25² × 0.15 = 0.00938  ← 約 26 倍高い
```

C を 2 乗することで、低彩度の高人口色（背景）が
高彩度の低人口色（キャラクターの特徴色）に勝てなくなる。

### bg / fg の抽出（signatureColor とは独立して行う）

```
bg候補フィルタ:  L < 0.25  かつ  C < 0.05
bgスコア:        (population / maxPop) × (1 - C / 0.05)  （低 C ほど高得点）

fg候補フィルタ:  L > 0.72  かつ  C < 0.08
fgスコア:        (population / maxPop) × (1 - C / 0.08)

候補なし → generateNeutral(targetL, signatureHue)  （v3 方式を継承）
```

---

## 6. Step 2：Hue ゾーン定義

kanagawa / tokyonight / catppuccin の実測値から導出した 6 ゾーン。

| ゾーン       | 役割                   | 中心 H° | 幅（±） | 対応クラスター                |
| ------------ | ---------------------- | ------- | ------- | ----------------------------- |
| `function`   | 関数・メソッド         | 225°    | ±35°    | Function / @function          |
| `keyword`    | 予約語・制御           | 285°    | ±30°    | Keyword / Statement           |
| `string`     | 文字列・文字           | 140°    | ±35°    | String / Character            |
| `type`       | 型・インターフェース   | 185°    | ±25°    | Type / @type                  |
| `constant`   | 定数・数値・真偽値     | 55°     | ±45°    | Constant / Number / Boolean   |
| `identifier` | フィールド・プロパティ | 90°     | ±25°    | Identifier / @variable.member |

**special（区切り記号・句読点）は独立ゾーンとして扱わない。**
kanagawa の springBlue（special）と crystalBlue（function）は H で 18° しか離れていない。
`special = function の色を C × 0.6 に落としたもの` として派生させる。

### ゾーンが重なる問題

`constant`（10°〜100°）と `identifier`（65°〜115°）はオーバーラップする。
これは kanagawa の surimiOrange（H=35°）と carpYellow（H=70°）に相当し、
実際の差異は **H の差 35° + L の差 0.02** という微妙なものだ。

**対処**: constant と identifier の候補が競合する場合、
より L の低い（相対的に暗い）方を constant、高い方を identifier に割り当てる。
（surimiOrange の L=0.78 < carpYellow の L=0.80 に対応）

---

## 7. Step 3：各ゾーンの選択スコアリング

### signatureColor の配置

signatureColor の H が属するゾーンを特定し、そのゾーンを「実色スロット」として確保する。
signatureColor は **L/C をほぼそのまま使う**（可読性クランプのみ適用）。

```
可読性クランプ（dark theme 前提）:
  L = clamp(signatureColor.L, 0.58, 0.82)
  C = clamp(signatureColor.C, 0.08, 0.25)
```

### 残りゾーンのスコアリング

signatureColor が確保したゾーン以外の 5 ゾーンについて、
64 Swatch の残りから候補を探す。

```
candidateScore(swatch, zone) =
  (1 - |swatch.L - L_target| / 0.25) × 3.0     // 明度の近さ
  + min(swatch.C / 0.10, 1.0) × 2.0             // 彩度の十分さ（0.10以上で満点）
  + (swatch.population / maxPop)^0.3 × 1.0      // 人口の弱いボーナス

フィルタ: swatch.H が zone の [center - width, center + width] 内
          かつ signatureColor として未使用

L_target = clamp(signatureColor.L, 0.62, 0.78)
           （signatureColor の明るさを継承しつつ可読域を保証）
```

**重み比（3 : 2 : 1）の意味**:

- 明度が最優先なのは「暗すぎる/明るすぎる構文色は読めない」から
- 彩度は次に重要、ただし満点基準を 0.10 と低めに設定（アニメ色は十分鮮やか）
- 人口は参考程度。多い色よりも適切な色を優先する（node-vibrant のオリジナル設計思想と同じ）

### フォールバック：合成

候補ゾーン内に Swatch がゼロの場合：

```
synthesize(zone) = OKLch(
  L = clamp(signatureColor.L, 0.62, 0.78),
  C = clamp(signatureColor.C, 0.10, 0.20),
  H = zone.canonical
)
```

signatureColor の L/C を継承することで、
合成色でもキャラクターの「エネルギー感（明るさ・鮮やかさ）」が保たれる。

---

## 8. Step 4：comment・Diagnostic・Diff

### comment

常に合成。signatureHue を引き継ぐことで bg との統一感を持たせる。

```
comment = OKLch(L=0.48, C=0.04, H=signatureHue)
```

### Diagnostic（固定値・画像非依存）

WCAG コントラスト要件と「赤=error」の意味論的慣習から固定。

```
diag.error   = OKLch(L=0.55, C=0.20, H=25°)   ← 赤
diag.warning = OKLch(L=0.72, C=0.18, H=70°)   ← 橙-黄
diag.info    = OKLch(L=0.68, C=0.15, H=230°)  ← 青
diag.hint    = OKLch(L=0.70, C=0.12, H=190°)  ← 水色
```

### Diff（固定値）

diff の背景色は低彩度・暗めで「目立ちすぎない」ことが重要（kanagawa の winter 系）。

```
diff.add    = OKLch(L=0.20, C=0.04, H=135°)  ← 暗緑
diff.delete = OKLch(L=0.20, C=0.04, H=25°)   ← 暗赤
diff.change = OKLch(L=0.20, C=0.04, H=230°)  ← 暗青
```

---

## 9. ハイライトグループへのクラスター展開

各スロットがどのグループを担当するか：

```
function  → Function / @function / @function.method / @function.call
keyword   → Keyword / Statement / Conditional / @keyword / @keyword.return(bold)
string    → String / Character / @string / @string.regexp
type      → Type / @type / @type.definition / Typedef
constant  → Constant / Number / Boolean / Float / @constant / @number
identifier → Identifier / @variable.member / @property / @tag.attribute
special   → Special / Delimiter / @punctuation / @operator
           （= function スロット色の C × 0.6）

@variable → none（Normal.fg を継承。色を付けない）
comment   → Comment / italic
```

**`@variable = none` は両スキーマ共通の最重要パターン。**
変数は最頻出トークンなので色を付けると目が疲れる。

---

## 10. 未解決の問題・設計上の判断待ち

### 判断A: constant / identifier の分離をどう保証するか

両ゾーンは H 空間で重なる。候補が競合した場合の分離ロジックを
「L の相対比較」で行うが、実際にうまくいくか検証が必要。

**代替案**: constant と identifier を統合して 5 ゾーンにし、
identifier は constant を L +0.08 でシフトして派生させる。

### 判断B: signatureColor が赤系（H: 0°〜25°）の場合

赤髪キャラの signature が diag.error（赤）と視覚的に混同されるリスクがある。

**候補**:

- 赤系 signature を最も近い「安全ゾーン」constant（55°）に押し込む
- signature に赤を許容し、diag.error の L/C を大きく変えて差別化する

### 判断C: 合成の L_target をどこから取るか

- `clamp(signatureColor.L, 0.62, 0.78)` → キャラクターの雰囲気を継承
- 固定値 `0.70` → テーマとしての安定性優先

キャラクターの色が非常に暗い（L=0.40）場合、継承方式では全合成色が
暗めになりすぎるリスクがある。

**候補**: `max(clamp(signatureColor.L, 0.58, 0.82), 0.65)` のような二重クランプ。

---

## 11. v3 との設計継続部分

v4 は v3 を捨てるのではなく、以下の v3 の成果を引き継ぐ：

| v3 の成果                                                   | v4 での継承  |
| ----------------------------------------------------------- | ------------ |
| bg を neutral 生成（signatureHue + C=0.02）                 | そのまま継承 |
| コンセプトシステム（darkClassic / darkMuted / lightPastel） | 引き続き採用 |
| bg からの階層的 L シフト（CursorLine / Visual 等）          | そのまま継承 |
| Diagnostic / Diff 固定値                                    | そのまま継承 |

**v4 で新しく変わる部分:**

- 色抽出: k-means(12色) → node-vibrant MMCQ(64色)
- アクセント割り当て: C ランク方式 → Hue ゾーンスコアリング

---

## 12. 全体フロー（まとめ）

```
入力: 画像

Step 1: node-vibrant MMCQ → Swatch[] 64色
          各 Swatch を OKLch(L/C/H) に変換

Step 2: bg / fg 抽出（L/C フィルタ + 人口スコア）
         → なければ generateNeutral(targetL, signatureH)

Step 3: signatureColor 抽出（C² × pop_ratio）
         → 自然な Hue ゾーンに配置

Step 4: 残り 5 ゾーンを 64色から探索
         → 候補あり: L/C/pop スコアで最良を選択
         → 候補なし: OKLch 合成（sigL/sigC を継承）

Step 5: special = function の C × 0.6 で派生

Step 6: comment = OKLch(L=0.48, C=0.04, H=signatureH)

Step 7: Diagnostic / Diff = 固定値

Step 8: クラスター展開
         → 6スロット × クラスターを HighlightMap に変換
         → @variable = none

出力: HighlightMap（Neovim vim.api.nvim_set_hl 形式）
```
