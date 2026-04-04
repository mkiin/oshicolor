# oshicolor デザインシステム — パターン B: Sentry × Spotify

> **コンセプト: 「暖かい紫の闇 + frosted glass + コンテンツが色を提供」**
> 冷たい純黒ではなく、Sentry の warm purple ダーク (`#1f1633`) を基調に、
> Spotify の「UI が消えてコンテンツが色を提供する」思想を組み合わせる。
> 「推し」のワクワク感と開発者ツールの irreverent さが両立するデザイン。

## プロダクト概要

- **プロダクト名**: oshicolor（おしからー）
- **概要**: キャラクターイラストからカラーパレットを抽出し、Neovim カラースキームを生成する Web アプリケーション
- **ターゲット**: 日本の Vim/Neovim ユーザー、推し文化を持つ開発者
- **言語**: 日本語（日本向けプロダクト）
- **キャッチコピー**: 推し色でエディタを染めろ！（必ず1行で表示。改行禁止）
- **技術スタック**: TanStack Start (React) / Cloudflare Workers / Tailwind CSS

## 参照デザインシステム

- **Sentry**: warm purple ダーク背景、frosted glass、inset shadow の触覚的ボタン、irreverent なブランドトーン
- **Spotify**: achromatic UI でコンテンツが色を提供する思想、ピルジオメトリ、重いシャドウ

---

## 1. ビジュアルテーマと雰囲気

oshicolor の世界は「暖かい闇」である。Sentry が深夜のデバッグセッションを `#1f1633` の紫がかった暗さで包むように、oshicolor は「推し」への愛着を暖かい紫の闇で表現する。純黒 (`#000000`) は使わない。冷たさは「推し」と相容れない。

この暖かい闇の中で、Spotify の「content-first darkness」が機能する。UI のクロムは紫グレーの無彩色トーンで統一し、色彩はすべてユーザーがアップロードしたキャラクター画像と生成されたカラーパレットに委ねる。パレットスウォッチは frosted glass (`blur(18px) saturate(180%)`) の上に配置すると、色が発光して見える。

ボタンは Sentry の inset shadow スタイル — 押し込める触覚的な質感 — を採用。ライムグリーン (`#c2ef4e`) を CTA アクセントに使い、パレット色と干渉しない独立したシグナルカラーとする。

タイポグラフィは Rubik（Sentry のワークホースフォント）をベースに、ヒーローでは Sentry の irreverent なトーンを反映したディスプレイフォントを使用。ボタン・ラベルには `text-transform: uppercase` + `letter-spacing: 0.2px` のシステマティックなパターンを適用。

**核心原則: 暖かい紫の闇が「推し」の温度感を伝え、その中でパレット色が光る。**

## 2. カラーパレットと役割

### 背景サーフェス（Sentry の warm purple 階層）
- **メイン背景**: `#1f1633`（Sentry のディープパープル — 暖かい闇）
- **ディーパー背景**: `#150f23`（Sentry — より深いセクション、フッター）
- **エレベーテッド**: `#362d59`（Sentry — ボーダー、仕切り）
- **カードサーフェス**: `rgba(255,255,255,0.18)` + `backdrop-filter: blur(18px) saturate(180%)`（frosted glass）

### テキスト
- **プライマリ**: `#ffffff`（Sentry — ダーク背景上の白）
- **セカンダリ**: `#e5e7eb`（Sentry — ライトグレー）
- **コード**: `#dcdcaa`（Sentry — シンタックスハイライトイエロー）

### アクセント（Sentry の多彩なアクセント系）
- **CTA ライムグリーン**: `#c2ef4e`（Sentry — 高視認性アクセント。パレット色と干渉しない）
- **インタラクティブパープル**: `#6a5fc1`（Sentry — リンク、ホバー）
- **ボタンパープル**: `#79628c`（Sentry — ミュートパープルのボタン背景）
- **ディープバイオレット**: `#422082`（Sentry — アクティブ状態）
- **コーラル**: `#ffb287`（Sentry — フォーカス状態の暖かいアクセント）
- **ピンク**: `#fa7faa`（Sentry — フォーカスアウトライン）

### ボーダー
- **パープルボーダー**: `#362d59`（Sentry — 紫がかったボーダー）
- **ボタンボーダー**: `#584674`（Sentry — ボタン専用）

### シャドウ（Sentry のタクタイルシステム + Spotify の重さ）
- **インセットボタン**: `rgba(0,0,0,0.1) 0px 1px 3px 0px inset`（Sentry — 押し込み感）
- **ボタンホバー**: `rgba(0,0,0,0.18) 0px 0.5rem 1.5rem`（Sentry — エレベーション）
- **カード**: `rgba(0,0,0,0.1) 0px 10px 15px -3px`（Sentry — 標準カード）
- **アンビエントグロー**: `rgba(22,15,36,0.9) 0px 4px 4px 9px`（Sentry — パープルグロー）
- **ダイアログ**: `rgba(0,0,0,0.5) 0px 8px 24px`（Spotify — 劇的なフローティング）

## 3. タイポグラフィルール

### フォントファミリ
- **UI/本文**: `Rubik`, フォールバック: `"Noto Sans JP", "Hiragino Kaku Gothic ProN", -apple-system, system-ui, Segoe UI, Helvetica, Arial`
- **モノスペース**: `Monaco`, フォールバック: `"JetBrains Mono", Menlo, Ubuntu Mono`

### 階層

| 役割 | サイズ | ウェイト | 行間 | 字間 | 備考 |
|------|--------|----------|------|------|------|
| ヒーロー | 56px (3.5rem) | 700 | 1.20 | normal | 推し色でエディタを染めろ！ / 1行表示、改行しない (white-space: nowrap) |
| ヒーローサブ | 30px (1.88rem) | 400 | 1.20 | normal | サブヘッドライン |
| セクション見出し | 27px (1.69rem) | 500 | 1.25 | normal | 機能セクション |
| カード見出し | 24px (1.5rem) | 500 | 1.25 | normal | カードヘッダー |
| フィーチャー | 20px (1.25rem) | 600 | 1.25 | normal | 機能名 |
| 本文 | 16px (1rem) | 400 | 1.50 | normal | 説明文 |
| 本文強調 | 16px (1rem) | 500-600 | 1.50 | normal | ナビ、強調 |
| ボタン | 14px (0.88rem) | 500-700 | 1.14 | 0.2px | `uppercase` |
| キャプション | 14px (0.88rem) | 500-700 | 1.43 | 0.2px | `uppercase` 多い |
| マイクロ | 10px (0.63rem) | 600 | 1.80 | 0.25px | `uppercase` |
| コード | 16px (1rem) | 400 | 1.50 | normal | Monaco |

### 原則
- **uppercase がシステム**: ボタン、キャプション、ラベル、マイクロテキストすべてに `text-transform: uppercase` + `letter-spacing: 0.2px`
- **4段階ウェイト**: 400（本文）、500（強調/ナビ）、600（タイトル）、700（CTA）
- **タイト見出し、リラックス本文**: 見出し 1.20-1.25、本文 1.50

## 4. コンポーネントスタイリング

### ボタン

**プライマリ（ライムグリーン CTA）**
- 背景: `#c2ef4e`
- テキスト: `#1f1633`（ディープパープル）
- パディング: 12px 16px
- 角丸: 13px（Sentry スタイル）
- テキスト: 14px Rubik ウェイト700, uppercase, letter-spacing 0.2px
- シャドウ: `rgba(0,0,0,0.1) 0px 1px 3px 0px inset`（Sentry のタクタイル感）
- ホバー: シャドウが `rgba(0,0,0,0.18) 0px 0.5rem 1.5rem` に変化

**ミュートパープル（セカンダリ）**
- 背景: `#79628c`
- テキスト: `#ffffff`, uppercase, 14px, ウェイト500-700, letter-spacing 0.2px
- ボーダー: `1px solid #584674`
- 角丸: 13px
- シャドウ: `rgba(0,0,0,0.1) 0px 1px 3px 0px inset`

**frosted glass（ターシャリ）**
- 背景: `rgba(255,255,255,0.18)`
- テキスト: `#ffffff`
- パディング: 8px
- 角丸: 12px
- シャドウ: `rgba(0,0,0,0.08) 0px 2px 8px`
- ホバー背景: `rgba(54,22,107,0.14)`
- バックドロップフィルター: `blur(18px) saturate(180%)`

**ホワイトソリッド（高視認 CTA）**
- 背景: `#ffffff`
- テキスト: `#1f1633`
- パディング: 12px 16px
- 角丸: 8px
- ホバー: 背景が `#6a5fc1` に、テキストが白に
- フォーカス: 背景 `#ffb287`（コーラル）

### 画像ドロップゾーン
- 背景: `rgba(255,255,255,0.18)` + `backdrop-filter: blur(18px) saturate(180%)`
- ボーダー: `2px dashed #362d59`
- 角丸: 12px
- ドラッグオーバー時: ボーダーが `#c2ef4e`（ライムグリーン）に、アンビエントグローが発生
- テキスト: `#e5e7eb` 「画像をドロップ、またはクリックして選択」

### Vim プレビューパネル
- 背景: パレットの `bg_base` 色（動的）
- ボーダー: `1px solid #362d59`
- 角丸: 10px
- シャドウ: `rgba(22,15,36,0.9) 0px 4px 4px 9px`（Sentry のパープルアンビエントグロー）
- 内部: Monaco 16px でシンタックスハイライト
- **パープルグローが Vim プレビューを「光らせる」** — これがパターンBの最大の特徴

### パレットスウォッチ
- frosted glass パネル上に配置
- 各色の丸: 角丸 50%、サイズ 44px
- 色名ラベル: 12px Rubik ウェイト600, uppercase, `#e5e7eb`
- HEX値: 12px Monaco, `#ffffff`
- スウォッチ間隔: 8px
- **frosted glass の上でパレット色が発光して見える**

### カード
- 背景: frosted glass または `#150f23`
- ボーダー: `1px solid #362d59`
- 角丸: 8-12px
- シャドウ: `rgba(0,0,0,0.1) 0px 10px 15px -3px`
- バックドロップフィルター: `blur(18px) saturate(180%)`

### ナビゲーション
- 背景: `#1f1633` + 半透明バックドロップ
- リンク: Rubik 15px ウェイト500, `#ffffff`
- ホバー: `#6a5fc1`（Sentry パープル）
- CTA: ライムグリーンピルボタン
- uppercase カテゴリラベル + letter-spacing 0.2px

## 5. レイアウト原則

### LP ヒーローセクション構成

```
┌─────────────────────────────────────────────────────────┐
│  [#1f1633 ナビバー]  ロゴ | About | GitHub              │
├─────────────────────────────────────────────────────────┤
│  [#150f23 ヒーロー — パープルアンビエントグロー]         │
│                                                         │
│           推し���でエディタを染め���！                      │
│    キャラクター画像から Neovim カラースキームを生成        │
│                                                         │
│  ┌──────────────────┐    ┌────────────────────────┐     │
│  │ [frosted glass]  │    │ [パープルグロー]        │     │
│  │  画像ドロップ     │ →  │  Vim プレビュー         │     │
│  │  ゾーン          │    │  (リアルタイム変化)     │     │
│  │                  │    │  ● ● ● ● ● パレット    │     │
│  └──────────────────┘    └────────────────────────┘     │
│                                                         │
│         [#c2ef4e 始める]  [frosted glass もっと見る]     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### スペーシング
- ベースユニット: 8px
- セクション間: 64-80px（ダーク背景がビジュアルの休息を提供）
- カード内パディング: 24px
- コンテナ最大幅: 1152px（Sentry と同じ）

### ボーダーラディウス
- ミニマル (6px): 入力、小さなインタラクティブ要素
- スタンダード (8px): ボタン、カード
- コンフォータブル (10-12px): 大きなコンテナ、frosted glass パネル
- ラウンデッド (13px): プライマリボタン
- ピル (18px): バッジ、画像コンテナ

## 6. 深度とエレベーション

| レベル | 処理 | 用途 |
|--------|------|------|
| サンケン (L-1) | `rgba(0,0,0,0.1) 0px 1px 3px inset` | ボタン（触覚的押し込み感） |
| フラット (L0) | シャドウなし | デフォルトサーフェス |
| サーフェス (L1) | `rgba(0,0,0,0.08) 0px 2px 8px` | frosted glass ボタン |
| エレベーテッド (L2) | `rgba(0,0,0,0.1) 0px 10px 15px -3px` | カード |
| プロミネント (L3) | `rgba(0,0,0,0.18) 0px 0.5rem 1.5rem` | ホバー |
| アンビエント (L4) | `rgba(22,15,36,0.9) 0px 4px 4px 9px` | パープルグロー |

**シャドウ哲学**: Sentry の独自コンビネーション — inset shadow（ボタンがサーフェスに「押し込まれる」）+ ambient glow（コンテンツが暗い背景から「発光する」）。パープルアンビエントシャドウ (`rgba(22,15,36,0.9)`) がシグネチャ。

## 7. やるべきこと・やってはいけないこと

### やるべき
- `#1f1633`, `#150f23` のディープパープル背景を使う — 純黒は使わない
- ボタンに inset shadow を適用して触覚的な押し込み感を出す
- `text-transform: uppercase` + `letter-spacing: 0.2px` をボタンとラベルに
- ライムグリーン (`#c2ef4e`) は控えめに — セクションごとに最大1箇所
- frosted glass (`blur(18px) saturate(180%)`) をレイヤードサーフェスに
- シャドウは紫がかったトーンで — ニュートラルグレーではなく
- パレットスウォッチを frosted glass の上に配置して発光させる
- Vim プレビューにパープルアンビエントグローを適用
- 日本語フォールバックに Noto Sans JP を使用

### やってはいけない
- 純黒 (`#000000`) を背景に使う — 常に warm purple-black
- ボタンに通常のグレー (`#666`, `#999`) ボーダーを使う — 紫がかったグレー (`#362d59`, `#584674`)
- uppercase 処理をボタンから外す — システム全体のパターン
- ライムグリーンとコーラル/ピンクアクセントを同じコンポーネントに混ぜる
- ボタンにフラット（非 inset）シャドウを使う — 触覚的品質がシグネチャ
- 角丸 0px を使う — 最小 6px

## 8. レスポンシブ挙動

| ブレークポイント | 幅 | 変化 |
|-----------------|------|------|
| モバイル | <576px | 単一カラム、ハンバーガーナビ、CTA 縦積み |
| タブレット | 576-768px | 2カラム開始 |
| デスクトップ小 | 768-992px | フルナビ、サイドバイサイド |
| デスクトップ | 992-1152px | フルレイアウト |
| ラージ | >1152px | コンテナ最大幅維持 |

### コラプス戦略
- ヒーロー: 56px → 40px → モバイルスケール
- ドロップゾーン + プレビュー: 横並び → 縦積み
- ボタン: インライン → フル幅縦積み
- コンテナパディング: 4rem → 2rem

## 9. エージェントプロンプトガイド

### クイックカラーリファレンス
```
背景:           #1f1633 (warm purple dark)
ディーパー:     #150f23 (deeper purple)
テキスト主:     #ffffff
テキスト副:     #e5e7eb
インタラクティブ: #6a5fc1 (リンク/ホバー)
ボタン:         #79628c (ミュートパープル)
CTA:            #c2ef4e (ライムグリーン)
フォーカス:     #ffb287 (コーラル)
ボーダー:       #362d59 (パープルボーダー)
frosted glass:  rgba(255,255,255,0.18) + blur(18px) saturate(180%)
```

### oshicolor 固有のコンポーネント
- 「ヒーローセクションを作成: #150f23 背景にパープルアンビエントグロー (rgba(22,15,36,0.9) 0px 4px 4px 9px)。56px Rubik ウェイト700、行間1.20、白テキストで推し色でエディタを染めろ！。サブテキスト 16px ウェイト400、#e5e7eb。ライムグリーン (#c2ef4e) ピルCTA と frosted glass セカンダリボタン」
- 「画像ドロップゾーンを作成: frosted glass (rgba(255,255,255,0.18) + backdrop-filter blur(18px) saturate(180%))、2px dashed #362d59 ボーダー、12px 角丸。ドラッグオーバーでボーダーが #c2ef4e に変化しグローが発生」
- 「Vim プレビューパネルを作成: 動的 bg_base 色の背景、1px solid #362d59 ボーダー、10px 角丸。パープルアンビエントグロー (rgba(22,15,36,0.9) 0px 4px 4px 9px)。Monaco 16px でシンタックスハイライト」
- 「frosted glass パレットスウォッチパネルを作成: rgba(255,255,255,0.18) 背景 + blur(18px) saturate(180%)。5-8個の 44px サークル。各スウォッチ下に 12px Monaco で HEX値。frosted glass 上でパレット色が発光して見える効果」
- 「ミュートパープルボタンを作成: 背景 #79628c、ボーダー 1px solid #584674、inset shadow rgba(0,0,0,0.1) 0px 1px 3px、白 uppercase テキスト 14px Rubik ウェイト700、letter-spacing 0.2px、角丸 13px。ホバーでシャドウが rgba(0,0,0,0.18) 0px 0.5rem 1.5rem に」

### イテレーションガイド
1. `#1f1633` のパープルダーク背景から始める — 色パレットは暖かいダーク用に構築
2. ボタンには inset shadow、ヒーローにはパープルアンビエントグロー
3. uppercase + letter-spacing はラベル・ボタン・キャプションのシステムパターン
4. ライムグリーン (#c2ef4e) は「ポップ」カラー — セクションごとに最大1回
5. frosted glass はオーバーレイパネルに、ソリッドパープルはプライマリサーフェスに
6. パレットスウォッチは frosted glass の上に置いて発光効果を出す
7. Vim プレビューにはパープルアンビエントグローを必ず適用

---

## 参照元デザインシステム（原文）

以下は、このデザインシステムの構築に使用した参照元の原文です。stitch がデザインの詳細を判断する際に参照してください。

### Sentry DESIGN.md

<details>
<summary>クリックで展開</summary>

#### Visual Theme & Atmosphere

Sentry's website is a dark-mode-first developer tool interface that speaks the language of code editors and terminal windows. The entire aesthetic is rooted in deep purple-black backgrounds (`#1f1633`, `#150f23`) that evoke the late-night debugging sessions Sentry was built for. Against this inky canvas, a carefully curated set of purples, pinks, and a distinctive lime-green accent (`#c2ef4e`) create a visual system that feels simultaneously technical and vibrant.

"Dammit Sans" appears at hero scale (88px, weight 700) as a display font with personality and attitude that matches Sentry's irreverent brand voice, while Rubik serves as the workhorse UI font. Monaco provides the monospace layer for code snippets.

What makes Sentry distinctive is its embrace of the "dark IDE" aesthetic without feeling cold or sterile. Warm purple tones replace the typical cool grays. The button system uses a signature muted purple (`#79628c`) with inset shadows that creates a tactile, almost physical quality — buttons feel like they could be pressed into the surface.

**Key Characteristics:**
- Dark purple-black backgrounds (`#1f1633`, `#150f23`) — never pure black
- Warm purple accent spectrum: `#362d59`, `#79628c`, `#6a5fc1`, `#422082`
- Lime-green accent (`#c2ef4e`) for high-visibility CTAs
- Pink/coral accents (`#ffb287`, `#fa7faa`) for focus states
- Rubik as primary UI font with uppercase letter-spaced labels
- Inset shadows on buttons creating tactile depth
- Frosted glass effects with `blur(18px) saturate(180%)`

#### Color Palette

- **Deep Purple** (`#1f1633`): Primary background
- **Darker Purple** (`#150f23`): Deeper sections, footer
- **Border Purple** (`#362d59`): Borders, dividers
- **Sentry Purple** (`#6a5fc1`): Interactive color
- **Muted Purple** (`#79628c`): Button backgrounds
- **Lime Green** (`#c2ef4e`): High-visibility accent
- **Coral** (`#ffb287`): Focus state backgrounds
- **Pink** (`#fa7faa`): Focus outlines

#### Shadow System

- Ambient Glow: `rgba(22,15,36,0.9) 0px 4px 4px 9px` — purple ambient
- Button Hover: `rgba(0,0,0,0.18) 0px 0.5rem 1.5rem`
- Card: `rgba(0,0,0,0.1) 0px 10px 15px -3px`
- Inset Button: `rgba(0,0,0,0.1) 0px 1px 3px 0px inset` — tactile pressed

Sentry uses inset shadows (buttons pressed INTO surface) and ambient glows (content radiates from dark background). The deep purple ambient shadow creates a bioluminescent quality.

#### Do's
- Use deep purple backgrounds — never pure black
- Apply inset shadows on primary buttons
- Use `text-transform: uppercase` with `letter-spacing: 0.2px` on buttons and labels
- Use lime-green sparingly for maximum impact
- Employ frosted glass effects for layered surfaces
- Maintain warm purple shadow tones

#### Don'ts
- Don't use pure black for backgrounds
- Don't use standard gray for borders — use purple-tinted grays
- Don't drop uppercase treatment on buttons
- Don't mix lime-green with coral/pink in the same component
- Don't use flat (non-inset) shadows on primary buttons
- Don't use sharp corners (0px radius)

</details>

### Spotify DESIGN.md

<details>
<summary>クリックで展開</summary>

#### Visual Theme & Atmosphere

Spotify's web interface is a dark, immersive music player that wraps listeners in a near-black cocoon (`#121212`, `#181818`, `#1f1f1f`) where album art and content become the primary source of color. The design philosophy is "content-first darkness" — the UI recedes into shadow so that music, podcasts, and playlists can glow. Every surface is a shade of charcoal, creating a theater-like environment where the only true color comes from the iconic Spotify Green (`#1ed760`) and the album artwork itself.

What distinguishes Spotify is its pill-and-circle geometry. Primary buttons use 500px–9999px radius (full pill), circular play buttons use 50% radius. Combined with heavy shadows (`rgba(0,0,0,0.5) 0px 8px 24px`) on elevated elements, the result is an interface that feels like a premium audio device.

**Key Characteristics:**
- Near-black immersive dark theme (`#121212`–`#1f1f1f`)
- Spotify Green (`#1ed760`) as singular brand accent — never decorative, always functional
- Pill buttons (500px–9999px) and circular controls (50%)
- Heavy shadows for elevated elements
- Album art as the primary color source — the UI is achromatic by design

#### Core Principle for oshicolor

Spotify の最も重要な原則: **UI 自体は achromatic（無彩色）に保ち、色彩はコンテンツ（アルバムアート = oshicolor ではキャラクター画像とパレット）に委ねる。** この「色の委譲」がパターンBの核心。Sentry の warm purple は UI クロムの色だが、生成されたパレット色よりも控えめに保つ。

</details>
