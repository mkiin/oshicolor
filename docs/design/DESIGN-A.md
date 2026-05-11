# oshicolor デザインシステム — パターン A: Spotify × Linear

> **コンセプト: 「暗い劇場にコンテンツの色が浮かぶ」**
> achromatic（無彩色）な暗い器の中で、ユーザーが生成したカラーパレットとキャラクター画像だけが色を持つ。
> Spotify がアルバムアートに色を委ねるのと同じ構造を、カラーパレット生成ツールに適用する。

## プロダクト概要

- **プロダクト名**: oshicolor（おしからー）
- **概要**: キャラクターイラストからカラーパレットを抽出し、Neovim カラースキームを生成する Web アプリケーション
- **ターゲット**: 日本の Vim/Neovim ユーザー、推し文化を持つ開発者
- **言語**: 日本語（日本向けプロダクト）
- **キャッチコピー**: 推し色でエディタを染めろ！（必ず1行で表示。改行禁止）
- **技術スタック**: TanStack Start (React) / Cloudflare Workers / Tailwind CSS

## 参照デザインシステム

- **Spotify**: UIが消えてコンテンツの色が主役になる「content-first darkness」思想
- **Linear**: 精密な typography、luminance スタッキングによる深度表現、Inter Variable の活用

---

## 1. ビジュアルテーマと雰囲気

oshicolor のUIは「暗い劇場」である。Spotify が `#121212` の闇の中でアルバムアートだけが色を放つように、oshicolor では UI 自体を徹底的に achromatic（無彩色）に保ち、ユーザーがアップロードしたキャラクター画像と、そこから生成されたカラーパレットだけが色彩を持つ。

背景は Spotify の `#121212` を基調とし、Linear の luminance スタッキング（`rgba(255,255,255,0.02)` → `0.04` → `0.05`）でカード・パネルの深度を表現する。ボーダーは Linear の半透明ホワイト（`rgba(255,255,255,0.05)` 〜 `0.08`）を採用し、闇の中に微かな構造線を引く。

タイポグラフィは Linear に倣い Inter Variable を `"cv01", "ss03"` 付きで使用。ディスプレイサイズでは攻撃的な負のレタースペーシングを適用し、精密でエンジニアリングされた印象を出す。日本語フォントは Noto Sans JP をフォールバックに使用。

**核心原則: UI に色を持たせない。色はすべてユーザーのパレットから来る。**

## 2. カラーパレットと役割

### 背景サーフェス（Spotify × Linear ハイブリッド）
- **ページ背景**: `#121212`（Spotify の near-black — 劇場の闇）
- **カードサーフェス**: `rgba(255,255,255,0.02)`（Linear の luminance Level 1）
- **エレベーテッドサーフェス**: `rgba(255,255,255,0.05)`（Linear の luminance Level 2）
- **ホバーサーフェス**: `rgba(255,255,255,0.08)`（微かに浮き上がる）

### テキスト（Linear の4階層）
- **プライマリ**: `#f7f8f8`（Linear — 純白ではなく、やや暖かみのある白）
- **セカンダリ**: `#d0d6e0`（Linear — クールシルバー）
- **ターシャリ**: `#8a8f98`（Linear — ミュートグレー）
- **クォータナリ**: `#62666d`（Linear — 最も控えめ）

### インタラクティブ
- **CTA アクセント**: ユーザーが生成したパレットの primary 色を動的に適用
- **フォールバック CTA**: `#5e6ad2`（Linear のブランドインディゴ — パレット未生成時）
- **ホバー**: `#828fff`（Linear のアクセントホバー）
- **成功**: `#1ed760`（Spotify グリーン — 生成完了時のフィードバック）

### ボーダー（Linear の半透明システム）
- **サトル**: `rgba(255,255,255,0.05)`
- **スタンダード**: `rgba(255,255,255,0.08)`
- **リングシャドウ**: `rgba(0,0,0,0.2) 0px 0px 0px 1px`

### シャドウ（Spotify の重いシャドウ + Linear のレイヤード）
- **カード**: `rgba(0,0,0,0.3) 0px 8px 8px`（Spotify — ダーク上で視認できる重さ）
- **ダイアログ**: `rgba(0,0,0,0.5) 0px 8px 24px`（Spotify — 劇的なフローティング）
- **インセット**: `rgba(0,0,0,0.2) 0px 0px 12px 0px inset`（Linear — 凹んだパネル）

## 3. タイポグラフィルール

### フォントファミリ
- **プライマリ**: `Inter Variable`, フォールバック: `"Noto Sans JP", "Hiragino Kaku Gothic ProN", "SF Pro Display", -apple-system, system-ui`
- **モノスペース**: `Berkeley Mono`, フォールバック: `"JetBrains Mono", ui-monospace, SF Mono, Menlo`
- **OpenType 機能**: `"cv01", "ss03"` をグローバルに有効化

### 階層

| 役割 | サイズ | ウェイト | 行間 | 字間 | 用途 |
|------|--------|----------|------|------|------|
| ヒーロー | 48px (3rem) | 510 | 1.00 | -1.056px | 推し色でエディタを染めろ！ / 1行表示、改行しない (white-space: nowrap) |
| セクション見出し | 32px (2rem) | 510 | 1.13 | -0.704px | 機能セクションタイトル |
| カード見出し | 20px (1.25rem) | 590 | 1.33 | -0.24px | カードヘッダー |
| 本文 | 16px (1rem) | 400 | 1.50 | normal | 説明文 |
| 本文ミディアム | 16px (1rem) | 510 | 1.50 | normal | ナビ、ラベル |
| キャプション | 13px (0.81rem) | 510 | 1.50 | -0.13px | メタデータ |
| ラベル | 12px (0.75rem) | 510 | 1.40 | normal | ボタンテキスト |
| コード | 14px (0.88rem) | 400 | 1.50 | normal | Vim プレビュー内 |

### 原則
- **510 がシグネチャウェイト**: Linear の特徴。400（読む）、510（強調/UI）、590（強い強調）の3段階
- **ディスプレイサイズで負のレタースペーシング**: 48px で -1.056px、32px で -0.704px
- **日本語テキストには字間調整を適用しない**: 日本語は等幅が自然

## 4. コンポーネントスタイリング

### ボタン

**プライマリ（動的パレット色）**
- 背景: ユーザーパレットの primary 色（未生成時は `#5e6ad2`）
- テキスト: `#ffffff`
- パディング: 8px 16px
- 角丸: 6px（Linear スタイル）
- ホバー: 明度を10%上げる

**ゴーストボタン（Linear スタイル）**
- 背景: `rgba(255,255,255,0.02)`
- テキスト: `#d0d6e0`
- ボーダー: `1px solid rgba(255,255,255,0.08)`
- 角丸: 6px

**ピルボタン（Spotify スタイル — ナビ用）**
- 背景: `#1f1f1f`
- テキスト: `#ffffff`
- 角丸: 9999px
- パディング: 8px 16px

### 画像ドロップゾーン
- 背景: `rgba(255,255,255,0.02)`
- ボーダー: `2px dashed rgba(255,255,255,0.08)`
- 角丸: 12px
- ドラッグオーバー時: ボーダーがパレット primary 色に変化
- テキスト: `#8a8f98` 「画像をドロップ、またはクリックして選択」

### Vim プレビューパネル
- 背景: パレットの `bg_base` 色（動的）
- ボーダー: `1px solid rgba(255,255,255,0.08)`
- 角丸: 8px
- シャドウ: `rgba(0,0,0,0.3) 0px 8px 8px`（Spotify の重いシャドウ）
- 内部: Berkeley Mono でシンタックスハイライト表示

### パレットスウォッチ
- 各色の丸: 角丸 50%（Spotify のサークル）、サイズ 40px
- 色名ラベル: 12px Inter weight 510, `#8a8f98`
- HEX値: 12px Berkeley Mono, `#d0d6e0`
- スウォッチ間隔: 8px

### カード
- 背景: `rgba(255,255,255,0.02)`（Linear — 常に半透明）
- ボーダー: `1px solid rgba(255,255,255,0.08)`
- 角丸: 8px
- シャドウ: なし（Linear — ボーダーで深度を表現）

### ナビゲーション
- 背景: `#121212`（Spotify）
- リンク: 14px Inter weight 510, `#d0d6e0`
- アクティブ: `#f7f8f8`
- CTA: Linear のブランドインディゴボタン

## 5. レイアウト原則

### LP ヒーローセクション構成

```
┌─────────────────────────────────────────────────────────┐
│  ナビバー: ロゴ | About | GitHub                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│           推し色でエディタを染めろ！                      │
│    キャラクター画像から Neovim カラースキームを生成        │
│                                                         │
│  ┌──────────────────┐    ┌────────────────────────┐     │
│  │                  │    │  ┌──────────────────┐  │     │
│  │  画像ドロップ     │ →  │  │ Vim プレビュー    │  │     │
│  │  ゾーン          │    │  │ (リアルタイム変化) │  │     │
│  │                  │    │  └──────────────────┘  │     │
│  └──────────────────┘    │  ● ● ● ● ● パレット   │     │
│                          └────────────────────────┘     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### スペーシング
- ベースユニット: 8px
- セクション間: 80px 以上
- カード内パディング: 24px
- コンテナ最大幅: 1200px

### ボーダーラディウス
- ミニマル (2px): バッジ、ツールバーボタン
- スタンダード (6px): ボタン、入力
- カード (8px): カード、パネル
- ラージ (12px): ドロップゾーン、フィーチャーパネル
- ピル (9999px): ナビピル、タグ
- サークル (50%): パレットスウォッチ

## 6. 深度とエレベーション

| レベル | 処理 | 用途 |
|--------|------|------|
| フラット (L0) | シャドウなし、`#121212` | ページ背景 |
| サーフェス (L1) | `rgba(255,255,255,0.02)` bg + ボーダー | カード、入力 |
| エレベーテッド (L2) | `rgba(0,0,0,0.3) 0px 8px 8px` | Vim プレビュー、ドロップダウン |
| ダイアログ (L3) | `rgba(0,0,0,0.5) 0px 8px 24px` | モーダル |
| インセット (L-1) | `rgba(0,0,0,0.2) 0px 0px 12px inset` | 凹んだパネル |

## 7. やるべきこと・やってはいけないこと

### やるべき
- UI を achromatic に保つ — 色はすべてユーザーのパレットから
- `#121212` を基調背景に（Spotify の劇場的暗さ）
- Inter Variable に `"cv01", "ss03"` を必ず適用（Linear の精密さ）
- ディスプレイサイズで負のレタースペーシング
- パレットスウォッチは暗い背景の中で「光る」ように見せる
- Vim プレビューにはパレットの `bg_base` を動的に適用
- 日本語テキストは Noto Sans JP でフォールバック

### やってはいけない
- UI コンポーネントに固定の彩色を入れる（パレット色と競合する）
- 純白 `#ffffff` をテキストに使う（`#f7f8f8` で目の負担を軽減）
- ボーダーにソリッドな暗色を使う（半透明ホワイトが正解）
- ウェイト 700 を使う（最大 590、シグネチャは 510）
- ライトモードを作る（このプロダクトはダーク専用）

## 8. レスポンシブ挙動

| ブレークポイント | 幅 | 変化 |
|-----------------|------|------|
| モバイル | <640px | 単一カラム、ヒーロー48px→32px、ドロップゾーンとプレビュー縦積み |
| タブレット | 640–1024px | 2カラム開始、ドロップゾーンとプレビュー横並び |
| デスクトップ | >1024px | フルレイアウト、コンテナ最大幅 1200px |

## 9. エージェントプロンプトガイド

### クイックカラーリファレンス
```
背景:           #121212 (劇場の闇)
サーフェス:     rgba(255,255,255,0.02)
テキスト主:     #f7f8f8
テキスト副:     #d0d6e0
テキスト三:     #8a8f98
CTA:            動的パレット色 / フォールバック #5e6ad2
ボーダー:       rgba(255,255,255,0.08)
成功:           #1ed760
```

### oshicolor 固有のコンポーネント
- 「画像ドロップゾーンを作成: #121212 背景上に、rgba(255,255,255,0.02) の背景、2px dashed rgba(255,255,255,0.08) のボーダー、12px 角丸。中央に #8a8f98 のテキスト『画像をドロップ、またはクリックして選択』。ドラッグオーバー時にボーダーが動的アクセント色に変化」
- 「Vim プレビューパネルを作成: 動的 bg_base 色の背景、1px solid rgba(255,255,255,0.08) ボーダー、8px 角丸。Berkeley Mono 14px でシンタックスハイライト。シャドウ rgba(0,0,0,0.3) 0px 8px 8px」
- 「パレットスウォッチ行を作成: 5-8個の 40px サークル（50% 角丸）を 8px 間隔で横並び。各スウォッチの下に 12px Berkeley Mono で HEX 値を #d0d6e0 で表示」
- 「ヒーローセクションを作成: #121212 背景。48px Inter Variable ウェイト510、行間1.00、字間-1.056px、#f7f8f8 で 推し色でエディタを染めろ！ と表示。サブテキスト 18px ウェイト400、#8a8f98。ドロップゾーンと Vim プレビューを横並びに配置」

---

## 参照元デザインシステム（原文）

以下は、このデザインシステムの構築に使用した参照元の原文です。stitch がデザインの詳細を判断する際に参照してください。

### Spotify DESIGN.md

<details>
<summary>クリックで展開</summary>

#### Visual Theme & Atmosphere

Spotify's web interface is a dark, immersive music player that wraps listeners in a near-black cocoon (`#121212`, `#181818`, `#1f1f1f`) where album art and content become the primary source of color. The design philosophy is "content-first darkness" — the UI recedes into shadow so that music, podcasts, and playlists can glow. Every surface is a shade of charcoal, creating a theater-like environment where the only true color comes from the iconic Spotify Green (`#1ed760`) and the album artwork itself.

The typography uses SpotifyMixUI and SpotifyMixUITitle — proprietary fonts from the CircularSp family with an extensive fallback stack including CJK fonts, reflecting Spotify's global reach. The type system is compact and functional: 700 (bold) for emphasis, 600 (semibold) for secondary emphasis, and 400 (regular) for body.

What distinguishes Spotify is its pill-and-circle geometry. Primary buttons use 500px–9999px radius (full pill), circular play buttons use 50% radius. Combined with heavy shadows (`rgba(0,0,0,0.5) 0px 8px 24px`) on elevated elements, the result is an interface that feels like a premium audio device.

**Key Characteristics:**
- Near-black immersive dark theme (`#121212`–`#1f1f1f`)
- Spotify Green (`#1ed760`) as singular brand accent — never decorative, always functional
- Pill buttons (500px–9999px) and circular controls (50%)
- Uppercase button labels with wide letter-spacing (1.4px–2px)
- Heavy shadows (`rgba(0,0,0,0.5) 0px 8px 24px`) for elevated elements
- Album art as the primary color source — the UI is achromatic by design

#### Color Palette

- **Near Black** (`#121212`): Deepest background surface
- **Dark Surface** (`#181818`): Cards, containers
- **Mid Dark** (`#1f1f1f`): Button backgrounds
- **White** (`#ffffff`): Primary text
- **Silver** (`#b3b3b3`): Secondary text
- **Spotify Green** (`#1ed760`): Brand accent
- **Border Gray** (`#4d4d4d`): Button borders

#### Shadow System

- Heavy (`rgba(0,0,0,0.5) 0px 8px 24px`): Dialogs, menus
- Medium (`rgba(0,0,0,0.3) 0px 8px 8px`): Cards, dropdowns
- Inset Border (`rgb(18,18,18) 0px 1px 0px, rgb(124,124,124) 0px 0px 0px 1px inset`): Inputs

#### Do's
- Use near-black backgrounds (`#121212`–`#1f1f1f`)
- Apply Spotify Green only for play controls, active states, and primary CTAs
- Use pill shape (500px–9999px) for all buttons
- Use heavy shadows (0.3–0.5 opacity) for elevated elements on dark backgrounds
- Let album art provide color — the UI itself is achromatic

#### Don'ts
- Don't use Spotify Green decoratively
- Don't use light backgrounds for primary surfaces
- Don't skip the pill/circle geometry on buttons
- Don't use thin/subtle shadows on dark backgrounds
- Don't add additional brand colors

</details>

### Linear DESIGN.md

<details>
<summary>クリックで展開</summary>

#### Visual Theme & Atmosphere

Linear's website is a masterclass in dark-mode-first product design — a near-black canvas (`#08090a`) where content emerges from darkness like starlight. The overall impression is one of extreme precision engineering: every element exists in a carefully calibrated hierarchy of luminance, from barely-visible borders (`rgba(255,255,255,0.05)`) to soft, luminous text (`#f7f8f8`).

The typography system is built entirely on Inter Variable with OpenType features `"cv01"` and `"ss03"` enabled globally. Inter is used at a remarkable range of weights — from 300 through 510 (Linear's signature weight) to 590. At display sizes, Inter uses aggressive negative letter-spacing (-1.584px to -1.056px).

The color system is almost entirely achromatic, punctuated by a single brand accent: Linear's signature indigo-violet (`#5e6ad2`). The border system uses ultra-thin, semi-transparent white borders (`rgba(255,255,255,0.05)` to `rgba(255,255,255,0.08)`).

**Key Characteristics:**
- Dark-mode-native: `#08090a` marketing, `#0f1011` panels, `#191a1b` elevated
- Inter Variable with `"cv01", "ss03"` globally
- Signature weight 510
- Aggressive negative letter-spacing at display sizes
- Brand indigo-violet: `#5e6ad2` / `#7170ff`
- Semi-transparent white borders: `rgba(255,255,255,0.05)` to `0.08`
- Button backgrounds at near-zero opacity: `rgba(255,255,255,0.02)` to `0.05`

#### Depth & Elevation

On dark surfaces, traditional shadows are nearly invisible. Linear solves this by using semi-transparent white borders as the primary depth indicator. Elevation is communicated through background luminance steps — each level slightly increases the white opacity (`0.02` → `0.04` → `0.05`).

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat (L0) | No shadow, `#010102` bg | Page background |
| Surface (L2) | `rgba(255,255,255,0.05)` bg + border | Cards, inputs |
| Ring (L3) | `rgba(0,0,0,0.2) 0px 0px 0px 1px` | Border-as-shadow |
| Elevated (L4) | `rgba(0,0,0,0.4) 0px 2px 4px` | Floating elements |

#### Do's
- Use Inter Variable with `"cv01", "ss03"` on ALL text
- Use weight 510 as default emphasis weight
- Apply aggressive negative letter-spacing at display sizes
- Build on near-black backgrounds
- Use semi-transparent white borders instead of solid dark borders
- Use `#f7f8f8` for primary text — not pure `#ffffff`

#### Don'ts
- Don't use pure white as primary text
- Don't use solid colored backgrounds for buttons — transparency is the system
- Don't apply the brand indigo decoratively
- Don't use positive letter-spacing on display text
- Don't use weight 700 (bold) — maximum is 590
- Don't skip the OpenType features

</details>
