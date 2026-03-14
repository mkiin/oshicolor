# R2 設計リサーチ：カラーテーマ自動生成の業界事例と oshicolor への示唆

## 概要

現行の R2 実装が抱える問題（パステル系でbgが崩壊・鮮やかな暗色がbgに来る）に対して、
業界の主要プロジェクトがどう解決しているかを調査し、今後の設計方針を整理する。

---

## 現行 oshicolor の問題

```
問題1: L最小 → Normal.bg（現行ロジック）
  #57151e（暗い赤、C≈0.11）が bg に来て視覚的に疲れる背景になる

問題2: パステル系キャラクターへの非対応
  全色のL が 0.5以上のパレットでは L最小でも明るすぎて
  ダークテーマが成立しない

問題3: 良い色が切り捨てられる
  ニュートラル・灰系の色が面積小で抽出されず、
  bg候補として使えない色が無視されている

問題4: ユーザーが介入できない
  アルゴリズムが壊れたときのエスケープハッチがない
```

---

## 業界事例の調査

### 1. Material You / HCT（Google）

**最も体系的。bgを構造的に守る設計。**

核心は「seed color から bg を取らない」。
source color（1色）を HCT で分解し、5 つの tonal palette を生成。

```
accent1  (primary)   : chroma 48
accent2  (secondary) : chroma 16
accent3  (tertiary)  : chroma 32, hue +60°
neutral1 (bg系)      : chroma 4   ← bg はここから取る
neutral2 (outline系) : chroma 8
```

bg/surface は neutral1 の tone 6（dark）または tone 98（light）から
**機械的に取り出す**。chroma が 4 程度なので鮮やかな bg が来ない。

Android 13 からは 6 つの variant が追加された。

| variant    | 性格                              |
| ---------- | --------------------------------- |
| TONAL_SPOT | デフォルト。適度なアクセント      |
| VIBRANT    | 高彩度。鮮やか全開                |
| EXPRESSIVE | tertiary が主役。意外な組み合わせ |
| SPRITZ     | 彩度低め。脱色系                  |
| FIDELITY   | seed color に忠実                 |
| CONTENT    | seed color を最大限保持           |

**oshicolor への示唆：**
提案していた「Dark Classic / Dark Muted / Light Pastel」の 3 コンセプトは
Material You の TONAL_SPOT / SPRITZ / LIGHT に相当する。方向性は正しい。
**bg を抽出色から取らず生成する**という核心的な発想が参照できる。

---

### 2. pywal / wallust（Linux ricing 系）

**最も素朴。現行 oshicolor と同じ問題を抱えている。**

画像から k-means で色を抽出し、ANSI 16 色に直接マッピング。

- `colors[0]`（最暗色）→ background
- `colors[15]`（最明色）→ foreground
- `-b` フラグで bg を手動指定（エスケープハッチ）
- `-l` フラグでライトテーマに切り替え

**実際に起きている問題（wallust issues）：**

- dark/softdark variants で background と color0 が同色になり
  Neovim の CursorLine が見えなくなる
- palette variant（dark / harddark / softdark / ansidark 等）を複数用意して一部回避
  しているが根本解決はされていない

wpgtk は pywal に GUI と「auto color-scheme sorting」を追加。
生成後に手動編集できる UI でアルゴリズムの限界を補う。

**oshicolor への示唆：**
L最小→bg は pywal の colors[0]→background と同発想。
同じ問題にぶつかっている。wpgtk の「自動生成 + 手動編集 UI」は
提案している「コンセプト選択 + 手動差し替え」UI と同じ方向。

---

### 3. Base16 / Base24 / Tinted Theming

**アーキテクチャ層のプロジェクト。セマンティックロールが参考になる。**

16 色に固定的なセマンティックロールを割り当てるフレームワーク。
スキームを一度設計すれば多数のアプリで即座に利用できる。

```
base00 = Default Background
base01 = Lighter Background (CursorLine 等)
base02 = Selection Background
base03 = Comments
base04 = Dark Foreground
base05 = Default Foreground
base06 = Light Foreground
base07 = Light Background (Light theme 用)
base08 = Variables, Red
base09 = Integers, Constants, Orange
base0A = Classes, Yellow
base0B = Strings, Green
base0C = Support, Cyan
base0D = Functions, Blue
base0E = Keywords, Purple
base0F = Deprecated, Brown
```

Base16 は色の生成アルゴリズムを持たない。
230 以上のスキームは全て手動設計。
tinty（公式ツール）は画像から base16 スキームを推定する機能を持つが補助的。

**oshicolor への示唆：**
Base16 のロールマッピングは oshicolor の Zone A/B/C と同じセマンティックレイヤー。
Base16 は「固定マッピング」で、oshicolor は「動的マッピング」。
base01-02（CursorLine, Selection）を bg から生成する階層的な考え方は参照できる。

---

### 4. vscode-theme-generator

**「bg/fg だけはユーザーが指定する」設計を明示。**

background・foreground・color1-4 の計 6 色を指定するだけで
VS Code のフルテーマを自動展開するツール。

```typescript
base: {
  background: '#12171F',  // ユーザーが明示的に指定
  foreground: '#EFEFEF',  // ユーザーが明示的に指定
  color1: blue,           // → keyword, boolean, storage
  color2: red,            // → string, regex
  color3: green,          // → type, tag
  color4: yellow          // → function, attribute
}
```

bg/fg はアルゴリズムで選ばない設計。
「失敗するリスクが高い」として意図的に避けている。

**oshicolor への示唆：**
アクセント色の展開は自動化しつつ、bg/fg だけはユーザー判断に委ねるアプローチは
業界の実践的な解。「bg の選定は難しい」という認識を示している。

---

## 比較マップ

```
              bg/fg の決め方          アクセント色           ユーザー介入
────────────────────────────────────────────────────────────────────────
Material You  生成（neutral tone）    seed → 5 palette      variant 選択（6種）
pywal         抽出[0]（最暗色）       抽出そのまま          -b手動, -l反転
Base16        手動（scheme作者）      手動（scheme作者）    なし（完成品を選ぶ）
vscode-gen    ユーザー手動指定        4色から自動派生       bg/fg手動
wallust       抽出[0]（最暗色）       抽出そのまま          variant選択（8種）
Vivaldi等     固定（ブラウザ既定）    コンテンツから動的    accent on/off

oshicolor現行 抽出L最小（崩壊あり）  Zone A/B自動          なし（課題）
```

---

## 業界からの結論

> **「bg を画像から直接取るプロジェクトは全て bg 問題を抱えている。」**

pywal/wallust がまさにそうで、background と color0 の区別がつかない問題を
年単位で議論している。

**解決策は 2 つに収束している：**

**A. bg を生成する（Material You 方式）**
seed color の hue だけ借りて、chroma/tone は固定式で生成。
構造的に bg 問題が起きない。

**B. bg をユーザーに選ばせる（vscode-theme-generator / wpgtk 方式）**
アルゴリズムの限界を認め、bg/fg だけはユーザー判断に委ねる。
アクセント色の展開は自動化。

---

## oshicolor の設計方針（案）

提案していた「コンセプト 3 種 + 手動差し替え UI」は A と B の両取りであり、
業界全体のベストプラクティスに沿っている。

### bg 生成戦略（A 方式：Material You 参考）

```
現行:  抽出色の L最小 → bg  （パステルで崩壊）

提案:  象徴色の Hue を取得
       → neutral = oklch(targetL, chroma=0.02, hue=象徴色H)
       → dark bg  = neutral(L=0.12)  ← 常にほぼ無彩色で暗い
       → light bg = neutral(L=0.96)  ← 常にほぼ無彩色で明るい
       → CursorLine 等の派生も同パレットから階層的に生成
```

こうすると：

- `#57151e`（暗い赤）が bg に来る問題 → 解消（neutral は chroma≈0.02）
- パステルキャラで L最小が明るすぎる問題 → 解消（L を tone 固定）
- bg にキャラクターの空気感が残る → Hue だけ受け継ぐので薄く残る

### コンセプト 3 種

| コンセプト       | bg の取り方           | fg の取り方                   | Zone B C_RATIO | 向いているキャラクター   |
| ---------------- | --------------------- | ----------------------------- | -------------- | ------------------------ |
| **Dark Classic** | neutral 生成 (L=0.12) | 抽出 L最大 or neutral(L=0.88) | 0.35           | ダーク・クール           |
| **Dark Muted**   | neutral 生成 (L=0.10) | 抽出 L最大 or neutral(L=0.85) | 0.20           | 全体的に鮮やかなキャラ   |
| **Light Pastel** | neutral 生成 (L=0.97) | 抽出 L最小 or neutral(L=0.15) | 0.40           | パステル・白背景系キャラ |

**Dark Muted** は C_RATIO を低くすることで Zone B の補完色も控えめになる。
**Light Pastel** は fg/bg ロジックが反転し、Zone B の L 計算も反転させる必要がある。

### ユーザー介入フロー（B 方式）

```
① 画像をドロップ → 抽出（最大12色）
② コンセプトを選ぶ
     [Dark Classic]  [Dark Muted]  [Light Pastel]
③ 自動生成 → エディタプレビュー表示
④ 気に入らない色は抽出パレットから手動差し替え
     各パレットカードに [bg候補] [fg候補] [kw] [fn] などロールボタン
     → クリックで即座にプレビュー更新
⑤ 再生成ボタン → 同コンセプトで作り直す
```

### 実装優先順位

```
優先度 高:
  1. bg を neutral 生成に切り替え（現行の最大の崩壊ポイント）
  2. コンセプト選択 UI（3種の切り替えタブ）

優先度 中:
  3. Light Pastel コンセプトの Zone B L反転対応
  4. パレットから手動でロール割り当て UI

優先度 低:
  5. C_RATIO / C_FLOOR のコンセプト別チューニング
  6. コントラスト比の検証（WCAG AA 準拠チェック）
```

---

## 未解決の問題

**neutral の chroma 値**
Material You は chroma 4（HCT スケール）≈ OKLch 約 0.02。
0.01〜0.04 のどこが「空気感を残しつつ無難」か要調整。

**fg も neutral から生成するか**
fg は抽出色 L最大 を使うか、neutral palette の高 tone から取るか。
L最大の色がパステルだと fg が薄すぎる場合がある。

**コンセプトの自動推定**
パレットの平均 L からコンセプトを自動推奨できるか。
全色 L > 0.5 なら Light Pastel を自動選択するなど。

**Zone A の役割再定義**
bg が neutral 生成になると、抽出色は全て accent 候補になる。
keyword / function / special は依然として C ランクで決定できる。
fg も neutral 生成なら前処理の「L最大→fg」も不要になる可能性がある。
