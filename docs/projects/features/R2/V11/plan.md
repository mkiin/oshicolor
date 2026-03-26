# R2/V11 半自動 象徴色 + 調和色生成

## なぜ V11 が必要か

V1〜V10 の 10 回のイテレーションが、全自動カラーマッピングの構造的限界を証明した。

kafka-preview（手動）と color-mapper（自動）を比較した結果、手動版の方が「キャラっぽい」「色のバランスが取れている」。分析すると、kafka-preview で抽出色をそのまま使ったのは magenta（keyword）と lavender（function）の **実質 2 色だけ** で、残り 6 色は「キャラの世界観に合う色」として人間が選んだものだった。topaz-preview でも同じパターン（crimson + purple の 2 色だけ抽出、残りは生成）。

核心の問題:

1. **意味的判断の欠落** — 色抽出アルゴリズムはピクセル色分布を見るだけ。「このキャラの象徴色はこれ」という判断はユーザーにしかできない
2. **抽出色をそのまま使うとバランスが壊れる** — 象徴色の 3 次元（H/L/C）それぞれに適切な扱いが必要（後述 §2）
3. **全自動スコアリングの限界** — V10 の `hueDiff × C` は「数値的に遠い色」を選ぶだけで、「キャラに合う色」を選べない
4. **色数の不足** — V10 のドミナント 5 色では syntax ロールをカバーしきれない。kafka/topaz は 8 色のアクセントを使っている

V10 issues.md にも「ユーザー選択フローが将来的に必要」と記載されていた。V11 はこれを正面から取り組む。**既存コードのスクラップ＆ビルド。**

### kafka-preview の色構成分析

```
magenta  #c04080  H≈340° C≈0.15 L≈0.55  → keyword
pink     #e0608a  H≈350° C≈0.13 L≈0.60  → preproc    ┐ 同系統 Hue
neon     #ff3090  H≈340° C≈0.25 L≈0.62  → special    ┘ L/C で差別化
lavender #d0a0e0  H≈290° C≈0.10 L≈0.74  → function
steel    #8ba0c0  H≈230° C≈0.05 L≈0.66  → type
green    #7a9a6b  H≈130° C≈0.06 L≈0.62  → string
gold     #c8a050  H≈85°  C≈0.11 L≈0.70  → number
red      #cc4444  H≈25°  C≈0.16 L≈0.52  → error
```

観察:

- **8 色中 3 色（magenta/pink/neon）が同系統 Hue**。独立した Hue は実質 5〜6 個
- 象徴色（magenta）から **同系統の L/C バリエーション** を生成するパターンがある
- 残りの色（lavender, steel, green, gold, red）は **象徴色とは独立した Hue** を持つ
- 各色の L は 0.52〜0.74 の範囲。C は 0.05〜0.25 と幅広い

### topaz-preview の色構成分析

```
crimson  #c43448  H≈25°  → keyword       ┐ ユーザー象徴色
purple   #7b69c6  H≈280° → function      ┘
lavender #96a1d7  H≈260° → type          ← purple の同系統バリエーション
gold     #cc9c42  H≈80°  → string
amber    #c38b53  H≈60°  → number        ← gold の同系統バリエーション
scarlet  #e6293f  H≈25°  → special       ← crimson の vivid variant
plum     #664f8d  H≈280° → constant      ← purple の L 低め variant
rose     #bb6690  H≈340° → preproc       ← crimson と purple の中間
```

観察:

- **象徴色から同系統バリエーションを生成するパターンが明確**: crimson→scarlet, purple→lavender/plum, gold→amber
- 独立した Hue は実質 4〜5 個（25°, 280°, 80°, 340°）
- 象徴色 2 色から 8 色を導出する構造が kafka と一致

## 前版との変更対照表

| 項目 | V10 | V11 |
|------|-----|-----|
| 操作モデル | 全自動（neutral 源のみユーザー選択） | **半自動**: ユーザーが象徴色 2〜3 色を選択 |
| seed → パレット | 候補プールから hue 分散スコアリング（5〜8色） | 象徴色 2〜3 色 + **調和色 5〜6 色を生成** → 計 8 色 |
| 調和色の生成 | なし（抽出色をそのまま使用） | 象徴色の L/C バリエーション + 独立 Hue の調和色を生成 |
| 色空間 | OkLch | OkLch |
| neutral | Muted 系 swatch からタブ選択 | 象徴色1 の Hue から生成 |
| 既存コード | 改修して活かす | **スクラップ＆ビルド**（oklch-utils.ts のみ流用） |
| contrast 保証 | `ensureContrast` で個別 L 調整 | 2 段構え: 生成時に L を適切に設定 + 最終検証で `contrastRatio()` |

## ドメイン定義 — この plan.md に最も欠けていたもの

> **[レビュー注記]**
> この plan.md は「何を作るか」の表面（フロー、ファイル構成、ツール選定）は書かれているが、
> このプロダクトの **ドメイン（ビジネスの核となるルール）** が定義されていなかった。
>
> ドメインとは「外部の技術的都合（React/Jotai/colorthief/culori）が変わっても絶対に変わらない、
> このプロダクト固有のルール」のこと。oshicolor にとってのドメインは何か？
>
> - colorthief で色を抽出すること？ → No。抽出ライブラリは差し替え可能（インフラ詳細）
> - Jotai で状態管理すること？ → No。状態管理は UI 層の都合
> - Neovim の Lua を生成すること？ → No。出力形式は差し替え可能（VS Code JSON でもよい）
>
> **oshicolor のドメインは「象徴色から調和の取れたカラーパレットを生成し、構文ロールに割り当てる」
> というカラー設計のルールそのもの。** ここにバグが入ればプロダクトの価値がゼロになる。
> このドメインを最初に定義し、テストで守り、外部の変化から隔離することが設計の出発点。

### ドメインモデル

oshicolor の不変のコア（外部ライブラリや UI フレームワークが変わっても変わらないルール）。
DDD の戦術的設計パターン（値オブジェクト・集約・ドメインサービス）を適用する。
詳細は @docs/references/books/ddd-hands-on/ を参照。

```
┌─────────────────────────────────────────────────────────┐
│  Domain（ビジネスルール — テスト必須・外部依存ゼロ）        │
│                                                         │
│  ── 値オブジェクト（不変・等値性は値で判定）──              │
│  OklchColor    { h, l, c }  色の 3 次元を保持             │
│   - withL(l) → new OklchColor   L だけ差し替えた新しい色  │
│   - withScaledC(factor, min, max) → new OklchColor       │
│   - deltaE(other) → number     知覚差を計算              │
│   - deltaHue(other) → number   Hue 差を計算              │
│   - contrastRatio(other) → number  WCAG コントラスト比    │
│   - toHex() → string                                    │
│                                                         │
│  NeutralScale  { steps: OklchColor[] }  bg/fg 階段        │
│   - bg, fg, comment 等の名前付きアクセサ                   │
│                                                         │
│  ── 集約（関連オブジェクトの整合性を保証）──               │
│  AccentPalette { colors: OklchColor[8] }  集約ルート      │
│   - 不変条件: 常に 8 色 / ΔE ≥ 閾値 / diagnostic と       │
│     ΔH ≥ 30° / 同系統は Hue 差 ≤ 15°                     │
│   - create() で不変条件を検証してから構築                   │
│                                                         │
│  HighlightMap  { groups: Record<string, HighlightDef> }   │
│   - 不変条件: syntax fg 全色 on bg が WCAG AA             │
│                                                         │
│  ── ドメインサービス（複数オブジェクトをまたぐ処理）──      │
│  ColorHarmonyService                                     │
│   - buildAccentPalette(seeds) → AccentPalette            │
│     （値オブジェクト単体では自然に表現できない生成ロジック）  │
│                                                         │
│  ContrastGuardService                                    │
│   - ensureContrast(fg, bg, minRatio) → OklchColor        │
│     （fg と bg の 2 色をまたぐ調整処理）                    │
│                                                         │
│  RoleAssignmentService                                   │
│   - assignRoles(palette, neutrals, diagnostics)          │
│     → HighlightMap                                       │
│     （集約 + neutral + semantic の組み合わせ）              │
│                                                         │
│  ※ colorthief, culori, Jotai, Hono, Neovim への          │
│    依存は一切持たない。純粋な関数とデータ型のみ。          │
└─────────────────────────────────────────────────────────┘
          ▲ ドメインには何も依存しない（矢印が内向き）
          │
┌─────────┴─────────────────────────────────────────────┐
│  Port（契約書 — interface のみ、実装なし）               │
│                                                       │
│  ThemeOutputPort                                      │
│   - output(highlightMap, meta) → string               │
│     （Neovim Lua でも VS Code JSON でも差し替え可能）    │
│                                                       │
│  ※ 色抽出は theme-generator の責務ではない。             │
│    色抽出は別 feature (color-extractor) が担い、          │
│    ユーザー選択を経て SymbolicColor[] として渡される。     │
│    UseCase の入力は SymbolicColor[]（抽出済み・選択済み）。│
└───────────────────────────────────────────────────────┘
          ▲ Gateway は Port を実装する（依存性逆転）
          │
┌─────────┴─────────────────────────────────────────────┐
│  Gateway（Port を実装し、Domain 型 → 外部形式に翻訳）    │
│                                                       │
│  NeovimLuaGateway implements ThemeOutputPort           │
│   - HighlightMap (OklchColor) → Lua colorscheme 文字列  │
│   - OklchColor → hex 変換（gamut mapping）もここ        │
│   - culori 依存はこの Gateway に閉じる                   │
└───────────────────────────────────────────────────────┘
```

### なぜこの分離が重要か

1. **ドメインのテストが外部に依存しない**: ColorHarmony のテストに colorthief も Neovim も不要。純粋な入出力のテスト（象徴色を渡したら 8 色が返る）だけで、プロダクトのコアを検証できる
2. **出力形式の追加**: Neovim Lua に加えて VS Code JSON や Alacritty TOML を追加する場合、新しい Gateway（ThemeOutputPort の実装）を作るだけ。ドメインの調和色生成ロジックは一切触らない
3. **UI フレームワークの変更**: Jotai → Zustand、TanStack → Next.js。ドメインは影響を受けない
4. **色抽出ライブラリの差し替え**: 色抽出は theme-generator の外（color-extractor feature）の責務。色抽出が colorthief でも node-vibrant でも、theme-generator は `SymbolicColor[]` を受け取るだけなので影響を受けない

### ドメインの不変条件（テストで守るべきルール）

```
ColorHarmony:
  - buildAccentPalette は常に 8 色を返す
  - 8 色の全ての Hue が diagnostic 固定色と ΔH ≥ 30° の距離を持つ
  - 8 色間の知覚差が ΔE ≥ 閾値を満たす
  - 同系統バリエーションは元の象徴色と Hue 差 ≤ 15°

ContrastGuard:
  - ensureContrast の出力は常に minRatio 以上のコントラスト比を持つ
  - L 調整幅が上限を超える場合は C も同時に下げる（色の印象を保つ）

NeutralScale:
  - 生成された階段の L は単調増加
  - 全ステップが指定 Hue を保持

RoleAssignment:
  - syntax fg 全色 on bg が WCAG AA（4.5:1）を満たす
  - UI 強調色が neutral/syntax どちらとも区別可能
```

> **[レビュー注記]**
> 上記の不変条件は、このプロダクトの「税率」に相当する。
> 税率が `価格 * 0.08` としてコード中に散らばっていたら、税率変更で全体が壊れる。
> 同様に、「8 色間の ΔE ≥ 閾値」がドメインに集約されていなければ、
> 閾値を変えたいとき highlight-groups.ts も atoms も全部触ることになる。
>
> **ドメインにルールを集約し、テストで守る。これが V11 の設計の出発点であるべき。**
> 以下の設計方針は、このドメイン定義を前提として読むこと。

---

## 設計方針

### 核心: 象徴色 2〜3 色 → 調和色生成 → 計 8 色アクセントパレット

```
画像 → 色抽出（16色）→ パレット候補を UI に提示
                                │
                          ユーザーが象徴色を 2〜3 色タップ
                          「このキャラと言えばこの色」
                                │
                                ▼
                    ┌──────────────────────────┐
                    │    調和色生成エンジン       │
                    │                          │
                    │  入力: 象徴色 2〜3 色      │
                    │  出力: 調和色 5〜6 色      │
                    │                          │
                    │  ・同系統 L/C バリエーション │
                    │  ・独立 Hue の調和色        │
                    └──────────────────────────┘
                                │
                                ▼
                    8 色アクセントパレット
                    + neutral 階段（bg/fg）
                    + semantic 固定色（diagnostic, diff）
                                │
                                ▼
                    ロール割り当て → HighlightMap（66+ グループ）
```

### 1. ユーザーによる象徴色選択

抽出パレット（16 色）を UI に並べ、ユーザーが 2〜3 色を tap で選ぶ。

- 2〜3 色は同系統の Hue になる可能性がある（それでよい）
- デフォルト推薦: chroma 最大の色を初期選択にしておく

### 2. 調和色生成エンジン

象徴色 2〜3 色を入力に、残り 5〜6 色を生成して計 8 色のアクセントパレットを作る。

#### 象徴色の H/L/C 3 次元の扱い

象徴色を「そのまま使う」のではなく、H/L/C それぞれに方針を持つ:

| 次元 | 方針 | 理由 |
|------|------|------|
| **H（Hue）** | 象徴色から借用 | キャラの「色味」の核心。ユーザーが選んだ色の identity |
| **C（Chroma）** | 象徴色から導出（スケール） | キャラの個性（ビビッド vs パステル）を保つ。ただし高 C ほど L と relative luminance の乖離が大きくなるため、ロールに応じてスケーリングする。`C_role = clamp(C_original * factor, min, max)` のような導出式を使い、factor/min/max はロールごとに設定する |
| **L（Lightness）** | ロール要件で設定 | bg とのコントラスト比（WCAG AA）を満たすために、ロールごとに L ターゲットを設定。具体値は検証スクリプトで決定する |

これにより:
- ビビッドなキャラ（高 C 象徴色）→ 高 C 寄りのパレット（鮮やか）
- パステルなキャラ（低 C 象徴色）→ 低 C 寄りのパレット（柔らか）
- キャラの個性が C スケールに反映されつつ、L はコントラスト安全な値に制御される

注意: 高 C でコントラスト不足が起きた場合の ensureContrast 発火時の戦略（L 調整の上限、C 同時調整の有無）は spec.md で定める。

#### 生成する色の 2 つのカテゴリ

**A. 同系統バリエーション** — 象徴色と同じ Hue 帯で L/C を変えた色

kafka の例: magenta(L=0.55,C=0.15) → pink(L=0.60,C=0.13), neon(L=0.62,C=0.25)
topaz の例: crimson → scarlet（vivid variant）、purple → lavender（L 高め）、purple → plum（L 低め）

**B. 独立 Hue の調和色** — 象徴色とは異なる Hue を持つ色

kafka の例: magenta(340°) に対して green(130°), gold(85°), steel(230°)
topaz の例: crimson(25°) に対して gold(80°), rose(340°)

独立 Hue の調和色の C も象徴色の C からスケーリングして導出する。ビビッドなキャラなら独立色も鮮やかめ、パステルなら控えめ、という統一感を保つ。

生成ロジックの具体的なアルゴリズム（Hue オフセット値、C の factor/min/max、L ターゲット値、A/B の配分比率）は plan では確定しない。**spec.md + 実装 + 検証ループで詰める。** plan が定めるのは以下の制約のみ:

- 生成された 8 色は bg に対して WCAG AA（4.5:1）を満たすこと
- diagnostic 固定色（red, gold, blue, green）と Hue が近すぎないこと（干渉回避）
- 8 色間で知覚的に区別可能なこと（ΔE の最小値を設定）

### 3. Neutral 階段

象徴色1 の Hue を借りて、低 chroma で bg/fg の階段を生成する。

chroma は固定値ではなく、象徴色の chroma から導出する（パステル系とビビッド系で適切な値が変わるため）。具体的な導出式は spec.md で定める。

L の値は V10 の実績値（bg=0.24）と他テーマ（VS Code dark L≈0.22、GitHub dark L≈0.10）を参考に、検証で決定する。

### 4. ロール割り当て

8 色アクセント + neutral + semantic をハイライトグループに割り当てる。

対象グループ:

```
── syntax（8 色アクセントから割り当て）──
Keyword, Function, String, Type, Number, Constant, Special, PreProc
+ Treesitter 対応グループ（@keyword, @function, @string 等）

── UI 強調（アクセントから割り当て）──
CursorLineNr, Search, IncSearch, CurSearch, TabLineSel, Title, Todo

── neutral ──
Normal (bg/fg), CursorLine, Pmenu, StatusLine, Visual,
Comment, LineNr, Delimiter, FloatBorder, etc.

── semantic 固定色 ──
DiagnosticError, DiagnosticWarn, DiagnosticInfo, DiagnosticHint
DiffAdd, DiffChange, DiffDelete

── ANSI 16 色 ──
V11 スコープ外（`:terminal` のみで使用。syntax highlight には不要）
```

8 色のどれをどのロールに割り当てるかのロジックも、spec.md + 実装で詰める。kafka/topaz の実績パターン（象徴色 → keyword、同系統 vivid → special、独立 Hue の低 C → type 等）を参考にするが、plan では固定しない。

### 5. Contrast 保証（2 段構え）

OkLch の L は perceptual lightness であり WCAG の relative luminance (Y) とは異なる。高 chroma ほど L と Y の乖離が大きくなる（リサーチで確認済み）。L 差だけで WCAG コントラスト比を保証することはできない。

ただし L と Y には有意な相関があり、L で「概ね正しい」明度を設定することは可能。

1. **生成時**: ロールに応じた L ターゲットで概ね適切な明度を設定。C は象徴色からスケーリングで導出（§2）
2. **検証時**: 生成した hex に対して `contrastRatio()` で実測。WCAG AA を下回る場合は L を微調整（ensureContrast を安全弁として残す）

| 対象 | 閾値 |
|------|------|
| syntax fg 全色 on bg | 4.5:1（WCAG AA） |
| neutral.fg, fg_dim on bg | 4.5:1 |
| neutral.comment, muted on bg | 3:1（補助テキスト） |
| diagnostic 4 色 on bg | 4.5:1 |

#### L ターゲット値の決め方

Lea Verou の実測データ（L ≥ 0.72 付近が明暗の境界）は有望な出発点だが、V11 の問い「bg L=0.12〜0.24 に対して fg L=X で 4.5:1 を確実に満たす X の下限」に直接答えるものではない。

**実装前に V11 固有の検証スクリプトを作成**:

1. V11 の bg 範囲（L=0.12〜0.24）に対して、各 syntax fg ロールの L で `contrastRatio` が 4.5:1 を満たすかの確認（H × C の全範囲）
2. ensureContrast が発火するケース（高 C × 不確定帯）の特定と、L 調整幅の分布
3. 調整後の色が元の象徴色からどれだけ乖離するかの ΔE 計測

この検証結果に基づいて L ターゲット値を確定する。Lea Verou の既存知見と重複する汎用的な走査は行わない。

### 6. フォールバック: C 案

半自動（B 案）で十分な結果が出ない場合、C 案（全自動で叩き台 + 手動オーバーライド）に移行する。

## レイヤー構成（新規設計）

> **[レビュー注記]**
> V10 までの highlight-mapper はドメインロジック・ユースケース・外部変換が
> 1 ファイルに混在していた。V11 はゼロから作るのだから、
> 最初からレイヤーを分離して設計すべき。

### Domain（ビジネスルール — 外部依存ゼロ、テスト必須）

プロダクトのコア。colorthief, culori, Jotai, Hono, Neovim への依存は一切持たない。純粋な関数とデータ型のみ。

| モジュール | 責務 |
|-----------|------|
| `color-harmony` | 調和色生成。象徴色 → 8 色アクセントパレット。**最も重要なドメイン** |
| `contrast-guard` | コントラスト保証。ensureContrast + contrastRatio |
| `neutral-scale` | neutral 階段生成。hue + chroma → bg/fg スケール |
| `role-assignment` | 8 色 + neutral + semantic → 66+ グループへの割り当て |
| `domain-types` | OklchColor, AccentPalette, NeutralPalette, HighlightMap 等の型定義 |

### UseCase（ビジネスの流れ — Domain を呼ぶ順序を定義）

UseCase 自身はルールを持たない。Domain の関数を「どの順番で、何を渡して呼ぶか」というシナリオだけを知る。

入力は `SymbolicColor[]`（色抽出 + ユーザー選択は UseCase の外で完了済み）。
出力は Port（ThemeOutputPort）経由でテーマ文字列を返す。

```
入力: SymbolicColor[]（UI 層から受け取る。抽出・選択は完了済み）

1. 調和色を生成する              （Domain: ColorHarmony を呼ぶ）
2. neutral 階段を生成する         （Domain: NeutralScale を呼ぶ）
3. コントラストを検証・補正する    （Domain: ContrastGuard を呼ぶ）
4. ロールに割り当てる            （Domain: RoleAssignment を呼ぶ）
5. テーマを出力する              （Port: ThemeOutputPort 経由）

出力: テーマ文字列（Lua, JSON 等。出力形式は Gateway が決める）
```

色抽出（画像 → 16 色パレット）とユーザー選択（16 色 → 2〜3 色タップ）は **theme-generator の責務ではない**。色抽出は既存の color-extractor feature が担い、ユーザー選択は UI 層で行う。theme-generator の UseCase は「選択済みの象徴色を受け取ってテーマを生成する」ことだけに集中する。

| | Domain | UseCase |
|---|---|---|
| 何を持つか | ルール（「8色間のΔE≥閾値」等） | 流れ（「生成→補正→割当→出力」） |
| 外部依存 | ゼロ | ThemeOutputPort のみ（DI で注入） |
| テスト | 単体テスト必須 | モック（偽の Gateway）を DI してテスト |

### Port（契約書 — interface のみ、実装なし）

UseCase と外部世界の間に挟まるインターフェース。UseCase はこの契約だけを見て処理を進める。

| モジュール | 責務 |
|-----------|------|
| `theme-output.port` | `output(map, meta) → string`。出力形式は知らない |

**ColorExtractionPort は theme-generator に置かない。** 色抽出は color-extractor feature の責務であり、theme-generator の境界の外。UseCase の入力は `SymbolicColor[]`（抽出済み・選択済み）。

### Gateway（外部世界との翻訳 — Port を実装）

Port の契約を守って作られる「カセット」。

| モジュール | 責務 |
|-----------|------|
| `neovim-lua.gateway` | HighlightMap (OklchColor) → Lua colorscheme 文字列に変換。hex 変換 + gamut mapping もここ（ThemeOutputPort を実装） |

### UI / Atoms（表示と状態管理）

Domain を呼ぶが、Domain は UI を知らない。

| モジュール | 責務 |
|-----------|------|
| `palette-generator.atoms` | 選択 → 生成 → 割り当てのパイプラインを Jotai atom で構成 |

### 依存の方向（厳守）

```
color-extractor → UI (atoms) → UseCase → ThemeOutputPort ← NeovimLuaGateway → culori
(別 feature)          ↓
                   Domain（何にも依存しない）
```

- **Domain は何にも依存しない**（中心。矢印は常に Domain に向かう）
- **UseCase → ThemeOutputPort**: UseCase は Port のメソッドを呼ぶ（依存する）
- **ThemeOutputPort ← NeovimLuaGateway**: Gateway は Port を実装する（依存する）。**ここが依存性逆転**
- **NeovimLuaGateway → culori**: Gateway が culori を使って OklchColor → hex 変換する
- **UI → UseCase**: UI は UseCase に `SymbolicColor[]` を渡してテーマ生成を依頼する
- **color-extractor → UI**: 色抽出は別 feature。UI 層で統合し、ユーザー選択を経て SymbolicColor[] を作る

---

## plan で確定していること / 確定していないこと

### 確定

- 操作モデル: 半自動。ユーザーが象徴色 2〜3 色を選び、残りは生成
- アクセントパレット: 計 8 色（象徴色 + 調和色）
- 調和色の 2 カテゴリ: 同系統 L/C バリエーション + 独立 Hue の調和色
- 象徴色の扱い: H を借用、C は象徴色から導出（スケール）、L はロール要件で設定（§2）
- neutral: 象徴色 Hue から低 chroma で生成
- semantic: 固定色（diagnostic + diff）
- contrast: 2 段構え（生成時 L 設定 + 検証時 contrastRatio）
- Treesitter グループ: V11 スコープ内（@keyword, @function 等）
- UI 強調色（Search, CursorLineNr, Title 等）: 8 色アクセントから割り当て
- **アーキテクチャ: Domain（調和色生成・コントラスト保証・ロール割り当て）を外部依存ゼロで分離。ThemeOutputPort/Gateway でテーマ出力を差し替え可能にする。色抽出は theme-generator の境界外（color-extractor feature の責務）**
- **テスト戦略: Domain の不変条件（8 色生成・コントラスト保証・Hue 距離）をテストで守る。Gateway/UI のテストは優先度低**

### 実装・検証で決めること

- 調和色生成アルゴリズムの具体的なロジック（Hue オフセット、L/C ターゲット、配分比率）
- 8 色 → ロール割り当てのルール
- neutral の L 段階値と C 導出式
- bg の L 値（V10 の 0.24 か、より暗い値か）
- gamut mapping の具体実装（culori `toGamut` or 自前 chroma reduction）
- ロール間の最小知覚差（ΔE 閾値）
- ANSI 16 色の派生ルール（V11 スコープ外）
- ライトテーマ対応（V11 スコープ外）
