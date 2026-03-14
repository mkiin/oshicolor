# R2 実装プラン v2: キャラクターカラースキーム生成

## なぜ v2 が必要か

v1（実装済みの `color-mapper.ts`）は **Hue レンジで抽出色をグループに分類する**設計だった。
全12色が紫/マゼンタ帯（Hue 270〜350°）に集中した画像で試した結果、
`@string` / `@type` / `@function` が同一色または Normal.fg になり、
構文ハイライトとして機能しないことが確認された。

根本原因は「パレットに全 Hue レンジの色が揃っている」という暗黙の前提。
キャラクターイラストは特定の色調に偏るため、この前提は成立しない。

---

## 設計思想：3ゾーン構造

「キャラクターテーマ」の正体を分解すると：

```
① 背景の色・雰囲気      ← 最も支配的。キャラクターの「世界」を作る
② keyword の色          ← 最も頻繁に目に入る。テーマの「顔」
③ 全体の色温度・彩度感   ← 補完色が「同じ空気感」を持つかどうか
```

これを踏まえ、色のゾーンを3つに分ける。

```
┌─ Zone A: キャラクター色（抽出パレットから直接使う）
│   Normal.bg    ← L 最小
│   Normal.fg    ← L 最大
│   @keyword     ← C 最大（象徴色・テーマの顔）
│   @function    ← C 2位
│   @special     ← C 3位
│   Comment      ← C 最小
│   UI 派生系    ← bg から shiftL
│
├─ Zone B: キャラクター色に「調和させた」補完色（生成）
│   @string      不足 Hue を補完。C を低く抑えた「脇役色」
│   @type        同上
│   @number      同上
│
└─ Zone C: 意味論的慣習色（固定）
    DiagnosticError  / DiagnosticWarn / DiagnosticInfo / DiagnosticHint
    GitSignsAdd / GitSignsDelete / GitSignsChange
```

Zone A だけでキャラクターテーマとして成立する。
Zone B は「同じ世界の空気感を持ちながら視認性を確保する」役割。
Zone C はキャラクターと無関係に慣習通りに固定する。

---

## Zone A：C 値ランクによる直接割り当て

### v1 との違い

|                      | v1                             | v2                       |
| -------------------- | ------------------------------ | ------------------------ |
| グループの決め方     | Hue レンジで分類               | C 値の順位で直接割り当て |
| 単色パレットへの耐性 | なし（全色が同グループになる） | あり（C 順位は常に一意） |

### アルゴリズム

```
前処理:
  L 最小 → Normal.bg（used に追加）
  L 最大 → Normal.fg（used に追加）
  残りの C 最小 → Comment（used に追加）

accents = used 以外の色を C 降順で並べたリスト

Zone A 割り当て:
  accents[0] → @keyword   （キャラクターの象徴色）
  accents[1] → @function  （副象徴色）
  accents[2] → @special   （第3色）
```

Hue を一切参照しないため、全色が同 Hue 帯でも壊れない。

---

## Zone B：補完色生成アルゴリズム

### 対象グループと target Hue

```typescript
// hue-rules.ts を以下の形式に刷新する
export const ZONE_B_TARGETS = [
  { group: "String", targetHue: 130, hueRange: 45 }, // 緑系
  { group: "Type", targetHue: 195, hueRange: 45 }, // 水色系
  { group: "Number", targetHue: 55, hueRange: 45 }, // 黄金系
] as const;
```

### 判定と生成のフロー

各グループについて以下の順で処理する。

```
Step 1: zoneBCandidates（accents[3] 以降）に
        targetHue ± hueRange 内の色があるか確認
          → あれば: その色をそのまま使用（抽出色優先）
          → なければ: Step 2 へ

Step 2: 象徴色（accents[0]）を基準に補完色を生成
  L = max(bgL + 0.35, signature.l + 0.08)   // bg より明るく保証
  C = max(signature.c × 0.35, C_FLOOR)       // 脇役らしい低彩度
  H = targetHue                               // 固定 Hue

Step 3: sRGB ガマットクランプ
  clampChroma({ mode: "oklch", l, c, h }, "oklch", "rgb")
  // culori の clampChroma が使用可能なことを確認済み

Step 4: クランプ後に C < C_FLOOR なら Hue を +20° シフトして再試行
  それでも C < C_FLOOR の場合: C_FLOOR に固定
```

### 定数

```typescript
const C_FLOOR = 0.06; // 補完色の最低彩度（パステルキャラクター対策）
const C_RATIO = 0.35; // 象徴色の C に対する脇役の C の比率
```

### 設計意図

C を `signature.c × 0.35` に抑えることで、
「キャラクター象徴色（@keyword）だけが鮮やかで、補完色（@string等）は
同じ世界にいる脇役」という構図を作る。

---

## Zone C：意味論的慣習色（本プランでは設計のみ、実装は後続タスク）

DiagnosticError 等はキャラクターパレットから導出しない。
kanagawa の設計を参考に、固定 base 色と bg のブレンドで生成する。

```typescript
// 将来実装（今回のスコープ外）
const SEMANTIC_BASE = {
  error: "#e82424",
  warning: "#ff9e3b",
  info: "#658594",
  hint: "#6a9589",
  gitAdd: "#76946a",
  gitDel: "#c34043",
  gitChg: "#dca561",
};
```

---

## 変更ファイルと変更内容

### `src/features/theme-generator/hue-rules.ts`

**役割が変わる。** Zone A の分類表から Zone B の target Hue 定義表へ。

```typescript
// 変更前: Zone A で抽出色を分類するための Hue レンジ表
export const HUE_RULES: Array<{ min: number; max: number; group: string }>;

// 変更後: Zone B で補完色を生成するための target Hue 表
export const ZONE_B_TARGETS: ReadonlyArray<{
  group: string;
  targetHue: number;
  hueRange: number;
}>;
```

### `src/features/theme-generator/color-mapper.ts`

Step 3〜5 を書き換える。それ以外は変更なし。

| 箇所                                     | 変更内容                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| `matchHueGroup()` 関数                   | **削除**（Zone A では Hue を参照しなくなる）                              |
| `hueDist()` 関数                         | **存続**（Zone B の zoneBCandidates 検索で使う）                          |
| Step 3（Hue 分類ループ）                 | **削除**→ C ランク割り当てに置き換え                                      |
| Step 4（REQUIRED_GROUPS フォールバック） | **削除**→ Zone B 生成ロジックに置き換え                                   |
| Step 5（Number = Function）              | **修正**→ Number は ZONE_B_TARGETS で独立割り当て済みになるため不要になる |
| Step 6（HighlightMap 構築）              | **変更なし**（grouped Map から取り出す構造は同じ）                        |
| import 文                                | `HUE_RULES` → `ZONE_B_TARGETS` に変更、`clampChroma` を追加               |

### 変更しないファイル

| ファイル                                | 理由                                          |
| --------------------------------------- | --------------------------------------------- |
| `src/features/theme-generator/types.ts` | 型定義に変更なし                              |
| `src/routes/index.tsx`                  | `mapColorsToTheme()` のシグネチャが変わらない |

---

## 懸念点と対処

### 懸念 1: Zone A の keyword / function が視覚的に近すぎる

単色パレットでは accents[0] と accents[1] が同 Hue 帯になり、
@keyword と @function が似た色になる可能性がある。

**対処:** これはキャラクターの性質上避けられない。
L と C の差（accents[0] は C 最大、accents[1] は C 2位）で
区別できるレベルを確保できる。
将来的にはコントラスト比チェック（ΔE 検証）で定量評価する。

### 懸念 2: C_FLOOR / C_RATIO の妥当性

`C_FLOOR = 0.06` / `C_RATIO = 0.35` は仮の値。
パステル系キャラクターや高彩度キャラクターで見え方が変わる。

**対処:** 定数を `hue-rules.ts` に集約して変更しやすくする。
複数の画像で目視検証後に調整する。

### 懸念 3: muddy zone（Hue 80〜110° 付近）

@string（target 130°）は境界に近く、clampChroma 後に C が大きく落ちる可能性がある。

**対処:** Step 4 の Hue シフト（+20°）で対応。
130° → 150° にずれても「緑〜水色系」の印象は保てる。

---

## 実装順序

```
1. hue-rules.ts を ZONE_B_TARGETS に書き換え
2. color-mapper.ts の import を更新
3. matchHueGroup() を削除
4. Step 3 を C ランク割り当てに置き換え
5. generateSupplemental() ヘルパーを追加
6. Step 4 を Zone B 生成ロジックに置き換え
7. Step 5 を整理
8. pnpm build + biome check で確認
9. ブラウザで複数画像を試して目視確認
```
