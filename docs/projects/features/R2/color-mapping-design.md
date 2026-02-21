# カラーマッピング設計書

`color-mapper.ts` が何をどの順番でやっているかを解説するドキュメント。

---

## 全体の流れ

```
ColorPoint[]（抽出色・最大12色）
        │
        ▼
  OKLch 変換（L/C/H の数値に変換）
        │
        ▼
  ── 前処理（基準3色を確定）──────────────────────
  │  L最小 → Normal.bg
  │  L最大 → Normal.fg
  │  残りでC最小 → Comment
  └──────────────────────────────────────────────
        │
        ▼
  accents = 残りをC降順に並べたリスト
        │
        ├──── Zone A（抽出色を直接割り当て）
        │     C1位 → Keyword
        │     C2位 → Function
        │     C3位 → Special
        │
        └──── Zone B（補完色を生成）
              accents[3]以降を候補として
              String / Type / Number の Hue を補完

        ↓
  HighlightMap（全ハイライトグループ）
```

---

## Zone A：抽出色を直接割り当て

Hue（色相）を一切参照せず、**C値（彩度）の順位だけで** 割り当てる。

```
accents[0] → Keyword   （C最大。キャラクター象徴色）
accents[1] → Function  （C2位）
accents[2] → Special   （C3位）
```

### なぜ Hue を使わないのか

旧設計（v1）は「紫なら Keyword」のように Hue レンジで分類していた。
紫系キャラクターのように **全色が同じ Hue 帯**に集中するパレットでは
全色が同じグループに落ちて崩壊した。

C値のランクは Hue に依存しない。全色が同 Hue でも C の順位は一意に決まる。

---

## Zone B：補完色の生成

Neovim テーマでは `@string`（緑系）/ `@type`（水色系）/ `@number`（黄金系）が
慣習的に異なる Hue を持つ。キャラクターパレットにこれらの Hue がなくても
「同じ世界の空気感」を保ちながら補完色を生成する。

```
ZONE_B_TARGETS = [
    { group: "String", targetHue: 130, hueRange: 45 },  // 緑系
    { group: "Type",   targetHue: 195, hueRange: 45 },  // 水色系
    { group: "Number", targetHue:  55, hueRange: 45 },  // 黄金系
]
```

### 各グループの処理フロー

```
① accents[3] 以降（zoneBCandidates）に
  targetHue ± 45° 内の抽出色があるか？
      ↓ある         ↓ない
   その色を使う    ② 補完色を生成
```

### ② 補完色の生成方法

キャラクター象徴色（`accents[0]` = Keyword の色）を基準にして、
L と C を引き継ぎつつ Hue だけ変える。

```
L = max(bgL + 0.35, signatureL + 0.08)
      ↑ bg より 0.35 明るく保証（暗すぎる色を防ぐ）

C = max(signatureC × 0.35, 0.06)
      ↑ 象徴色の 35% の彩度（脇役色として控えめに）
      ↑ 最低でも 0.06 は保証（C_FLOOR）

H = targetHue（固定）
```

その後 sRGB ガマットに収める（`clampChroma`）。
クランプで C が 0.06 を下回ったら H を +20° ずらして再試行。
それでも不足なら C を 0.06 に固定する。

---

## フォールバックシステム

抽出色が少ないとき（count 件取れないとき）に各ゾーンが崩れないよう
段階的に代替色を用意する。

### どこで不足が起きるか

```
前処理で 3色を使う（bg, fg, comment）
Zone A で最大 3色を使う（keyword, function, special）
Zone B で最大 3色を使う（string, type, number）

合計 最大 9色 必要。抽出が 4色なら Zone A は 1色しかない。
```

### 各グループのフォールバック

```
┌────────────────────────────────────────────────────────┐
│ 前処理の 3色は必ず確保できる                            │
│   bg・fg: L最小/最大なので常に存在                      │
│   comment: remaining が 0 色なら null になる            │
│     → null の場合 shiftL(fg, -0.20) で派生             │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ Zone A（accents が不足する場合）                        │
│   accents[0] がない → shiftL(fg, -0.05) を Keyword に  │
│   accents[1] がない → shiftL(fg, -0.10) を Function に │
│   accents[2] がない → shiftL(fg, -0.15) を Special に  │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ Zone B（候補色がない場合）                              │
│   zoneBCandidates が空 or target Hue 付近の色がない     │
│   → 象徴色（Keyword の色）を基準に補完色を生成          │
│   → 象徴色も存在しない場合は上記 Zone A フォールバックの │
│     shiftL 色を象徴色として使用                        │
└────────────────────────────────────────────────────────┘
```

### フォールバックの優先順位まとめ

| グループ | 1st（抽出色あり） | 2nd（不足時） |
|---|---|---|
| Comment | C最小の抽出色 | `shiftL(fg, -0.20)` |
| Keyword | `accents[0]` | `shiftL(fg, -0.05)` |
| Function | `accents[1]` | `shiftL(fg, -0.10)` |
| Special | `accents[2]` | `shiftL(fg, -0.15)` |
| String | `accents[3+]` の緑系色 | Zone B 生成 |
| Type | `accents[3+]` の水色系色 | Zone B 生成 |
| Number | `accents[3+]` の黄金系色 | Zone B 生成 |

---

## 実例：4色抽出のケース

```
抽出色:
  #57151e  Chocolate Cosmos  41.94%
  #7f549e  Royal Lilac       24.27%
  #c1a4c1  Novel Lilac        8.10%
  #d5233f  Lollipop           0.04%
```

```
前処理:
  L最小 #57151e → Normal.bg
  L最大 #c1a4c1 → Normal.fg
  残り [#7f549e, #d5233f] のうち C最小 #7f549e → Comment
  usedHexes = {#57151e, #c1a4c1, #7f549e}

accents（C降順）= [#d5233f]  ← 残り1色のみ

Zone A:
  accents[0] = #d5233f → Keyword           ← 抽出色
  accents[1] = なし    → shiftL(fg, -0.10) ← フォールバック
  accents[2] = なし    → shiftL(fg, -0.15) ← フォールバック

Zone B（zoneBCandidates = [] で全て生成）:
  象徴色 = #d5233f（Keyword, 赤）を基準に
  String  → H=130° で生成 → #849c6c（緑系）
  Type    → H=195° で生成 → #58a1a0（水色系）
  Number  → H=55°  で生成 → #b68767（黄金系）
```

---

## 設計の意図まとめ

```
Zone A: 「キャラクターの色をそのまま使う」ゾーン
         抽出色があれば確実に使われる。Hue 非依存で崩れない。

Zone B: 「構文色の多様性を補完する」ゾーン
         キャラクターパレットに緑/水色/黄が含まれれば優先使用。
         なければ象徴色（Keyword）から派生生成。

フォールバック: 「どんなに抽出色が少なくても崩れない」安全網
         1色しか抽出できなくても全グループに色が入る。
```
