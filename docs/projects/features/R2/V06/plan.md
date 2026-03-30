# R2/V6 明度2分割 seed × tonal palette

## なぜ V6 が必要か

V5（3 seed × tonal palette）は各軸から1色しか seed を取らないため、キャラクターモチーフの特徴色を逃す傾向があった。

R1 の K=3 クラスタリングは軸内の色群としてキャラの特徴を正しく捉えているが、そこから1色に絞る段階で情報が落ちる。軸内の色は hue が近いため、**明度（Tone/Lightness）で2分割** して bright/dark の2色を取ることで表現力を拡大する。

seed 選定のスコアリングには node-vibrant の Vibrant/DarkVibrant target 方式を採用する。

## 前版との変更対照表

| 項目 | V5 | V6 |
| ---- | ---- | ------ |
| seed 数 | 3（各軸1色） | 5（main×2, sub×2, accent×1） |
| seed 選定 | OkLch の L/C で単一スコアリング | node-vibrant 方式で Vibrant/DarkVibrant の2 target |
| tonal palette 数 | 3 + neutral = 4 | 5 + neutral = 6 |
| ハイライト割り当て | bright seed のみで syntax + UI | bright seed → syntax fg、dark seed → UI bg アクセント |
| フォールバック | 未定義 | dark seed が見つからない場合、bright seed の Tone を下げて合成 |

## 設計方針

### 核心: 明度2分割 seed（Vibrant / DarkVibrant）

各軸の色群は hue クラスタリング済みで hue が近い。分割軸は **明度** を使い、node-vibrant の target 方式でスコアリングする。

```
Color Axes (R1 出力)
  main:   [Color, Color, Color, ...]
  sub:    [Color, Color, ...]
  accent: [Color, ...]
       │
       ▼
  Step 1: 各軸から seed を選定
    main   → main-bright (Vibrant target)
             main-dark   (DarkVibrant target)
    sub    → sub-bright  (Vibrant target)
             sub-dark    (DarkVibrant target)
    accent → accent      (Vibrant target)
       │
       ▼
  Step 2: 各 seed から tonal palette を生成
  + neutral palette（main-bright.hue, chroma ≈ 4）
       │
       ▼
  5 tonal palettes + neutral = 6 palettes
       │
       ▼
  Step 3: ロール割り当て（Tone でグループを決定）
       │
       ▼
  Step 4: ハイライトグループへの展開
       │
       ▼
  HighlightMap
```

### Step 1: seed 選定（node-vibrant target 方式）

node-vibrant は各 swatch に saturation/luma の target を定義し、重み付き距離で最も近い色を選ぶ。V6 では Vibrant と DarkVibrant の2 target を使う。

```
Vibrant target:
  saturation = 0.74
  luma       = 0.45

DarkVibrant target:
  saturation = 0.74
  luma       = 0.26
```

軸内の全色に対して各 target からの距離を計算し、最も近い色を seed として選定する。

同じ色が両方の target で選ばれた場合、Vibrant に割り当て、DarkVibrant は「見つからない」扱いとする。

#### フォールバック: dark seed が見つからない場合

軸内に DarkVibrant target に十分近い色がない場合（距離が閾値を超える場合）、bright seed の Tone を下げて合成する。

```
dark_fallback = HCT(bright_seed.hue, bright_seed.chroma, bright_seed.tone - 20)
```

### Step 2: tonal palette の生成

V5 と同じ。各 seed の hue/chroma を保ち Tone 0〜100 のスケールを生成する。

```
palette(seed) = for T in [0, 5, 10, ..., 95, 100]:
  HCT(seed.hue, seed.chroma, T) → clamp to sRGB gamut

neutral = for T in [0..100]:
  HCT(mainBright.hue, 4, T) → clamp to sRGB gamut
```

### Step 3: ロール割り当て

6 palette の用途分担:

```
── neutral palette ──
  Normal.bg / CursorLine.bg / Pmenu.bg / StatusLine.bg / Visual.bg
  Normal.fg / Comment.fg / LineNr.fg

── main-bright palette ──（主要 syntax）
  Keyword / Function / Operator

── main-dark palette ──（UI アクセント）
  Search.bg / CursorLineNr / IncSearch / PmenuSel.bg

── sub-bright palette ──（副 syntax）
  String / Type

── sub-dark palette ──（控えめ UI）
  FloatBorder / StatusLine.fg / TabLineSel.fg

── accent palette ──（アクセント syntax）
  Special / Constant / Number
```

具体的な Tone 値の割り当ては V5 plan.md の値を基本とし、6 palette 体制に合わせて調整する。

### Step 4: ハイライトグループへの展開

V5 のハイライトマッピングを拡張する。dark seed 由来の palette が加わることで、UI 要素に画像由来の色味が乗る。

詳細は実装時に spec.md に記述する。

## 変更内容

### 実装タスク

1. **seed 選定ロジックの実装**
   - node-vibrant の Vibrant/DarkVibrant target 方式をスコアリング関数として実装
   - `selectSeed` を `selectSeeds` に変更し、bright/dark の2色を返す
   - フォールバック（dark が見つからない場合の合成）を実装

2. **tonal palette 生成の実装**
   - V5 plan の Step 2 を実装（HCT → Tone スケール）
   - 5 seeds + neutral = 6 palettes を生成

3. **ロール割り当ての実装**
   - 6 palette × Tone 値でロールを決定する関数を実装
   - bright palette → syntax 色、dark palette → UI アクセント色の分担

4. **ハイライトマッピングの実装**
   - ロールから HighlightMap への1対多展開
   - Editor UI + Diagnostics + Syntax + Treesitter 全グループ対応

5. **デバッグ SVG の更新**
   - `scripts/gen-palette-svg-sharp.ts` を 5 seeds + 6 palettes 表示に対応

## 未決定事項

- **スコアリングの色空間**: node-vibrant は HSL の saturation/luma を使う。HCT の Chroma/Tone に読み替えるか、HSL のままにするか
- **DarkVibrant の距離閾値**: フォールバックに切り替える閾値の値
- **Tone 値の具体的な割り当て表**: V5 の値を基本に dark palette 分を追加する必要がある
- **ライトテーマ**: 今回もダークテーマのみ
