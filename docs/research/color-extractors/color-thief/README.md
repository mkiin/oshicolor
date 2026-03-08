# color-thief（colorthief v3+）調査

> npm: `colorthief` | ブラウザ + Node.js 対応

---

## 概要

`colorthief`（v3 以降、パッケージ名は `colorthief`）は lokesh/color-thief の TypeScript 完全書き直し版。
ブラウザと Node.js で同一 API を提供し、OKLCH 色空間による量子化を標準搭載している。

---

## アーキテクチャ（シングルパッケージ）

node-vibrant のモノレポ構成とは異なり、シングルパッケージ構成。

```
src/
├── index.ts            ← 公開 API エントリ
├── api.ts              ← getColor / getPalette / getSwatches
├── pipeline.ts         ← 抽出パイプライン（サンプリング → 量子化）
├── progressive.ts      ← 3パス段階的抽出
├── observe.ts          ← video/canvas/img のリアルタイム監視
├── sync.ts             ← ブラウザ専用同期 API
├── color.ts            ← Color オブジェクト実装
├── color-space.ts      ← RGB ↔ OKLCH 変換
├── swatches.ts         ← スウォッチ分類（OKLCH スコアリング）
├── types.ts            ← 型定義
├── resolve-loader.ts   ← 環境別ローダー解決
├── quantizers/
│   ├── mmcq.ts         ← MMCQ 量子化器（TypeScript 実装）
│   └── wasm.ts         ← WASM 量子化器（オプション）
├── loaders/
│   ├── browser.ts      ← ブラウザ向けピクセルローダー（Canvas API）
│   └── node.ts         ← Node.js 向けピクセルローダー（sharp）
└── worker/
    ├── manager.ts      ← メインスレッド側 Worker 管理
    └── worker-script.ts ← Worker スレッド側スクリプト
```

---

## 主要機能

| 機能 | 説明 |
|---|---|
| `getColorSync` / `getColor` | 支配的な1色を返す（同期/非同期） |
| `getPaletteSync` / `getPalette` | カラーパレットを返す（同期/非同期） |
| `getSwatchesSync` / `getSwatches` | 6種のセマンティックスウォッチを返す |
| `getPaletteProgressive` | 3パス段階的抽出（AsyncGenerator） |
| `observe` | video/canvas/img をリアルタイム監視してパレット更新 |
| `createColor` | RGB 値から Color オブジェクトを生成 |

### オプション

| オプション | デフォルト | 説明 |
|---|---|---|
| `colorCount` | `10` | パレット色数（2–20） |
| `quality` | `10` | サンプリング間隔（1 = 全ピクセル） |
| `colorSpace` | `'oklch'` | 量子化色空間: `'rgb'` or `'oklch'` |
| `ignoreWhite` | `true` | 白色ピクセルをスキップ |
| `worker` | `false` | Web Worker にオフロード |
| `signal` | — | AbortSignal |

---

## Color オブジェクト

node-vibrant の `Swatch` より豊富なインターフェース。

| メソッド / プロパティ | 返り値 |
|---|---|
| `.rgb()` | `{ r, g, b }` |
| `.hex()` | `'#ff8000'` |
| `.hsl()` | `{ h, s, l }` |
| `.oklch()` | `{ l, c, h }` |
| `.css(format?)` | CSS 文字列（`'rgb'` / `'hsl'` / `'oklch'`） |
| `.array()` | `[r, g, b]` |
| `.textColor` | `'#ffffff'` or `'#000000'`（WCAG 基準） |
| `.isDark` / `.isLight` | boolean |
| `.contrast` | `{ white, black, foreground }` — WCAG コントラスト比 |
| `.population` | ピクセル数 |
| `.proportion` | 0–1 の相対比率 |

---

## 詳細比較

→ [vs-node-vibrant.md](./vs-node-vibrant.md)
