# MVP-1/palette-design/V01 spec レビュー

## 総評

spec の全体設計は **実現可能であり、実用性も高い**。
色相環ギャップ充填アルゴリズムは理論的に健全で、既存コードベースとの接続点も明確。
ただし以下の点で改善・補足が必要。重要度順に整理する。

---

## P0: 実装前に解決すべき問題

### 1. ensureContrast が dark theme 専用

**現状:** `fg-adjuster.ts` の `ensureContrast` は L を上方向にのみ探索する（L += 0.01）。
light theme では fg が bg より暗い（L が小さい）ため、コントラスト不足時は **L を下げる** 必要がある。

**spec の記述:** 「L を L_STEP ずつ上げて（dark）/ 下げて（light）探索」と書いてあるが、既存実装はこれに対応していない。

**対応案:** ensureContrast を theme-aware にリファクタするか、新規に双方向探索版を実装する。

### 2. neutral fg 系の固定 L 値がコントラスト要件を満たさない可能性

dark theme での固定値:

| key | L | bg との差 | 懸念 |
|---|---|---|---|
| border | 0.30 | bg.l(0.14) + 0.16 | OKLCH L の差 0.16 は WCAG 3.0 を満たさない可能性がある |
| line_nr | 0.40 | bg.l(0.14) + 0.26 | ギリギリ |
| comment | 0.45 | bg.l(0.14) + 0.31 | おそらく OK |

OKLCH L と WCAG コントラスト比は非線形なので、L の差だけでは判断できない。
**bg.l が範囲の上限（0.18）** のとき border(0.30) は 3.0 を下回る可能性が高い。

**対応案:** 固定値を設定した後、ensureContrast を適用する。spec の §8 コントラスト保証テーブルに neutral の comment/line_nr/border/delimiter が含まれているので、実装時に適用順序を明確にする（派生 → コントラスト補正）。

### 3. sRGB gamut 外の色が生成される可能性

spec は OKLCH 空間で L/C/H を自由に設定するが、**OKLCH の全域が sRGB に収まるわけではない**。
特に以下のケースで gamut clipping が発生する:

- 高彩度 (C > 0.15) + 特定色相（青〜紫）で L_target = 0.75
- fillGaps で導出された色相 + C_target の組み合わせ

culori は gamut 外の値を clamp するが、clamp 方法（chroma reduction vs L adjustment）によって結果が異なる。

**対応案:** `oklchToHex` 内で culori の `toGamut('srgb')` を明示的に適用し、gamut mapping 戦略を spec に記載する。chroma を優先的に下げる方針が自然（色相と明度を保ちたいため）。

---

## P1: 実用性に影響する設計上の懸念

### 4. Valibot 移行が前提 — 既存 Zod コードの移行計画が必要

プロジェクトは Zod から Valibot への移行を進めている。
palette-generator は Valibot で新規実装するが、既存コード（`src/core/config/env.ts` 等）にはまだ Zod が残っている。

**対応案:**
- palette-generator は spec 通り Valibot で実装する
- `pnpm add valibot` で依存を追加する
- 既存の Zod 使用箇所は別タスクとして Valibot に移行する（palette-generator のスコープ外）
- CLAUDE.md のバリデーション欄も Valibot に更新する

### 5. fg 系 neutral の C に bg.c を使う設計の妥当性

spec §5: 「fg 系は fg の H を保持し、C は bg.c（低彩度）」

bg.c は clampNeutral 後に最大 0.02（多くの場合 0.015 以下）。
これにより comment / line_nr / border / delimiter は **事実上の無彩色** になる。

- **メリット:** neutral が確実に neutral に見える
- **デメリット:** キャラの色味が fg 系に一切反映されず、全キャラで同じ灰色になる

fg.c をそのまま使うか、`min(fg.c, 0.03)` のような弱い上限の方が、キャラらしさと neutral のバランスが取れる可能性がある。

**判断:** 意図的な設計判断であれば問題ないが、24 キャラの SVG 検証で実際の見え方を確認してから確定した方がよい。

### 6. color8 (error) の C_target 適用が不自然

color8 は hue=25° 固定の「意味色」だが、C と L は他の隙間充填色と同じ target を使う。
AI 3 色の彩度中央値が低い場合（淡い色のキャラ）、error が目立たない赤になる。

**対応案:** color8 の C に下限を設ける（例: `max(C_target, 0.12)`）。error は常に目を引く必要がある。

---

## P2: 改善推奨

### 7. light theme の fg 系 L 値の delimiter (0.40) が fg (0.15-0.25) に近すぎる

light theme で delimiter.L=0.40、fg.L=0.15〜0.25。
delimiter は括弧やカンマなど補助的な記号だが、fg よりかなり暗い。通常 delimiter は fg より薄く（bg に近く）するのが自然。

**対応案:** light theme の delimiter を 0.55〜0.60 程度に引き上げる。

### 8. variant 生成の拡張性

現在 variant は color1 と color3 の 2 つだけ。将来 syntax role が増えた場合に variant のルールを追加する可能性があるが、現時点では過剰設計を避けるべき。

**判断:** 現状で十分。必要になったら拡張する。

### 9. テスト戦略の明記

spec にはテスト用 SVG 出力（§10）は書かれているが、**ユニットテストの戦略がない**。

最低限テストすべき関数:
- `computeGaps`: wrap-around のエッジケース
- `fillGaps`: 均等配置、暖色密集、2色入力
- `clampNeutral`: 範囲内/外のケース
- `ensureContrast`: light/dark 両方向

---

## P3: 軽微な指摘

### 10. spec と plan の重複

`plan.md` と `spec.md` で同一のアルゴリズム説明が重複している。
plan は「なぜこう設計したか」、spec は「何を実装するか」で棲み分けた方がメンテしやすい。

### 11. HueGap の size が冗長

`HueGap` の `size` は `start` と `end` から計算可能。
ただし wrap-around の計算を毎回書くより持っておく方が実用的なので、許容範囲。

---

## 既存コードベースとの接続性

| 既存コード | 再利用度 | 備考 |
|---|---|---|
| `highlight-mapper/core/oklch-utils.ts` | **高** | hexToOklch, oklchToHex, contrastRatio をそのまま使える |
| `highlight-mapper/core/fg-adjuster.ts` | **中** | light theme 対応が必要（P0 #1） |
| `shared/lib/contrast.ts` | **低** | CIE L* ベースで OKLCH と系が異なる。oklch-utils の contrastRatio で十分 |
| `highlight-mapper/core/neutral-palette.ts` | **参考** | 設計が異なる。新規実装が必要 |
| `scripts/test-vision-ai.ts` | **高** | SVG 生成の拡張ベースとしてそのまま使える |

---

## まとめ

| 優先度 | 件数 | 概要 |
|---|---|---|
| P0 | 3 件 | ensureContrast の双方向化、neutral 固定 L のコントラスト検証、gamut mapping |
| P1 | 3 件 | Zod 統一、fg 系 C の設計判断、color8 の C 下限 |
| P2 | 3 件 | delimiter L 値、variant 拡張性（現状 OK）、テスト戦略 |
| P3 | 2 件 | ドキュメント重複、HueGap 冗長性 |

**結論:** アルゴリズムの核心（色相ギャップ充填）は堅実で、既存コードとの統合も現実的。
P0 の 3 件を spec に反映すれば実装に進められる。
