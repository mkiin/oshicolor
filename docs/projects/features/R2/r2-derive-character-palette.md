# deriveCharacterPalette — 設計ドキュメント

> 作成日: 2026-02-23  
> 対象ファイル: `src/features/color-extractor/palette-from-vibrant.ts`  
> 前提ドキュメント: `r2-plan-v4.md` / `r2-color-mapping-v3.md`

---

## 概要

`deriveCharacterPalette` は node-vibrant の抽出結果（6スロット + MMCQ 48色）を受け取り、
Neovim カラースキーム用の **bg / fg / accent + syntax 8色** を生成する関数。

アルゴリズムの核心は **mini.hues** の発想を OKLch 色空間で再実装したことにある。
「bg/fg の色相から最も離れた等間隔グリッドを syntax 色相として使う」という原理が、
アニメキャラクターの配色に自然にマッチする。

---

## なぜ mini.hues アプローチを選んだか

### r2-plan-v4 の問題

v4 設計（Hue ゾーンスコアリング）は「64 Swatch から 6 つの役割ゾーンを探索して埋める」方式だった。
しかし実装前に以下の問題が明確になった：

- アニメキャラのイラストは **2〜3 色相しかカバーしない** ことが多い。
  残りの 3〜4 ゾーンは必ず合成になる。
- Hue ゾーンの「探索 → 候補なし → 合成」というパスが複雑で、
  何が起きているかデバッグしにくい。

### mini.hues が解決したこと

neovim カラースキームジェネレータ **mini.hues** のアプローチは逆の発想：

> **「最初から全 Hue グリッドを合成して、画像色が存在するゾーンだけ後から上書きする」**

これにより：

1. ベースライン生成が純粋なアルゴリズム（失敗しない）
2. 上書きは画像に色があった場合のボーナス
3. どのゾーンが画像由来か / 生成値かが明示される

```
Node-vibrant 6スロット
  + MMCQ 48色
       │
       ▼
  ── Step 1: mini.hues ベースライン ──
  │  bg/fg の色相から最も遠い等間隔グリッド生成
  │  全 8 色を OKLch で生成（失敗しない）
  └───────────────────────────────────
       │
       ▼
  ── Step 2: 画像由来色で上書き ────────
  │  MMCQ 48色の Hue グループを走査
  │  候補あり → 適切な色を選んで置換
  │  source[name] = "image" | "generated" で追跡
  └───────────────────────────────────
       │
       ▼
  CharacterPalette（bg / fg / accent / 8 syntax 色）
```

---

## Step 1: ベースライン生成

### bg と fg の取り方

```typescript
// bg: DarkMuted の色相で L=0.13 に固定
const bg = oklchToHex(0.13, darkMutedLch.c * 0.6, bgH);

// fg: LightMuted の色相で L=0.90 に固定
const fg = oklchToHex(0.9, lightMutedLch.c * 0.5, fgH);
```

**なぜ 抽出色そのままでなく、L を固定して色相だけ借りるのか:**

r2-remaining-issues-v2 で分析した通り、「L最小の抽出色 = bg」は根本的に壊れる。
`#57151e`（暗い赤、C=0.18）のような鮮やかな暗色が bg になると視覚疲労が起きる。
パステルキャラでは最暗色の L=0.55 程度になり、ダークテーマが成立しない。

解決策: Material You の neutral tone 発想を借りて、
**Hue だけキャラクターから受け取り、L と C は固定式で管理する。**

| パラメータ | 値    | 理由                                                 |
| ---------- | ----- | ---------------------------------------------------- |
| bg L       | 0.13  | Neovim ダークテーマで十分暗い                        |
| bg C 倍率  | × 0.6 | キャラの空気感を bg に薄く残す。0.4 だと黒に近すぎる |
| fg L       | 0.90  | 十分明るい前景                                       |
| fg C 倍率  | × 0.5 | 白すぎない、ほのかに色付いた前景                     |

#### 【躓き: bg の C 倍率 0.4 が暗すぎた問題】

当初 `darkMutedLch.c * 0.4` → マゼンタキャラの bg が `#0a0608`（ほぼ真っ黒）になり、
キャラクターの雰囲気が全く出なかった。**→ 0.6 倍に引き上げ** → `#140610`（微かにマゼンタを感じる暗色）に改善。

---

### ambientChroma: 加重平均でキャラの彩度レベルを把握する

```typescript
const ambientChroma = (mutedLch.c ?? 0.05) * 0.4 + (vibrantLch.c ?? 0.1) * 0.6;
```

ambientChroma は「この画像は全体的にどれくらい鮮やかか」を表す指標。
syntax 色の chroma の上限を決めるために使う。

#### 【躓き: Muted だけで判断すると地味な画像と判定されていた問題】

当初 `ambientChroma = mutedLch.c` のみで判断していた。
`mutedLch.c ≈ 0.06`（くすんだサーモンピンク程度）のキャラで、
鮮やかな赤 `#c83339`（Vibrant.C ≈ 0.18）が画像に存在するのに
「低 chroma キャラ」として扱われ、鮮やかな赤が syntax 色から除外されていた。

**→ Vibrant(60%) + Muted(40%) の加重平均** にすることで、
画像にパンチのある色が存在する場合は鮮やかに、全体的にくすんでいる場合は控えめに変化する。

---

### syntaxChroma: 5段階の離散マッピング

```typescript
const deriveSyntaxChroma = (ambientChroma: number): number => {
  if (ambientChroma < 0.03) return 0.04; // very low
  if (ambientChroma < 0.06) return 0.06; // low
  if (ambientChroma < 0.1) return 0.08; // medium
  if (ambientChroma < 0.15) return 0.12; // mediumhigh
  return 0.16; // high
};
```

連続値を離散化する理由: ambientChroma の微妙な変化が構文色に直接影響すると、
画像によって syntax 色の彩度がバラバラになり一貫性がなくなる。
5段階に量子化することで、同じ「雰囲気のキャラクター」には同じ intensity の色が生成される。

---

### make_hues: mini.hues アルゴリズム

```typescript
const makeHues = (bgH, fgH, nHues): Partial<Record<SyntaxColorName, number>>
```

bg と fg の色相を「避けるべき色相」として、そこから最も遠い位置に
等間隔グリッドを nHues 個配置する。

```
bg hue ≈ 285°（紫）、fg hue ≈ 300°（ピンク） のとき nHues=8 の場合:

  period = 360 / 8 = 45°
  bg/fg の中間 ≈ 292° → その対極（d ≈ 112°）にグリッドをオフセット

  グリッド: [112, 157, 202, 247, 292, 337, 22, 67]°

  red(0°)    → 22° に最近
  orange(45°) → 67° に最近
  cyan(180°) → 157° または 202° に最近
  ...
```

**なぜ bg/fg を「避ける」か:**
bg と同じ色相の syntax 色はテキストが背景に埋没する危険がある。
fg と同じ色相の syntax 色は他の syntax 色との差分がわかりにくくなる。

---

### chroma damping: キャラクターと遠い色相の生成色を控えめにする

```typescript
// キャラクターの主要色相を収集（彩度が十分あるスロットのみ）
const characterHues: number[] = [];
for (const lch of [darkMutedLch, vibrantLch, mutedLch, lightMutedLch]) {
  if ((lch.c ?? 0) > 0.01 && lch.h !== undefined) {
    characterHues.push(lch.h);
  }
}

// 生成時に angular distance に応じて damping を適用
const minDist = Math.min(...characterHues.map((ch) => angularDistance(h, ch)));
const damping = 1.0 - (minDist / 180) * 0.5;
effectiveChroma = syntaxChroma * damping;
```

#### 【躓き: 生成されたシアン・紺碧が「浮く」問題】

マゼンタ/紫系のキャラクター（bg ≈ 285°、accent ≈ 330°）に対して、
等間隔グリッドが生成する cyan（≈ 176°）が原色の青緑になり、
暖色の世界観を壊す問題が発生。

**root cause:** 等間隔グリッドは「bg/fg から遠いこと」は保証するが、
「キャラクターの雰囲気との調和」は保証しない。

**解決策: chroma damping。**

- キャラクターの主要 4 スロット（DarkMuted / Vibrant / Muted / LightMuted）の色相を収集
- 生成する syntax 色の色相と、最も近いキャラクター色相の角度距離を計算
- 距離 0° で damping=1.0（変化なし）、距離 180° で damping=0.5（chroma 半減）

```
マゼンタキャラ（characterHues ≈ [285°, 330°, 300°, 315°]）の例:

  red(22°)    → 最近距離 ≈ 37°  → damping 90%  → chroma ほぼそのまま
  orange(67°) → 最近距離 ≈ 83°  → damping 77%  → 少し控えめ
  cyan(157°)  → 最近距離 ≈ 128° → damping 64%  → 控えめな霞がかったティール
  azure(202°) → 最近距離 ≈ 83°  → damping 77%  → 少し控えめ
```

Note: Step 2 で画像から選んだ色には damping を適用しない。
実際に画像に存在する色は「キャラクターの色」であり、抑制する必要はない。

---

## Step 2: 画像由来色での上書き

### selectBestSyntaxSwatch: 候補選定ロジック

```typescript
const selectBestSyntaxSwatch = (swatches, ambientChroma) => {
  // ① L 範囲フィルタ（読みやすい範囲に絞る）
  const candidates = swatches.filter((s) => {
    const lch = hexToOklch(s.hex);
    return lch.l >= SYNTAX_L_MIN && lch.l <= SYNTAX_L_MAX; // 0.45〜0.78
  });

  // ② 最低限の彩度を持つ候補を優先
  const minC = ambientChroma * 0.7;
  const above = candidates.filter((s) => hexToOklch(s.hex).c >= minC);
  const pool = above.length > 0 ? above : candidates;

  // ③ TARGET_L=0.62 に最も近い明度のものを選ぶ
  const TARGET_L = 0.62;
  return pool.reduce((best, { hex }) => {
    const d = Math.abs(hexToOklch(hex).l - TARGET_L);
    return d < bestDist ? hex : best;
  });
};
```

#### 【躓き: SYNTAX_L_MIN = 0.52 が厳しすぎた問題】

当初 `SYNTAX_L_MIN = 0.52` に設定。
`#c83339`（鮮やかな赤、L ≈ 0.50）が除外され、
代わりに `#d6988e`（くすんだサーモンピンク、L ≈ 0.55）が選ばれていた。

**→ 0.45 に引き下げ。** `bg(L=0.13)` に対してコントラストを保ちつつ、
鮮やかな暗色も syntax 候補として扱えるようになった。

#### 【躓き: 「ambientChroma に最も近い chroma を選ぶ」方式がくすんだ色を選んでいた問題】

当初の selectBestSyntaxSwatch は「ambientChroma に最も近い C 値の色を選ぶ」方式だった。
これは `#d6988e`（くすんだピンク、C≈0.05）のような色を優先してしまい、
同じグループに `#c83339`（鮮やかな赤、C≈0.18）があるのに選ばれなかった。

**発想の転換:**

- chroma で選ぶ → 「画像の彩度平均に近い色」を選んでいた（地味な色に引きずられる）
- **L で選ぶ → 「読みやすい明度 TARGET_L=0.62 に近い色」を選ぶ**（視認性が最優先）

最低限の彩度フィルタ（`ambientChroma * 0.7`）で地味すぎる色を除外してから、
残りの中で最も読みやすい明度のものを選ぶ方式に変更。

---

### 上書き判断: syntaxChroma × 0.5 ガード

```typescript
// 彩度が syntaxChroma の 50% 未満なら生成色のほうがまし
const bestLch = hexToOklch(bestHex);
if ((bestLch.c ?? 0) < syntaxChroma * 0.5) continue;
```

#### 【躓き: 低彩度画像のグレー系色が syntax を汚染する問題】

Hue グループに 3 色以上あっても、全てパステル（C ≈ 0.03）のような場合、
画像から選んだ色が syntax 色として使えない（生成色の方が鮮やか）。

**→ bestHex の C が `syntaxChroma * 0.5` 未満なら「この色は低彩度すぎる」と判断して
生成色を維持する。**

---

### HUE_LABEL_TO_SYNTAX: 2つの色空間をまたぐマッピング

vibrant-extractor の Hue グループ分類は **HSL 色空間**ベース。
mini.hues の syntax 色名は **OKLch** の知覚的色相角に基づく。

両者は微妙にずれる:

```typescript
const HUE_LABEL_TO_SYNTAX = {
  Red: "red",
  Orange: "orange",
  Yellow: "yellow",
  Green: "green",
  Cyan: "cyan",
  Blue: "azure", // HSL 200-255° ≈ OKLch azure 225°
  Purple: "blue", // HSL 255-315° ≈ OKLch blue 270°
  Magenta: "purple", // HSL 315-345° ≈ OKLch purple 315°
};
```

Blue → azure、Purple → blue、Magenta → purple という3段シフトが入っている。
これは OKLch 空間では **人間の知覚に合わせて青系の色相帯が広い**ためで、
HSL の「青」は OKLch では「azure（水色と青の中間）」に対応する。

---

## 最終的なパラメータ一覧

| パラメータ             | 値                      | 設計根拠                                       |
| ---------------------- | ----------------------- | ---------------------------------------------- |
| bg L                   | 0.13                    | ダークテーマの十分暗い背景                     |
| bg C 倍率              | × 0.6                   | キャラの空気感を残す。0.4 は黒に近すぎた       |
| fg L                   | 0.90                    | 十分明るい前景                                 |
| fg C 倍率              | × 0.5                   | ほのかな色付き                                 |
| syntaxL                | 0.72                    | bg(0.13) とのコントラストを確保する固定明度    |
| SYNTAX_L_MIN           | 0.45                    | 0.52 では鮮やかな暗色（L≈0.50）が除外された    |
| SYNTAX_L_MAX           | 0.78                    | 白飛びの手前                                   |
| TARGET_L               | 0.62                    | 読みやすさのスイートスポット（知覚的中間明度） |
| MIN_SWATCHES_FOR_TRUST | 3                       | 色数が少なすぎる Hue グループは信頼しない      |
| ambientChroma 重み     | Vibrant×0.6 + Muted×0.4 | Muted だけでは地味に判定されすぎた             |
| chroma damping 最大    | 50%（距離 180°）        | 完全な反対色でも color が消えないように        |
| 上書き判断 C 閾値      | syntaxChroma × 0.5      | 低彩度の画像色より生成色を優先する条件         |

---

## 設計上の制約と現時点での割り切り

### 1. Hue グループは HSL 基準

vibrant-extractor の Hue グループ分類は HSL 色空間で計算されている。
これを OKLch の知覚色相に再マッピングするのは近似であり、
境界付近の色相（例: HSL 255° = 青/紫境界）は誤分類の可能性がある。

将来的には MMCQ 48色を直接 OKLch の色相角でグループ化する方式が正確。

### 2. chroma damping の強さ（0.5）は調整余地あり

距離 180° で chroma 50% は経験的な値。
実際のキャラクターで試しながらチューニングが必要。
「完全に反対色は完全に消してしまってもよい」なら 0.0 に近づけてもよい。

### 3. syntaxL = 0.72 の固定は暗めのキャラクターで検証が必要

L=0.13 の bg に対して L=0.72 の syntax 色は十分なコントラストがある。
しかし画像由来の色（Step 2）は L=0.45〜0.78 の範囲で選ばれるため、
生成色（L=0.72）と画像由来色（L≈0.50）で明度の統一感がない。
統一感より「キャラクターの色を使う」を優先した結果として割り切っている。

---

## 全体フロー（まとめ）

```
入力: VibrantResult（6スロット + MMCQ 48色 Hue グループ）

── Step 0: スロット抽出 ────────────────────────────────
  DarkMuted / LightMuted / Vibrant / Muted を取得
  なければ DarkVibrant / LightVibrant でフォールバック

── Step 1a: bg / fg / accent 生成 ─────────────────────
  bg = oklch(L=0.13, C=darkMutedC × 0.6, H=darkMutedH)
  fg = oklch(L=0.90, C=lightMutedC × 0.5, H=lightMutedH)
  accent = Vibrant hex そのまま

── Step 1b: chroma パラメータ計算 ──────────────────────
  vibrantLch, mutedLch を OKLch 変換
  ambientChroma = mutedC × 0.4 + vibrantC × 0.6
  syntaxChroma = deriveSyntaxChroma(ambientChroma)  // 5段階

── Step 1c: make_hues ──────────────────────────────────
  generatedHues = makeHues(bgH, fgH, nHues=8)
  → bg/fg 色相から最も遠い等間隔8色グリッド

── Step 1d: characterHues 収集 ─────────────────────────
  [darkMutedLch, vibrantLch, mutedLch, lightMutedLch] から
  C > 0.01 のもの → characterHues[]

── Step 1e: ベースライン生成（chroma damping あり） ────
  for name in [red, orange, yellow, green, cyan, azure, blue, purple]:
    h = generatedHues[name]
    minDist = min(angularDistance(h, ch) for ch in characterHues)
    damping = 1.0 - (minDist / 180) × 0.5
    effectiveChroma = syntaxChroma × damping
    palette[name] = oklch(L=0.72, C=effectiveChroma, H=h)
    source[name] = "generated"

── Step 2: 画像由来色で上書き ──────────────────────────
  for (label, swatches) in hueGroups:
    if len(swatches) < 3: continue
    syntaxName = HUE_LABEL_TO_SYNTAX[label]  // Blue→azure 等のシフトあり
    bestHex = selectBestSyntaxSwatch(swatches, ambientChroma)
    if bestHex.C < syntaxChroma × 0.5: continue  // 低彩度は却下
    palette[syntaxName] = bestHex
    source[syntaxName] = "image"

出力: CharacterPalette {
  bg, fg, accent,
  red, orange, yellow, green, cyan, azure, blue, purple,
  source,                // 各色が "image" か "generated" か
  syntaxChroma,          // 使用した syntax chroma の基準値
  ambientChroma,         // 画像全体の彩度レベル
  vibrantC, mutedC,      // デバッグ用: 計算に使った入力値
  nHues                  // make_hues に渡した n（=8固定）
}
```

---

## 問題と克服の経緯（要約）

| 問題                                           | 原因                                          | 克服                                                                   |
| ---------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------- |
| bg が黒に近すぎる                              | `darkMutedC × 0.4` が低すぎた                 | **× 0.6** に引き上げ                                                   |
| Muted が低彩度 → 全体が地味                    | ambientChroma に Muted しか使っていなかった   | **Vibrant 60% + Muted 40% の加重平均**                                 |
| 鮮やかな暗色（L≈0.50）が syntax 候補から外れる | `SYNTAX_L_MIN = 0.52` が厳しすぎた            | **0.45 に引き下げ**                                                    |
| くすんだ色が syntax として選ばれる             | 「ambientChroma に最も近い C の色を選ぶ」方式 | **TARGET_L=0.62 に最も近い明度の色を選ぶ** 方式に変更                  |
| 低彩度パステルが画像由来色として使われる       | 彩度ガードがなかった                          | **`syntaxChroma × 0.5` 未満は却下**                                    |
| 暖色キャラにシアンや紫が原色で生成される       | 等間隔グリッドがキャラクターの色相から遠い    | **character hues からの角度距離で chroma を damping（最大 50% 減衰）** |
