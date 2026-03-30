# R2/V11 設計レビュー: plan.md + spec.md

## 概要

plan.md（方針）と spec.md（仕様ドラフト）を対象としたレビュー。
spec.md は plan.md の既存 issues #1〜#4 を概ね反映しているが、新たな問題も判明した。

## 前提: リサーチで判明した事実

1. OkLch の L と WCAG relative luminance (Y) は相関するが一致しない
2. 高 chroma ほど L と Y の乖離が大きくなる
3. Lea Verou の実測: L ≥ 0.72 なら黒テキストが常に白より高コントラスト、L < 0.65 なら白が常に高コントラスト。0.65〜0.72 は不確定帯
4. WCAG 2.1 のコントラスト式自体が中間帯では精度が低い
5. 実用的には「OkLch L で設計 → contrastRatio() で実測補正」の 2 段構えが最善

---

## 旧 issues の解消状況

| 旧 ID | 指摘 | 状況 | 備考 |
|--------|------|------|------|
| 旧1 | ensureContrast が高 chroma で頻繁に発火 | **解消済み** | spec.md に MAX_L_SHIFT=0.08 + C 同時調整フォールバックが定義された |
| 旧2 | 象徴色そのまま vs Hue のみ借用の未決 | **解消済み** | spec.md Step 1 で「H のみ借用、L/C はロール要件で設定」と明記された |
| 旧3 | Lea Verou 実測値の L ターゲット未反映 | **部分解消** | L ターゲットが全て >= 0.68 に設定された。ただし新 issue #2 参照 |
| 旧4 | 検証スクリプトのスコープ不明確 | **解消済み** | spec.md §6 で 3 項目に具体化された |

---

## 現行 issues

### 1. OklchColor.fromHex の依存矛盾【高】

#### 問題

spec.md の OklchColor.fromHex のコメントに「culori は Gateway 層で使う。Domain 内では純粋な数学変換のみ」と書かれている。しかし HighlightMap.create (spec.md L593-601) で `OklchColor.fromHex(def.fg)` を呼んでいる。

HighlightMap は Domain 層の集約である。Domain 内で fromHex を使うなら、hex→OkLch 変換は Domain の責務として完結する必要がある。「culori は Gateway 層」という方針と矛盾する。

#### なぜ問題か

- fromHex の実装には hex→sRGB→OkLab→OkLch の変換が必要。「純粋な数学変換」で実装可能だが、culori 等のライブラリなしでは煩雑
- Domain に culori を入れると「外部依存ゼロ」の原則が崩れる
- 自前で数学変換を実装すると、それ自体がバグの温床になる
- HighlightMap.create が fromHex に依存しているため、この判断は設計全体に波及する

#### 改善案

**A. HighlightDef を OklchColor ベースにする（推奨）**: HighlightDef の fg/bg を string (hex) ではなく OklchColor にする。hex 変換は Gateway/出力段でのみ行う。Domain 内で fromHex が不要になる

**B. fromHex を Domain の純粋関数として実装する**: sRGB→OkLab→OkLch の数学変換を自前で書く。外部依存ゼロは守れるが、変換精度の検証コストが増える

**C. fromHex/toHex を Port として切り出す**: ColorConversionPort を定義し、Gateway 層で culori を使って実装する

推奨は **A**。HighlightDef を OklchColor ベースにすれば、Domain 層全体が hex 文字列に依存しなくなり、fromHex 自体が Domain から消える。hex への変換は ThemeOutputPort の責務として Gateway 層に閉じる。

---

### 2. L_CONST = 0.68 がコントラスト不確定帯に入っている【中】

#### 問題

spec.md の L ターゲット:

```
L_CONST    = 0.68
L_TYPE     = 0.70
L_PREPROC  = 0.71
L_FUNCTION = 0.72
```

旧 issues #3 で「L >= 0.72 なら高 chroma でもコントラスト安全」という Lea Verou の実測値を反映すべきと指摘した。spec.md は大半の L ターゲットを 0.70 以上に設定したが、L_CONST (0.68) と L_TYPE (0.70) は不確定帯 (0.65-0.72) に入っている。

#### なぜ問題か

- L = 0.68 + 高 chroma の組み合わせで ensureContrast が発火する可能性がある
- 特に Constant は独立 Hue の調和色（Step 3 で complement オフセット）なので、Hue が黄色系 (H=80-100) に寄る可能性がある。黄色は L と relative luminance の乖離が最大の色相であり、L=0.68 では 4.5:1 を下回るリスクが高い
- せっかく旧 issues #1 (ensureContrast 発火頻度) の対策をしたのに、初期値で発火を誘発している

#### 改善案

全ての syntax fg L ターゲットを 0.72 以上に統一する。ロール間の差別化は L ではなく C (chroma) で行う。

```
L_CONST    = 0.72  (was 0.68)
L_TYPE     = 0.72  (was 0.70)
L_PREPROC  = 0.73  (was 0.71, 微調整)
```

L を 0.72 以上にそろえると色の明度差が縮まるが、oshicolor のカラースキームでは syntax ロール間の区別は主に Hue と Chroma で行っているため、L の均一化はデメリットが小さい。

---

### 3. AccentPalette の不変条件が生成アルゴリズムと矛盾しうる【高】

#### 問題

AccentPalette.create の不変条件:

1. 常に 8 色
2. 全ペア ΔE >= MIN_DELTA_E
3. diagnostic と ΔH >= 30°

ColorHarmonyService.buildAccentPalette の Step 4 (diagnostic 干渉回避) は「ΔH < 30° なら hue を shift」とあるが、shift した結果が他の不変条件（全ペア ΔE >= 閾値）を壊す可能性がある。

さらに、Step 3 の独立 Hue 生成で offset=60-120° を使うが、象徴色が 2 色 (例: H=70°, H=100°) のように近い場合、独立 Hue 同士が近接して ΔE 閾値を下回る可能性がある。

#### なぜ問題か

- buildAccentPalette が AccentPalette.create を呼んだ時点で不変条件違反で throw される
- **ユーザーの象徴色選択によっては生成自体が失敗する。これは半自動モデルの致命的な UX 問題**
- spec.md には生成失敗時のフォールバック戦略が定義されていない

#### 改善案

**A. AccentPalette.create を「検証 + 自動修正」にする**: 不変条件違反を throw ではなく自動修正。ただし集約の「不正な状態を許さない」原則に反する

**B. buildAccentPalette 内で反復的に制約を満たすまで調整する（推奨）**: Step 4 の後に「全ペア ΔE 検証 → 違反があれば L/C を微調整 → 再検証」のループを入れる。AccentPalette.create は純粋な検証のまま。生成ロジックが制約充足の責務を持つ。ただし「最大何回リトライするか」「リトライでも解決しない場合どうするか」を spec に明記する必要がある

**C. 不変条件を緩和する**: MIN_DELTA_E を小さくする、あるいは「全ペア」ではなく「隣接ロール間」のみにする

---

### 4. NeutralScale の不変条件「全ステップが同一 Hue」は過剰【低】

#### 問題

spec.md の NeutralScale:

- 不変条件: 全ステップが同一 Hue
- create() は単一の hue を受け取り、全ステップに適用

plan.md では「象徴色 Hue から低 chroma で生成」と書かれているだけで「全ステップ同一 Hue」は plan の要件ではない。

#### なぜ問題か

- 実際のカラースキームでは、暗い段階 (bg) と明るい段階 (fg) で微妙に Hue を変えることがある（暗部は warm 寄り、明部は cool 寄り等）。この手法は視覚的な自然さを出すテクニック
- 現時点では問題にならないが、将来の調整で「comment だけ少し Hue をずらしたい」となったとき、不変条件が邪魔になる
- 不変条件は「守るべきビジネスルール」であるべきで、「現在の実装の都合」ではないはず

#### 改善案

不変条件を「全ステップの Hue 差が ΔH <= 15°」程度に緩和する。あるいは Hue の不変条件を削除し、L の単調増加のみにする。

---

### 5. ContrastGuardService.enforceAll の L 補正が AccentPalette 不変条件を壊しうる【高】

#### 問題

spec.md の enforceAll:

```typescript
enforceAll(palette, neutral, diagnostics)
  → { palette: AccentPalette; neutral: NeutralScale; diagnostics: DiagnosticColors }
```

enforceAll は AccentPalette の個別の色の L を調整する。しかし AccentPalette は集約であり、色を差し替えると `withReplacedColor` → `AccentPalette.create` で不変条件（全ペア ΔE >= 閾値）が再検証される。

L を上げた結果、隣接色との ΔE が閾値を下回る可能性がある。例えば、palette[0] (L=0.75) と palette[2] (L=0.76, vivid variant) は同系統 Hue で L が近い。palette[0] の L を 0.78 に上げたら palette[2] との ΔE が閾値を下回って throw される。

#### なぜ問題か

- ensureContrast は 1 色ずつ独立に補正する設計だが、AccentPalette は 8 色の相互関係を不変条件で保証する。この 2 つの責務が衝突する
- enforceAll が AccentPalette を返す以上、補正後の 8 色が AccentPalette の不変条件を満たす必要がある
- spec.md はこの衝突について言及していない

#### 改善案

**A. enforceAll を AccentPalette 全体で最適化する**: 1 色ずつではなく 8 色を同時に考慮して L を調整。制約充足問題として解く

**B. enforceAll の戻り値を AccentPalette ではなく OklchColor[] にする（推奨）**: コントラスト補正後は集約の不変条件を適用しない。HighlightMap への入力は「補正済み色配列」とする。AccentPalette は「調和色生成の品質保証」に使い、enforceAll 以降は別の型で扱う

**C. AccentPalette の不変条件を「補正前のみ」に適用する**: buildAccentPalette の出力で検証し、enforceAll 後は検証しない

---

### 6. GenerateThemeUseCase のドメインサービス DI が過剰【低】

#### 問題

spec.md の GenerateThemeUseCase:

```typescript
constructor(
  private readonly harmonyService: ColorHarmonyService,
  private readonly contrastService: ContrastGuardService,
  private readonly roleService: RoleAssignmentService,
  private readonly outputPort: ThemeOutputPort,
)
```

ColorHarmonyService、ContrastGuardService、RoleAssignmentService はいずれもステートレスな純粋関数の集まりであり、外部依存がない。これらを DI で注入する必要があるのは、差し替え可能性が求められる場合だけ。

#### なぜ問題か

- ドメインサービスは「外部依存ゼロ」なので、テスト時にモックする必要がない。本物をそのまま使えばよい
- DI で注入すると UseCase のコンストラクタが肥大化し、テスト時の組み立てが煩雑になる
- Port (ThemeOutputPort) の DI は正当（外部依存があり差し替えが必要）。ドメインサービスとは事情が異なる

#### 改善案

ドメインサービスは UseCase 内で直接インスタンス化する（または関数として import する）。DI は ThemeOutputPort のみにする。

```typescript
class GenerateThemeUseCase {
  constructor(private readonly outputPort: ThemeOutputPort) {}

  execute(seeds: SymbolicColor[], meta: ThemeMeta): string {
    const palette = new ColorHarmonyService().buildAccentPalette(seeds);
    // ...
  }
}
```

あるいは、ドメインサービスをそもそも class にせず、純粋関数の module として export する。

---

### 7. HighlightDef が OklchColor ではなく hex string を保持している【中】

#### 問題

HighlightDef の fg/bg は `string (hex)` として定義されている（spec.md L413-437）。issue #1 (fromHex 依存) と関連するが、独立した設計上の問題でもある。

#### なぜ問題か

- Domain 層内で hex string を扱うと、OklchColor との変換が頻繁に発生する
- RoleAssignmentService が AccentPalette (OklchColor[]) から HighlightMap (hex string) を作る際に toHex 変換が入る。その後 HighlightMap.create で fromHex に戻して contrastRatio を検証する。**無駄な往復変換**
- hex は sRGB gamut 内に clamp された後の値。Domain 層では gamut mapping 前の OklchColor で計算すべき

#### 改善案

HighlightDef の fg/bg を OklchColor にする。hex への変換は ThemeOutputPort (Gateway 層) の責務とする。HighlightMap.toRecord() も OklchColor を返し、hex 変換は Gateway が行う。

これにより issue #1 も同時に解消される。

---

## 深刻度一覧

| ID | 指摘 | 深刻度 |
|----|------|--------|
| 1 | OklchColor.fromHex の Domain 内使用が「外部依存ゼロ」原則と矛盾 | 高 |
| 2 | L_CONST=0.68 がコントラスト不確定帯 | 中 |
| 3 | AccentPalette 不変条件と buildAccentPalette 生成アルゴリズムの整合性不足 | 高 |
| 4 | NeutralScale の「全ステップ同一 Hue」不変条件が過剰 | 低 |
| 5 | enforceAll の L 補正が AccentPalette 不変条件を壊しうる | 高 |
| 6 | ステートレスなドメインサービスの DI が過剰 | 低 |
| 7 | HighlightDef が hex string を保持し Domain 内で hex 変換が頻発 | 中 |

## 影響関係

- **issue #1 と #7 は同根**: HighlightDef を OklchColor ベースにすれば両方解消
- **issue #3 と #5 は同根**: AccentPalette の不変条件の適用範囲を明確にすれば両方整理できる
- **issue #2 は独立**: L ターゲット値の調整のみで対応可能
