# V01 palette-design 未解決 Issue

## 修正済み

### ~~BUG-1: error 色 (c8) が primary と重複する~~ ✅

`resolveErrorHue()` を追加。赤系範囲 (0°〜55°) 内で primary から最も離れた hue を自動選択。

### ~~BUG-2: 低彩度 tertiary が stabilizeHue をすり抜ける~~ ✅

`achromaticThreshold(l)` で L に応じた動的閾値に変更。Acheron (L=0.24) と Albedo (L=0.93) を修正。

### ~~WARN-1: gap-filled 色間の弁別性不足~~ ✅ (部分的)

L Jitter zigzag + enforceMinHueGap バネモデル + fixDiscrimination 自動修正。
4キャラ→26キャラへの拡大で多くのケースが改善したが、構造的限界が発覚 → ISSUE-3, ISSUE-4 参照。

### ~~BUG-3: ensureContrast が dark 方向のみ~~ ✅

bg の L で探索方向を自動判定 (dark: L↑, light: L↓) に修正。

### ~~BUG-4: NEUTRAL_LIMITS が dark 固定~~ ✅

theme_tone 自動検出 (`detectThemeTone`) と dark/light 両対応の CONFIG に統一。

### ~~BUG-5: computeGaps が重複 hue で 360° ギャップを複製~~ ✅

`mergeCloseHues()` (5° 以内をマージ) を gap 計算前に追加。
Clorinde (279°, 277°) や DrRatio (277°, 277°) の gap-fill 分散が改善。

### ~~TODO-1: 弁別性警告の自動修正~~ ✅

`fixDiscrimination()` として実装。

### ~~TODO-2: 24 キャラの SVG 検証~~ ✅

26 キャラ (原神 13 + スタレ 13) で検証完了。結果は下記。

---

## 24 キャラ検証結果サマリ (26 キャラ)

### 全クリア (18/26)

Albedo, Amber, Yanfei, Navia, Baizhu, Furina, Clorinde, Chevreuse,
Acheron, Argenti, Lingsha, Huohuo, Anaxa, Gepard, DrRatio, BlackSwan,
Yoimiya, Klee (Klee は c2↔c3 ΔE=0.071 が残るが borderline)

### Discrimination 警告あり (8/26)

| キャラ | tone | 警告数 | 最悪ペア | ΔE | 原因カテゴリ |
|---|---|---|---|---|---|
| Klee | light | 1 | c2↔c3 | 0.071 | seed 色が ensureContrast で収束 |
| Nahida | light | 2 | c2↔c3, c5↔c7 | 0.076 | 同上 + gap-filled 近接 |
| Faruzan | light | 2 | c1↔c2, c6↔c7 | 0.067 | seed 色が近接 + gap-filled 近接 |
| RaidenShogun | dark | 1 | c3↔c7 | 0.070 | gap-filled と seed が近接 |
| Hyacine | light | 1 | c4↔c6 | 0.067 | gap-filled 近接 |
| Guinaifen | dark | 2 | c2↔c8, c3↔c8 | 0.063 | seed/error が暖色に集中 |
| Luocha | dark | 2 | c1↔c3, c6↔c8 | 0.056 | primary≈tertiary (ΔH=6°) |
| Aglaea | light | 7 | c5↔c6 | 0.045 | seed 3色が全て hue≈90° |
| Kafka | dark | 4 | c4↔c7 | 0.042 | seed 3色が全て hue≈2° |

---

## 既知の課題

### ISSUE-1: bg/fg を AI 生成に依存せず自力で導出する

**深刻度:** 高
**影響範囲:** 全キャラ

現状 AI に `neutral.bg_base_hex` / `fg_base_hex` を出力させているが、どのキャラも似通った色になりキャラらしさが出ない。
impression 3色から bg/fg を自力で導出し、キャラの個性を反映させる方向へシフトする。

**対策案:**
- impression の dominant hue で bg を tint する（現状の clampNeutral に近いが、AI 出力に頼らない）
- fg も dominant hue から導出し、キャラごとの微妙な色味の違いを出す
- AI の VisionResultSchema から `neutral` フィールドを将来的に削除または optional 化

---

### ISSUE-2: UI クローム色（navigation 等）でカラースキームの個性を出す

**深刻度:** 高
**影響範囲:** 全キャラ

既存 Neovim カラースキームを観察した結果、`Normal` (エディタ bg) はどのスキームも似た色だが、
**UI クローム要素の色がスキームの個性を決めている**ことがわかった。
ここをしっかり詰め、キャラらしさを表現する。

**対象となる Neovim ハイライトグループ:**

| カテゴリ | グループ | 用途 |
|---|---|---|
| StatusLine | `StatusLine`, `StatusLineNC` | ステータスバー (アクティブ / 非アクティブ) |
| WinBar | `WinBar`, `WinBarNC` | ウィンドウ上部バー |
| TabLine | `TabLine`, `TabLineSel`, `TabLineFill` | タブ (非アクティブ / アクティブ / 余白) |
| File Tree | `NeoTreeNormal`, `NeoTreeWinSeparator` | NeoTree の bg/fg・境界線 |
| Terminal | `TermNormal`, `terminal_color_0`〜`terminal_color_15` | 組み込みターミナルの bg/fg・ANSI 16色 |
| Float | `NormalFloat`, `FloatBorder`, `FloatTitle` | フローティングウィンドウ |
| Window | `WinSeparator` | ウィンドウ間の区切り線 |
| Pmenu | `Pmenu`, `PmenuSel`, `PmenuSbar`, `PmenuThumb` | 補完メニュー |

**現状の問題:**
- `UiColors` は `navigation`, `attention`, `frame`, `search_bg`, `pmenu_sel_bg` の 5 色のみ
- 上記のハイライトグループを十分にカバーできていない
- 特に StatusLine / TabLine / File Tree / Terminal bg は個性の源泉なのに、色の割り当てが不十分

**対策案:**
- UI クローム色の生成ロジックを拡張し、上記グループをカバーする
- primary の色相をベースに、L/C を変えた派生色を生成する
- ISSUE-1 の bg/fg 自力導出と連携して設計する

---

### ISSUE-3: コントラスト保証を APCA ベースへ移行する

**深刻度:** 高
**影響範囲:** 全キャラ（特に dark テーマ）

現状の `ensureContrast` は WCAG 2.x の相対輝度比 (L1 + 0.05) / (L2 + 0.05) を使用しているが、
この計算式にはダークテーマに対する構造的な欠陥がある。

**背景: ダークとライトで人間の見え方が根本的に異なる**

- **Positive Polarity (ライトテーマ):** 瞳孔が収縮 → 焦点深度が深い → 文字がくっきり見える
- **Negative Polarity (ダークテーマ):** 瞳孔が開く → レンズ歪み（乱視）の影響 → 明るい文字の光が暗い背景に漏れ出す **ハレーション現象**
- Piepenbrock et al. (2013): 世界人口の約 50% が何らかの乱視を持つ

**WCAG 2.x の限界:**
- 「純黒 bg にダークグレー文字」と「純白 bg にライトグレー文字」で同じ数値を返す — 知覚と乖離
- テキストサイズ・太さを考慮しない
- ダークテーマでコントラストを高くしすぎると、ハレーション（にじみ）で逆に読みにくくなる問題を検出できない

**APCA (Accessible Perceptual Contrast Algorithm) の利点:**
- Andrew Somers (W3C Silver Task Force) が策定、WCAG 3.0 の中核として採用予定
- 背景/前景の明暗関係（Polarity）によって異なる計算係数を使用
  - ライト: 暗い文字が「背景の光をブロックする」モデル
  - ダーク: 明るい文字が「自ら発光し散乱する」モデル
- フォントの太さ (Font Weight) も計算式に組み込み
- ダークテーマでの「最大コントラスト制限」（ハレーション防止）を数学的に表現

**実装方針:**
- `sample-repo/color.js` の `src/contrast/` を解析し、APCA 実装を理解する
- 現状の WCAG ベース `ensureContrast` を APCA ベースに置き換え
- ダークテーマ: 最低コントラスト保証 + **最大コントラスト制限** (fg の L 上限 ≈ 0.85)
- ライトテーマ: APCA で知覚的に正確なコントラスト保証
- Lea Verou 推奨の「2段階アプローチ」: APCA で可読性確保 → WCAG 2.1 で法務コンプライアンスチェック

**参考文献:**
- Piepenbrock et al. (2013) "Positive display polarity is advantageous for both younger and older adults"
- Andrew Somers — APCA specification (W3C Visual Contrast Task Force)
- Lea Verou — Color.js (W3C CSS Color 4/5 共同エディター)
- `sample-repo/color.js/src/contrast/` — APCA 実装の参照コード

---

### ISSUE-4: light テーマ固有の課題

**深刻度:** 高
**発生キャラ:** Klee, Nahida, Faruzan, Hyacine, Aglaea, Yoimiya

light テーマには ISSUE-3 (APCA) とは独立した以下の問題がある。

#### 4a: ensureContrast がパステル色のアイデンティティを破壊する

light テーマでは白 bg に対して 4.5:1 を達成するために accent 色の L を大きく下げる必要がある。
明るいパステル色 (L > 0.7) は ΔL > 0.2 の変化を受け、元の色の印象が大幅に変わる。

```
例: Nahida secondary #f9fcf7 (L=0.98) → ensureContrast → #666e5f (L≈0.48)
    ΔL = 0.50 — 元のほぼ白色が暗い灰緑に変化
```

対策: L 調整時に chroma を補償 (L が離れるほど C を増加させ、元の色味を維持)

#### 4b: L_JITTER 帯が狭く弁別性が低い

light テーマの L_JITTER = [0.38, 0.42, 0.46, 0.50] — range = 0.12。
白 bg (L≈0.93) に対して contrast 4.5:1 を満たすために全色が L < 0.55 に制約され、
ensureContrast 後に L が収束しやすい。

対策: L_JITTER range を拡大 [0.30, 0.52, 0.38, 0.46] (range=0.22)、下限 0.25 程度

#### 4c: light テーマ判定の精度

light テーマになってほしいキャラ（淡い色合いのキャラ）が dark 判定されるケースがある。
現状プロンプトベースでしか制御できないため、VisionResultSchema の `theme_tone` description を調整して対応する。

---

### ISSUE-5: fixDiscrimination が seed 色ペア (c1-c3) や seed-error (c2/c3-c8) を修正できない

**深刻度:** 中
**発生キャラ:** Luocha (c1↔c3), Guinaifen (c2↔c8, c3↔c8)

fixDiscrimination の adjustableIndices は c4〜c7 (gap-filled) のみ。
seed 色同士や seed-error の衝突は調整対象外。

**Luocha:** primary H=88°, tertiary H=94° — ΔH=6° だが両方 C > threshold なので stabilizeHue 未適用。
**Guinaifen:** secondary H=32°, error H=25° — 暖色 seed + 固定 error hue が近接。

**対策案:**
- seed 間 ΔH が小さい場合、tertiary の L/C を微調整して ΔE を確保
- error hue の回避ロジックに secondary/tertiary との距離も考慮

---

### ISSUE-6: seed 3色の色相が極度に集中すると gap-fill が構造的に破綻する

**深刻度:** 高
**発生キャラ:** Aglaea (hue≈90° x3, 警告 7件), Kafka (hue≈2° x3, 警告 4件)

AI が「キャラの印象色は全て同系色」と判断した場合、3 seed が色相環の 1 点に集中する。
mergeCloseHues で実質 1 seed になり、gap-fill は 360° を 4 等分するが:
- gap-filled 色の L/C が均一 (cTarget × 0.9 + L_JITTER 範囲 0.38-0.50)
- 色相は散るが、暗い light テーマの L 帯では Oklab 距離が稼げない

```
Aglaea (light): L_JITTER = [0.38, 0.42, 0.46, 0.50] → ΔL_max = 0.12
  hue は 90° 間隔に散るが、L/C が似ているため ΔE が 0.04〜0.06 に留まる
```

**対策案:**
- seed 集中度 (3 seed の hue 標準偏差) に応じて L_JITTER の振幅を拡大する
- 例: hue σ < 20° なら L_JITTER を ±0.06 に拡張 → [0.32, 0.56, 0.38, 0.50]
- C にも Jitter を入れる (現在は cTarget 固定)

---

### ISSUE-7: config.ts が複雑で難解

**深刻度:** 中
**影響範囲:** 開発体験

`CONFIG` オブジェクトに色科学の定数・テーマ別パラメータ・UI パラメータ・弁別性パラメータが
フラットに詰まっており、「何のためのパラメータか」がコードを読んだだけではわからない。
良くないものが難解であること自体が問題。

**対策案:**
- パラメータの意図・根拠ごとにグルーピングを見直す
- ISSUE-3 (APCA 移行) や ISSUE-1 (bg/fg 自力導出) でパラメータ構造が変わるため、それらの後にリファクタする

---

### ISSUE-8: UI 表示の改善

**深刻度:** 低
**影響範囲:** フロントエンド

- AI が出力した impression 3色（primary / secondary / tertiary）の表示 UI がない
- 各 Swatch に書かれている文字が小さい

---

### ISSUE-9: テーマ雰囲気のユーザー選択制

**深刻度:** 高
**影響範囲:** 全パイプライン

ensureContrast が一律に L を操作するため、全体的にパステル化する。
テーマの「雰囲気」という概念がパイプラインに存在しない。

AI の theme_tone 自動判定に頼らず、ユーザーが 3つのプリセットから選ぶ:

| プリセット | bg | fg | accent の雰囲気 |
|---|---|---|---|
| **Dark** | 暗い (L=0.18) | 明るい (L=0.85) | 深く鮮やか。seed の L/C を活かす |
| **Light Pastel** | 明るい (L=0.94) | 暗め (L=0.25) | パステル許容。ensureContrast の L 下げを緩やかに |
| **Light** | 明るい (L=0.94) | 暗め (L=0.25) | くっきり。chroma boost + L をしっかり下げる |

画像入力 → 即生成ではなく、3ボタンで選択 → 生成に変更する。

---

## 設計案: Base16 インスパイアのパレット再設計

ISSUE-1〜8 を横断的に解決するためのパレット再設計案。
Base16 の「少数色で全部塗る」思想 + Catppuccin の blend パターンをベースにする。

### 設計原則

1. **AI 依存を最小化する**: AI impression 3色から 2色だけを seed として使う
2. **Syntax と UI の責務分離**: Syntax は色相環ベースで安定、UI は seed で個性を出す
3. **blend で派生**: パレットに色を増やさず、blend で動的生成する

### Seed 選定

```
AI impression 3色 (primary / secondary / tertiary)
  ↓
primary + (secondary or tertiary のうち hue が離れている方) = seed 2色
  ↓
seed は Syntax と UI の両方の起点として共有する
```

secondary と tertiary の選定基準: primary との hue 差が大きい方を採用。
AI が bg/fg 寄りの低彩度を出した場合や 3色が同系色の場合でも、2色なら安定する。

### パレット定義: 22色

```
── Neutral (8色) ──────────────────────────────────────
N0  bg         エディタ背景
N1  surface    Float, Pmenu bg
N2  overlay    CursorLine, Folded bg
N3  highlight  Visual, PmenuSel bg
N4  subtle     LineNr, border, NonText, Delimiter
N5  dim        comment
N6  text       fg
N7  bright     強調テキスト

── Syntax (8色) ───────────────────────────────────────
S0  accent     Special / Todo / Title         seed1 hue (色相環の起点)
S1  keyword    Keyword / Statement            seed2 hue (色相環の固定点)
S2  func       Function                       色相環 gap-fill
S3  string     String / Character             色相環 gap-fill
S4  type       Type                           色相環 gap-fill
S5  number     Number / Boolean / Constant    色相環 gap-fill
S6  operator   Operator                       色相環 gap-fill
S7  preproc    PreProc / Include              色相環 gap-fill

── UI (2色) ───────────────────────────────────────────
U0  primary    seed1 (キャラのメインカラー)
U1  secondary  seed2 (キャラのサブカラー)

── Diagnostic (4色) ───────────────────────────────────
D0  error      hue ≈ 25  (赤)
D1  warn       hue ≈ 85  (黄)
D2  info       hue ≈ 250 (青)
D3  hint       hue ≈ 165 (緑)
```

### Neutral (N0-N7) 生成アルゴリズム

根拠: MD3 Tonal Palette、Tailwind CSS v4.2 OKLCH、APCA

```
入力: seed_primary_hue, theme_tone

hue    = seed_primary_hue
bg_c   = 0.018  (黄色系 h≈60-120 は 0.015 に補正)
fg_c   = 0.012  (fg は bg より低彩度。フリンジ防止)

Dark テーマ:
  N0  bg        oklch(0.18,  bg_c, hue)    base
  N1  surface   oklch(0.21,  bg_c, hue)    +0.03
  N2  overlay   oklch(0.23,  bg_c, hue)    +0.05
  N3  highlight oklch(0.28,  bg_c, hue)    +0.10
  N4  subtle    oklch(0.40,  fg_c, hue)    中間帯
  N5  dim       oklch(0.50,  fg_c, hue)    comment
  N6  text      oklch(0.85,  fg_c, hue)    fg
  N7  bright    oklch(0.90,  0.010, hue)   強調

Light テーマ:
  N0  bg        oklch(0.94,  bg_c, hue)    base
  N1  surface   oklch(0.91,  bg_c, hue)    -0.03
  N2  overlay   oklch(0.89,  bg_c, hue)    -0.05
  N3  highlight oklch(0.84,  bg_c, hue)    -0.10
  N4  subtle    oklch(0.65,  fg_c, hue)    中間帯
  N5  dim       oklch(0.55,  fg_c, hue)    comment
  N6  text      oklch(0.25,  fg_c, hue)    fg
  N7  bright    oklch(0.18,  0.010, hue)   強調

ΔL (bg-fg) = 0.67 (dark) / 0.69 (light) → 快適ゾーン 0.60〜0.70 内
```

### Syntax (S0-S7) 生成アルゴリズム

```
入力: seed1_hue, seed2_hue, theme_tone

S0 = seed1_hue (固定点)
S1 = seed2_hue (固定点)
S2-S7 = seed1, seed2 が作る色相環の gap を均等に埋める 6色

各色の L/C:
  L = theme_tone に応じた L_JITTER (既存ロジック)
  C = chromaScale × seed の平均 C (既存ロジック)

全色に ensureContrast(Sx, N0, threshold) を適用
```

seed に直接依存するのは hue の起点のみ。L/C は色相環ベースで安定的に生成する。

### UI (U0-U1) + blend 派生

```
U0 = seed1 (ensureContrast 済み)
U1 = seed2 (ensureContrast 済み)

blend(accent, base, ratio) = ratio × accent + (1 - ratio) × base

── blend で動的生成する色 ─────────────────────────────
U0_bg   = blend(U0, N0, 0.08)   StatusLine bg, WinBar bg
U0_dim  = blend(U0, N0, 0.04)   StatusLineNC bg, WinBarNC bg
U1_bg   = blend(U1, N0, 0.10)   TabLineSel bg
U0_sep  = blend(U0, N0, 0.15)   WinSeparator fg
```

U0 (primary) = 常に見える UI。U1 (secondary) = 選択・フォーカス時に現れる UI。

### Diagnostic (D0-D3)

```
固定 hue + seed の L/C から導出 (既存ロジック維持)

Diff bg は blend で生成:
  DiffAdd    bg = blend(D3, N0, 0.18)
  DiffChange bg = blend(D2, N0, 0.18)
  DiffDelete bg = blend(D0, N0, 0.18)
  DiffText   bg = blend(D2, N0, 0.30)
```

### マッピングテーブル

```
── Editor UI ──────────────────────────────────────────
Normal            fg=N6    bg=N0
NormalFloat       fg=N6    bg=N1
FloatBorder       fg=U0
FloatTitle        fg=U0    bold
CursorLine                 bg=N2
CursorLineNr      fg=U0    bold
LineNr            fg=N4
Visual                     bg=N3
Search            fg=N0    bg=U0
IncSearch         fg=N0    bg=U1    bold
CurSearch         fg=N0    bg=U0    bold
MatchParen                 bg=N3    bold
Pmenu             fg=N6    bg=N1
PmenuSel                   bg=N3
PmenuSbar                  bg=N1
PmenuThumb                 bg=N4
StatusLine        fg=N6    bg=U0_bg
StatusLineNC      fg=N4    bg=U0_dim
WinBar            fg=N6    bg=U0_bg
WinBarNC          fg=N4    bg=U0_dim
TabLine           fg=N4    bg=N1
TabLineSel        fg=U1    bg=U1_bg  bold
TabLineFill                bg=N0
WinSeparator      fg=U0_sep
Folded            fg=N5    bg=N2
FoldColumn        fg=N4
SignColumn                 bg=N0
NonText           fg=N4
Title             fg=U0    bold

── Syntax ─────────────────────────────────────────────
Comment           fg=N5    italic
Keyword           fg=S1
Statement         fg=S1
Conditional       fg=S1
Repeat            fg=S1
Function          fg=S2
Operator          fg=S6
String            fg=S3
Character         fg=S3
Type              fg=S4
Number            fg=S5
Boolean           fg=S5
Float             fg=S5
Constant          fg=S5
Special           fg=S0
Delimiter         fg=N4
Identifier        fg=N6
PreProc           fg=S7
Include           fg=S7
Todo              fg=S0    bold

── Diagnostic ─────────────────────────────────────────
DiagnosticError         fg=D0
DiagnosticWarn          fg=D1
DiagnosticInfo          fg=D2
DiagnosticHint          fg=D3
DiagnosticVirtualText*  fg=D0-D3
DiagnosticUnderline*    undercurl
DiagnosticSign*         fg=D0-D3

── Diff ───────────────────────────────────────────────
DiffAdd                 bg=blend(D3, N0, 0.18)
DiffChange              bg=blend(D2, N0, 0.18)
DiffDelete              bg=blend(D0, N0, 0.18)
DiffText                bg=blend(D2, N0, 0.30)
```

### 現状からの変更サマリ

| 変更 | Before | After |
|---|---|---|
| パレットシステム | palette-generator + highlight-mapper 並走 | 22色パレット + マッピングテーブルに統一 |
| AI 依存 | 3色 + bg/fg = 5値 | 2色のみ (primary + 選定された se/te) |
| Neutral | 2つの定義が微妙に違う | N0-N7 の 8段階、テーマ別 L テーブル |
| Syntax | accent 10色 / roles 7色が混在 | S0-S7 の 8色。seed 2色 + gap-fill 6色 |
| UI chrome | UiColors 5色が別枠、bg は neutral と同じ | U0/U1 + blend で StatusLine/TabLine/WinBar に個性 |
| Diagnostic | highlight-mapper のみ | D0-D3 をパレットの一級市民に |
| Diff bg | diagnostic をそのまま bg に | blend(diagnostic, N0, ratio) |
| コントラスト保証 | WCAG 2.x | APCA へ移行 (40行で移植可能) |
| config.ts | 62行フラットなオブジェクト | Neutral L テーブル + blend ratio のみ |

### この設計が解決する Issue

| Issue | 解決方法 |
|---|---|
| ISSUE-1 (bg/fg 自力導出) | Neutral を seed hue + L テーブルから生成。AI の neutral 出力に依存しない |
| ISSUE-2 (UI クローム) | U0/U1 + blend で StatusLine/TabLine/WinBar にキャラの個性 |
| ISSUE-3 (APCA) | ensureContrast を APCA ベースに置き換え |
| ISSUE-4 (light テーマ) | Neutral L テーブルを dark/light 別に定義。ΔL を快適ゾーンに保証 |
| ISSUE-5 (seed-error) | seed が 2色に減ったため衝突確率が下がる + error hue の回避ロジック維持 |
| ISSUE-6 (seed 集中) | seed 2色 + gap-fill 6色。2色の hue 差が最大になるよう選定するため集中しにくい |
| ISSUE-7 (config 複雑) | Neutral L テーブル + blend ratio テーブルに簡素化 |
| ISSUE-8 (UI 表示) | impression 3色 + 選定された seed 2色の表示を追加 |

---

## 未実装機能

### TODO-3: ユニットテスト

**優先度:** 中

spec.md §11 に定義されたテスト観点に従い、各関数のユニットテストを作成する。
26 キャラ検証で発見した edge case を含める:
- stabilizeHue: 動的閾値の境界値 (L=0.3, L=0.85)
- computeGaps + mergeCloseHues: 重複 hue (全同値、5° 以内)
- ensureContrast: dark/light 両方向
- resolveErrorHue: 赤系 hue primary (hue 0°-55°)

---

### TODO-4: Valibot スキーマ定義

**優先度:** 低（本実装時に作成）

spec.md §9 に定義された VisionResultSchema / PaletteResultSchema を実装する。

---

## V02: Base16 インスパイアのパレット再設計

V01 の課題 (ISSUE-1〜8) を横断的に解決するため、palette-generator を一から再設計する。
Base16 の「少数色で全部塗る」思想 + Catppuccin の blend パターンをベースにした 22色パレット。

詳細は [V02 plan.md](../V02/plan.md) を参照。

---

## 参考 OSS

少数のベースカラーからプログラム的に Neovim カラースキームを生成する OSS の調査結果。
各 Issue の設計・実装時に参照する。

### 最重要（直接取り入れる）

| OSS | 関連 Issue | 取り入れるもの |
|---|---|---|
| **mini.base16** (echasnovski/mini.nvim) | ISSUE-2 (UI クローム) | Base00〜07 (bg→fg モノトーン 8段階) + Base08〜0F (accent 8色) の 16色で全ハイライトグループをカバーするマッピングテーブル。「何色あれば全部塗れるか」の設計基盤 |
| **Catppuccin** (catppuccin/nvim) | ISSUE-1 (bg/fg), ISSUE-2 | `blend(accent, bg, ratio)` アルゴリズム。数色のパレットから Diagnostics bg・UI chrome を動的派生。数百プラグイン対応の実績 |
| **Lush.nvim** (rktjmp/lush.nvim) | ISSUE-1, ISSUE-7 (config) | `lighten()`, `desaturate()`, `rotate()`, `mix()` の関数ベース色派生 DSL。意図が読める宣言的な色定義 |

### 参考（部分的に参照）

| OSS | 参考になる点 |
|---|---|
| **mini.colors** (echasnovski/mini.nvim) | OKLCH ネイティブの L/C 一括変換・補間アルゴリズム (Lua 実装) |
| **Pywal** (dylanaraps/pywal) | 画像 → ANSI 16色アサインの先駆者。割り当てアルゴリズム |
| **colorbuddy.nvim** (tjdevries/colorbuddy.nvim) | ベース色からトーン派生 → Syntax ツリーへの論理的マッピング設計 |
| **nvim-highlite** (Iron-E/nvim-highlite) | 少数パレットから欠けている色を自動推論・補間する Gap-filling ロジック |
| **vim-dogrun** (wadackel/vim-dogrun) | Rust 製ジェネレータ。CIELAB + Delta E 2000 による 256色ダウングレードマッピング |
| **Themer** (ThemerCorp/themer.lua) | 単一パレット → 複数アプリ (Neovim, Kitty, Alacritty) のテーマ一括生成テンプレート |
| **oklch-color-picker.nvim** (eero-lehtinen/oklch-color-picker.nvim) | Lua+Rust ハイブリッドの OKLCH パース・リアルタイムプレビュー |

---

## 定数の暫定値

以下の定数は追加検証後に調整する可能性がある:

| 定数 | 現在値 | 用途 | 備考 |
|---|---|---|---|
| frameChromaScale | 0.5 | frame 色の彩度スケール | 暫定 |
| frameL | dark: 0.35, light: 0.65 | frame 色の L | 暫定 |
| searchBgL | dark: 0.30, light: 0.85 | search_bg の L | 暫定 |
| lJitter.dark | [0.68, 0.76, 0.72, 0.80] | gap-filled の L 分散 | O'Donovan ベース |
| lJitter.light | [0.42, 0.50, 0.46, 0.38] | gap-filled の L 分散 | ISSUE-4b で拡大検討 |
| achromaticCBase | 0.015 | 低彩度判定閾値 (中間 L) | JND ベース |
| minHueGap | 30 | 最小色相距離 (°) | Cohen-Or ベース |
| minDeltaE | 0.08 | 弁別性閾値 | Gramazio ベース |
| mergeThreshold | 5 | 近接 hue マージ閾値 (°) | 暫定 |
| neutral fgLevels (light) | comment: 0.55, lineNr: 0.60 | neutral fg の固定 L | 暫定 |
