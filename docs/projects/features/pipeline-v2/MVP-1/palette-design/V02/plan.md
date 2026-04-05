# MVP-1/palette-design/V02 最近傍テーマベース + AI 色上書き

## なぜ V02 が必要か

V01（隙間充填）は色相環上で均等に色を散らすが、「この色の隣にはこういう色が合う」という配色の知識がない。
ghostty 同梱の 437 テーマ（ネタテーマ除外済）は人間のデザイナーが「合う」と判断した配色の集合であり、この知恵を借りることで色の調和が自然になる可能性がある。

### 理論的根拠: 調和の保存 (Harmony Preservation)

> 437 テーマは **既に調和している** と仮定する。
> 置き換える色が元の色に **知覚的に近い** なら、調和は数学的に保存される。

つまり「近いテーマを見つけて AI 色で上書きする」= 「調和を最小限壊す」。

参考:
- Cohen-Or et al.「Color Harmonization」(SIGGRAPH 2006) — 色相環テンプレートによる調和判定
- O'Donovan et al.「Color Compatibility From Large Datasets」(SIGGRAPH 2011) — ML による調和予測

## 前版との変更対照表

| 項目 | V01 | V02 |
|---|---|---|
| color4〜7 の導出 | 色相環の隙間充填 | 最近傍テーマの palette から取得 |
| color8 | hue 25° 固定 | 最近傍テーマの palette 1 (red) |
| 距離計算の色空間 | OKLCH (極座標) | **Oklab (直交座標)** |
| マッチング対象 | accent 3 色のみ | **accent 3 色 + bg + fg = 5 色** |
| スロット割り当て | 固定 | **自由 (120 通り総当たり)** |
| 依存データ | なし | ghostty 437 テーマ (プリコンパイル) |
| 結果の予測可能性 | 高い（アルゴリズム的） | 低い（テーマ依存） |

## 設計方針

- 距離計算には **Oklab (L, a, b)** を使う。OKLCH の色相 wrap-around 問題を回避
- マッチングは **bg/fg + accent 3 色 = 5 色** を入力とする。bg/fg の重みを高くする
- AI 3 色のスロット割り当ては **固定しない**。6 スロットから 3 つ選ぶ全 120 通りを試す
- 選択後、borrowed 色の L/C を AI 3 色の統計に合わせて微調整する
- neutral 派生、UI ロール割り当て、コントラスト保証は V01 と共通

## AI 出力スキーマ（入力）

V01 と同一。

## パレット生成アルゴリズム

### Step 1: 事前準備（ビルド時に 1 回）

437 テーマの palette 1〜6 + bg + fg を全て **Oklab** に変換してプリコンパイルする。

### Step 2: AI 出力を Oklab に変換

```
primary.hex   → Oklab (L₁, a₁, b₁)
secondary.hex → Oklab (L₂, a₂, b₂)
tertiary.hex  → Oklab (L₃, a₃, b₃)
bg_base_hex   → Oklab (Lbg, abg, bbg)
fg_base_hex   → Oklab (Lfg, afg, bfg)
```

### Step 3: 最近傍テーマを検索

437 テーマそれぞれについてスコアを計算し、最小のテーマを選ぶ。

```
score(theme) =
    oklabDist(AI_bg, theme.bg) × W_bg +
    oklabDist(AI_fg, theme.fg) × W_fg +
    minPermutationDist(AI_accents, theme.palette[1..6])
```

**bg/fg の重み:**

```
W_bg = 5
W_fg = 5
```

bg/fg は画面の最大面積を占める。ここが合わなければ全体が破綻する。

**アクセントの自由スロットマッチング:**

```
AI_accents = [color1, color2, color3]
theme_slots = [palette[1], palette[2], palette[3], palette[4], palette[5], palette[6]]

6色から3色を選ぶ順列 = 6×5×4 = 120 通り

minPermutationDist = min over all 120 permutations of:
    oklabDist(color1, slot_i) + oklabDist(color2, slot_j) + oklabDist(color3, slot_k)

同時に最小を達成した (i, j, k) = 最適なスロット割り当て
```

**Oklab ユークリッド距離:**

```
oklabDist(a, b) = sqrt((L₂-L₁)² + (a₂-a₁)² + (b₂-b₁)²)
```

OKLCH の色相角 wrap-around 問題がない。culori が Oklab に対応済み。

**計算量:**

```
437 テーマ × 120 通り = 52,440 回の距離計算
→ 実測 < 1ms（十分にリアルタイム）
```

### Step 4: テーマの palette を割り当て + AI 色で上書き

Step 3 で最適スロット割り当て (i, j, k) が決まる。

```
color1 = AI primary       (palette[i] を上書き)
color2 = AI secondary     (palette[j] を上書き)
color3 = AI tertiary      (palette[k] を上書き)
残り 3 色 = テーマの palette から借りる (string, special, error 等)
```

**残り 3 色の syntax role 割り当て:**

借りた 3 色を bat の ansi.tmTheme に基づいてロールに割り当てる:

| palette | bat スコープ | oshicolor slot |
|---|---|---|
| 1 (red) | tag, deleted, error | color8 |
| 2 (green) | string, comment | color4 |
| 3 (yellow) | constant, numeric, class | (AI で上書きされなかった場合) |
| 4 (blue) | entity.name.function | (AI で上書きされなかった場合) |
| 5 (magenta) | keyword, storage | (AI で上書きされなかった場合) |
| 6 (cyan) | parameter, support.function | color6 |

AI 3 色が どの 3 スロットに入るかは動的に決まるので、残りの割り当ても動的になる。

### Step 5: 派生色 (color5, color7)

ghostty は 6 色だが oshicolor は 8 色必要。
palette 3 (constant/type) と palette 6 (parameter/special) が 2 つの role を兼ねている。
同一色相で L/C を微調整して区別する:

```
color5 (type):
  借りた constant 系の色から L を ±0.08 で派生

color7 (parameter):
  借りた special 系の色から C を ×0.8 で派生
```

### Step 6: borrowed 色の L/C 調整

テーマの borrowed 色は元のテーマの bg/fg とのバランスで設計されている。
AI の bg/fg に変わるため、L/C を微調整して馴染ませる:

```
AI 3 色の L 中央値 = L_med
AI 3 色の C 中央値 = C_med

各 borrowed 色について:
  L の差分 = (borrowed.l - theme_accent_L_median) を保持したまま
  新しい L = L_med + 差分
  C は C_med × (borrowed.c / theme_accent_C_median) でスケーリング
```

### Step 7: variant, neutral, ui

V01 と同一のロジックを適用:
- variant 生成（color1_variant, color3_variant）
- neutral 検証・補正 + 派生
- UI ロール割り当て（assignUiRoles）
- コントラスト保証（ensureContrast）

## メリット・リスク

**メリット:**
- 人間のデザイナーが「合う」と判断した配色の知恵を借りられる（調和の保存）
- AI 3 色のスロットを固定しないので、最適な位置に自動配置される
- bg/fg の重み付けで「額縁」の調和を優先できる

**リスク:**
- 最近傍テーマの残り色が AI 3 色と調和しない場合がある
- テーマ依存のため結果の予測可能性が低い
- 437 テーマデータをプリコンパイルして組み込む必要がある

## V01 との比較検証

24 キャラの SVG 検証で V01（隙間充填）と V02（最近傍テーマ）を並べて出力し、比較する。
最終的にどちらか一方を採用、またはユーザーが選べるようにする可能性もある。

## やること

- [ ] 437 テーマの Oklab プリコンパイルデータ生成
- [ ] Oklab 距離計算ユーティリティ
- [ ] 自由スロットマッチング（120 通り総当たり）
- [ ] テーマ palette → 8 色割り当て（動的スロット対応）
- [ ] borrowed 色の L/C 調整ロジック
- [ ] color5, color7 の派生ロジック
- [ ] V01 との比較 SVG 出力
