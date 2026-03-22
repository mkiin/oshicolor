# R2/V9 仕様

## 実装スコープ

colorthief `getPalette(colorCount: 5)` のドミナント 5 色をそのまま seed とし、neutral palette・fg 色・diagnostic 色を生成して 66 Neovim ハイライトグループに割り当てる。

## 全体フロー

```
画像 → colorthief getPalette(colorCount: 5)
     → [d1, d2, d3, d4, d5]  (population 順)
     → buildHighlightMap(seeds)
         ├→ generateNeutralPalette(d1.oklch)   → NeutralPalette (9段階)
         ├→ adjustFgLightness(d1〜d5.oklch)    → seedFgs[5] (hex)
         ├→ generateDiagnosticColors(d1.oklch) → DiagnosticColors (4色)
         └→ mapHighlightGroups(seedFgs, neutral, diag) → HighlightMap (66グループ)
     → toColorTokens(bundle) → NeovimColorTokens
     → NeovimPreview に props で渡す
```

## seed ロール割り当て

| ロール | seed | 用途 |
| --- | --- | --- |
| primary | d1 | neutral palette の hue 源 + CursorLineNr / Title / Search 等 UI アクセント |
| secondary | d2 | Keyword / Statement / PreProc 等の syntax fg + FloatBorder |
| tertiary | d3 | Function / String / Character の syntax fg |
| quaternary | d4 | Operator / Type の syntax fg |
| quinary | d5 | Number / Boolean / Constant / Special の syntax fg |

## neutral palette 生成

`generateNeutralPalette(primaryOklch: OKLCH): NeutralPalette`

d1 の hue を借り、chroma を固定 0.02 にして lightness の段階で 9 色を生成:

```
neutral[段階] = OkLch(L=段階値, C=0.02, H=d1.hue)
```

| 変数名 | OkLch L | 用途 |
| --- | --- | --- |
| `popup` | 0.20 | Pmenu.bg |
| `bg` | 0.22 | Normal.bg |
| `surface` | 0.24 | StatusLine.bg / NormalFloat.bg |
| `cursorline` | 0.28 | CursorLine.bg |
| `visual` | 0.34 | Visual.bg / Search.bg |
| `dim` | 0.42 | LineNr.fg / Delimiter.fg |
| `border` | 0.50 | WinSeparator / NonText |
| `comment` | 0.58 | Comment.fg |
| `fg` | 0.88 | Normal.fg |

## fg lightness 調整

`adjustFgLightness(seedOklch: OKLCH): string`

seed の hue / chroma を保持し、lightness を `[0.65, 0.85]` にクランプする:

```
L = clamp(seed.l, 0.65, 0.85)
→ OkLch(L, seed.c, seed.h) → hex
```

- 暗すぎる seed は L=0.65 に引き上げ（bg=0.22 との差 0.43 を確保）
- 明るすぎる seed は L=0.85 に抑制

## diagnostic 色生成

`generateDiagnosticColors(primaryOklch: OKLCH): DiagnosticColors`

hue は固定、L は d1.l をそのまま、C は d1.c × 0.8:

| 色 | hue | 用途 |
| --- | --- | --- |
| error | 25° | DiagnosticError / DiffDelete |
| warn | 85° | DiagnosticWarn |
| info | 250° | DiagnosticInfo / DiffChange |
| hint | 165° | DiagnosticHint / DiffAdd |

## OkLch → hex 変換

`oklchToHex(l: number, c: number, h: number): string`

culori/fn の `modeRgb` で OkLch → linear RGB に変換後、0-255 にクランプして hex 文字列を生成。

## 主要な型定義

```typescript
type NeutralPalette = {
  popup: string; bg: string; surface: string; cursorline: string;
  visual: string; dim: string; border: string; comment: string; fg: string;
};

type DiagnosticColors = { error: string; warn: string; info: string; hint: string };

type HighlightDef = {
  fg?: string; bg?: string;
  bold?: boolean; italic?: boolean; undercurl?: boolean;
};

type HighlightMap = Record<string, HighlightDef>;

type HighlightBundle = {
  seeds: string[];
  neutral: NeutralPalette;
  diagnostic: DiagnosticColors;
  highlights: HighlightMap;
};
```

## 主要な定数

| 定数 | 値 | 説明 |
| --- | --- | --- |
| `NEUTRAL_CHROMA` | 0.02 | neutral palette の chroma |
| `MIN_FG_LIGHTNESS` | 0.65 | fg 色の最低 lightness |
| `MAX_FG_LIGHTNESS` | 0.85 | fg 色の最高 lightness |
| `CHROMA_SCALE` | 0.8 | diagnostic 色の chroma 倍率 |
| `DIAG_HUES.error` | 25 | 赤 |
| `DIAG_HUES.warn` | 85 | 黄橙 |
| `DIAG_HUES.info` | 250 | 青 |
| `DIAG_HUES.hint` | 165 | シアン |

## 状態設計（Jotai atom チェーン）

useEffect 禁止。全て derived atom の純粋変換チェーンで構成。

```
fileAtom (primitive)
  └→ seedColorsAtom (async derived)           color-extractor
       └→ highlightBundleAtom (async derived)      highlight-mapper
            └→ neovimColorTokensAtom (async derived)    highlight-mapper
                 ↓ route が読んで props で渡す
            NeovimPreview({ colors })
                 └→ colorTokensAtom (primitive, useHydrateAtoms)  neovim-preview
                      └→ prismThemeAtom (sync derived)
```

- `seedColorsAtom` が唯一の async 起点（画像 → colorthief）
- `highlightBundleAtom` / `neovimColorTokensAtom` は seeds を await して純粋関数を適用するだけ
- `colorTokensAtom` は NeovimPreview の内部 Provider で hydrate される primitive atom（コンポーネントの再利用性を維持）

## ディレクトリ構成

```
src/features/highlight-mapper/
├── highlight-mapper.types.ts         # NeutralPalette, DiagnosticColors, HighlightDef, HighlightMap, HighlightBundle
├── highlight-mapper.atoms.ts         # highlightBundleAtom, neovimColorTokensAtom
└── core/
    ├── oklch-utils.ts                # oklchToHex
    ├── neutral-palette.ts            # generateNeutralPalette
    ├── fg-adjuster.ts                # adjustFgLightness
    ├── diagnostic-colors.ts          # generateDiagnosticColors
    ├── highlight-groups.ts           # mapHighlightGroups (66グループ定義)
    ├── build-highlight-map.ts        # buildHighlightMap (合成関数)
    └── to-color-tokens.ts            # toColorTokens (Bundle → NeovimColorTokens)
```

## 66 ハイライトグループ

Editor UI 26 + Syntax 20 + Diagnostic 16 + Diff 4。
グループ定義の詳細は [plan.md](plan.md) を参照。

## 未実装

- route での `neovimColorTokensAtom` → `NeovimPreview` への接続
- デバッグ SVG にハイライトプレビュー追加
- Treesitter (@*) グループ拡張
- ライトテーマ対応
