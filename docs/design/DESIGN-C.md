# oshicolor デザインシステム — パターン C: Sanity × Resend

> **コンセプト: 「純黒の void + 結晶ボーダー + ネオンカラー」**
> Sanity の `#0b0b0b` 純黒キャンバスに、Resend の icy blue-tinted frost ボーダーを組み合わせる。
> achromatic な純黒の闇の中で、パレット色がネオンサインのように浮かび上がる、最もビジュアルインパクトの強いパターン。

## プロダクト概要

- **プロダクト名**: oshicolor（おしからー）
- **概要**: キャラクターイラストからカラーパレットを抽出し、Neovim カラースキームを生成する Web アプリケーション
- **ターゲット**: 日本の Vim/Neovim ユーザー、推し文化を持つ開発者
- **言語**: 日本語（日本向けプロダクト）
- **キャッチコピー**: 推し色でエディタを染めろ！（必ず1行で表示。改行禁止）
- **技術スタック**: TanStack Start (React) / Cloudflare Workers / Tailwind CSS

## 参照デザインシステム

- **Sanity**: 純黒キャンバス、achromatic グレースケール、精密な負のレタースペーシング、colorimetric な深度表現
- **Resend**: frost ボーダー（icy blue-tinted）、3層タイポグラフィ、多色アクセント、純黒 void

---

## 1. ビジュアルテーマと雰囲気

oshicolor の世界は「純黒の void」である。Sanity が `#0b0b0b` のキャンバスを「ダークモードのトグル」ではなく「ツールの自然な状態」として扱うように、oshicolor は Neovim ユーザーが日常的に暮らす暗い画面そのものを背景にする。

この純黒の void の中で、Resend の frost ボーダー (`rgba(214,235,253,0.19)`) が結晶のような構造線を引く。icy blue-tinted なボーダーは冷たく、精密で、ガラスのパネルが闇の中に浮かぶような印象を与える。従来のグレーボーダーとは根本的に異なる — 闇の中で微かに青く光る。

パレット色はこの純黒と結晶ボーダーの中で「ネオンサイン」のように浮かび上がる。oshicolor が生成するパレットの各色は、frost ボーダーの内側で鮮烈に映え、暗い世界の中の唯一の彩色になる。

タイポグラフィは Sanity のスタイルに倣い、Inter（waldenburgNormal の代替）で極端な負のレタースペーシングを適用。48px 以上のディスプレイサイズで -1.68px 〜 -4.48px の圧縮されたヘッドラインを作る。技術ラベルには IBM Plex Mono の uppercase を使用し、ターミナル的な信頼感を出す。

CTA には Sanity のコーラルレッド (`#f36458`) を採用。暖かい赤は純黒の中で目を引き、パレット色（多色）とは色相が異なるため干渉しにくい。

**核心原則: 純黒の void、結晶のボーダー、ネオンのパレット色。3層のコントラスト。**

## 2. カラーパレットと役割

### 背景サーフェス（Sanity の colorimetric 深度）
- **メイン背景**: `#0b0b0b`（Sanity — 純黒に近いキャンバス）
- **エレベーテッド**: `#212121`（Sanity — カード、コンテナ）
- **プロミネント**: `#353535`（Sanity — ボーダー、強調コンテナ）

### テキスト（Sanity の achromatic グレースケール）
- **プライマリ**: `#ffffff`（純白 — 最大コントラスト）
- **セカンダリ**: `#b9b9b9`（Sanity — シルバー）
- **ターシャリ**: `#797979`（Sanity — ミディアムグレー）
- **コード**: IBM Plex Mono, `#b9b9b9`

### ボーダー（Resend の frost システム）
- **frost プライマリ**: `rgba(214,235,253,0.19)`（Resend — icy blue-tinted、シグネチャ）
- **frost オルト**: `rgba(217,237,254,0.145)`（Resend — やや薄い）
- **リングシャドウ**: `rgba(176,199,217,0.145) 0px 0px 0px 1px`（Resend — blue-tinted shadow-as-border）
- **サトルボーダー**: `#212121`（Sanity — 内部仕切り）

### アクセント
- **CTA レッド**: `#f36458`（Sanity — コーラルレッド CTA。暖かく、パレット色と干渉しない）
- **インタラクティブブルー**: `#0052ef`（Sanity — ユニバーサルホバー/アクティブ）
- **ネオングリーン**: `#19d600`（Sanity — 成功状態、sRGB フォールバック）

### 多色アクセント（Resend のスケール — パレットプレビュー用）
- **オレンジ**: `#ff801f`（Resend orange-10）
- **グリーン**: `#11ff99` at 18%（Resend green-4）
- **ブルー**: `#3b9eff`（Resend blue-10）
- **イエロー**: `#ffc53d`（Resend yellow-9）
- **レッド**: `#ff2047` at 34%（Resend red-5）
- ※ シンタックスハイライトのトークンカラーとして使用可能

### シャドウ
- このパターンでは **シャドウをほぼ使わない**
- 深度は Sanity の colorimetric 方式（サーフェス色の段階）で表現
- 唯一のシャドウ: frost リングシャドウ `rgba(176,199,217,0.145) 0px 0px 0px 1px`
- フォーカスリング: `0 0 0 2px #0052ef`（Sanity のブルーフォーカス）

## 3. タイポグラフィルール

### フォントファミリ
- **ディスプレイ/見出し/本文**: `Inter Variable`, フォールバック: `"Noto Sans JP", "Hiragino Kaku Gothic ProN", ui-sans-serif, system-ui`
- **技術ラベル/コード**: `IBM Plex Mono`, フォールバック: `"JetBrains Mono", ui-monospace`
- **OpenType 機能（ディスプレイ）**: `"cv01", "cv11", "cv12", "cv13", "ss07"`（Sanity スタイル）
- **OpenType 機能（本文）**: `"calt" 0`

### 階層

| 役割 | フォント | サイズ | ウェイト | 行間 | 字間 | 備考 |
|------|----------|--------|----------|------|------|------|
| ヒーロー | Inter | 72px (4.5rem) | 400 | 1.05 | -2.88px | 推し色でエディタを染めろ！ / 1行表示、改行しない (white-space: nowrap) |
| セクション見出し | Inter | 48px (3rem) | 400 | 1.08 | -1.68px | Sanity スタイル |
| 見出し大 | Inter | 38px (2.38rem) | 400 | 1.10 | -1.14px | 機能セクション |
| 見出し中 | Inter | 32px (2rem) | 425 | 1.24 | -0.32px | カードタイトル |
| 見出し小 | Inter | 24px (1.5rem) | 425 | 1.24 | -0.24px | 小見出し |
| 本文大 | Inter | 18px (1.13rem) | 400 | 1.50 | -0.18px | イントロ文 |
| 本文 | Inter | 16px (1rem) | 400 | 1.50 | normal | 説明文 |
| 本文小 | Inter | 15px (0.94rem) | 400 | 1.50 | -0.15px | コンパクト本文 |
| キャプション | Inter | 13px (0.81rem) | 400-500 | 1.50 | -0.13px | メタデータ |
| マイクロ | Inter | 11px (0.69rem) | 500-600 | 1.00 | normal | uppercase ラベル |
| コード本文 | IBM Plex Mono | 15px (0.94rem) | 400 | 1.50 | normal | コードブロック |
| コードキャプション | IBM Plex Mono | 13px (0.81rem) | 400-500 | 1.50 | normal | 技術ラベル、uppercase |
| コードマイクロ | IBM Plex Mono | 10-12px | 400 | 1.30 | normal | 小さなコードラベル |

### 原則
- **極端な負のレタースペーシング**: 72px で -2.88px、48px で -1.68px。圧縮された、マシニングされた精密さ
- **シングルフォント、複数レジスタ**: Inter がディスプレイも UI も担当。ウェイト範囲は狭い (400-425 がメイン)
- **uppercase は技術ラベル用**: IBM Plex Mono の uppercase + タイトな行間で「システムリードアウト」美学
- **タイト見出し、リラックス本文**: 見出し 1.00-1.24、本文 1.50

## 4. コンポーネントスタイリング

### ボタン

**プライマリ CTA（コーラルレッド ピル）**
- 背景: `#f36458`（Sanity レッド）
- テキスト: `#ffffff`
- パディング: 8px 16px
- 角丸: 99999px（Sanity のフルピル）
- ホバー: 背景が `#0052ef`（エレクトリックブルー）に変化

**セカンダリ（ダーク ピル）**
- 背景: `#0b0b0b`
- テキスト: `#b9b9b9`
- パディング: 8px 12px
- 角丸: 99999px
- ホバー: 背景が `#0052ef` に変化

**ゴースト（サトル）**
- 背景: `#212121`
- テキスト: `#b9b9b9`
- パディング: 0px 12px
- 角丸: 5px
- ボーダー: `1px solid #212121`
- ホバー: 背景が `#0052ef` に変化

**透明 frost ピル（Resend スタイル）**
- 背景: transparent
- テキスト: `#f0f0f0`
- パディング: 5px 12px
- 角丸: 9999px
- ボーダー: `1px solid rgba(214,235,253,0.19)`（frost ボーダー）
- ホバー: 背景 `rgba(255,255,255,0.28)`

### 画像ドロップゾーン
- 背景: `#0b0b0b`
- ボーダー: `2px dashed rgba(214,235,253,0.19)`（frost ボーダーの dashed）
- 角丸: 12px
- ドラッグオーバー時: ボーダーが `#f36458`（コーラルレッド）に変化
- テキスト: `#797979` 「画像をドロップ、またはクリックして選択」
- ホバー: frost リングシャドウが微かに明るくなる

### Vim プレビューパネル
- 背景: パレットの `bg_base` 色（動的）
- ボーダー: `1px solid rgba(214,235,253,0.19)`（frost ボーダー — 結晶のフレーム）
- 角丸: 6px
- シャドウ: なし（colorimetric 深度のみ）
- 内部: IBM Plex Mono 15px でシンタックスハイライト
- **frost ボーダーが Vim プレビューを「結晶のフレーム」で囲む** — パターンCの最大の特徴

### パレットスウォッチ
- frost ボーダーのコンテナ内に配置
- 各色の丸: 角丸 99999px（Sanity のフルピル）、サイズ 40px
- 色名ラベル: 13px IBM Plex Mono uppercase, `#797979`
- HEX値: 13px IBM Plex Mono, `#b9b9b9`
- スウォッチ間隔: 8px
- **純黒背景の中でパレット色がネオンのように映える**

### カード
- 背景: `#212121`（Sanity エレベーテッド）
- ボーダー: `1px solid rgba(214,235,253,0.19)`（frost ボーダー）
- 角丸: 6px（Sanity スタンダード）
- シャドウ: なし — 深度はサーフェス色で表現
- パディング: 24px

### ナビゲーション
- 背景: `#0b0b0b` + バックドロップブラー
- リンク: Inter 16px, `#b9b9b9`
- ホバー: `#0052ef`（Sanity のユニバーサルブルーホバー）
- CTA: コーラルレッドピルボタン
- セパレーター: `1px solid #212121`

## 5. レイアウト原則

### LP ヒーローセクション構成

```
┌─────────────────────────────────────────────────────────┐
│  [#0b0b0b ナビ] ロゴ | About | GitHub                   │
│  ─────── 1px solid #212121 ──────────────────────       │
├─────────────────────────────────────────────────────────┤
│  [#0b0b0b ヒーロー — 純黒の void]                       │
│                                                         │
│     推 し の 色 で 、コ ー ド を 書 く 。                │
│     (72px, -2.88px letter-spacing, 圧縮された精密さ)    │
│                                                         │
│     キャラクター画像から Neovim カラースキームを生成      │
│                                                         │
│  ┌─ frost border ────┐    ┌─ frost border ───────┐     │
│  │                    │    │                       │     │
│  │  画像ドロップ       │ →  │  Vim プレビュー        │     │
│  │  ゾーン            │    │  (結晶フレームの中)    │     │
│  │                    │    │                       │     │
│  └────────────────────┘    │  ● ● ● ● ● パレット  │     │
│                            └───────────────────────┘     │
│                                                         │
│     [#f36458 始める]  [frost pill もっと見る]            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### スペーシング
- ベースユニット: 8px
- セクション間: 64-120px（Sanity の「スライド」的リズム — 各セクションが独立フレーム）
- カード内パディング: 24px
- コンテナ最大幅: 1440px
- ページガター: デスクトップ 32px、モバイル 16px

### ボーダーラディウス（Sanity + Resend ハイブリッド）
- シャープ (3px): 入力、テキストエリア（Sanity）
- サトル (5px): セカンダリボタン、ゴーストボタン（Sanity）
- スタンダード (6px): カード、コンテナ（Sanity）
- ラージ (12px): 大きなカード、フィーチャーパネル
- カード (16px): Resend スタイルのフィーチャーカード
- セクション (24px): Resend の大きなパネル
- ピル (99999px): CTA、バッジ（Sanity のフルピル）

## 6. 深度とエレベーション

| レベル | 処理 | 用途 |
|--------|------|------|
| グラウンド (L0) | `#0b0b0b` | ページ背景 |
| エレベーテッド (L1) | `#212121` | カード、コンテナ |
| プロミネント (L2) | `#353535` | 強調ボーダー、仕切り |
| インバーテッド (L3) | `#ffffff` | 反転セクション |
| frost リング | `rgba(176,199,217,0.145) 0px 0px 0px 1px` | shadow-as-border |
| フォーカス | `0 0 0 2px #0052ef` | フォーカスリング |

**深度哲学**: シャドウではなく **colorimetric（色計測的）** に深度を表現する。`#0b0b0b`（地面）→ `#212121`（浮上）→ `#353535`（目立つ）→ `#ffffff`（反転/最高）。純黒の上でドロップシャドウは見えない。代わりに frost ボーダーが構造を作り、サーフェス色が深度を作る。

## 7. やるべきこと・やってはいけないこと

### やるべき
- `#0b0b0b` を基調に achromatic グレースケールを維持 — warm/cool のティントなし
- frost ボーダー (`rgba(214,235,253,0.19)`) をすべての構造線に使う
- `#0052ef` をすべてのインタラクティブ要素のホバー/アクティブに統一
- CTA は `#f36458` コーラルレッドのフルピル (99999px)
- IBM Plex Mono uppercase で技術ラベルとメタデータを表示
- 深度はサーフェス色（dark→light）で表現 — シャドウではなく
- ディスプレイヘッドラインに極端な負のレタースペーシング (-1.68px 〜 -2.88px)
- パレットスウォッチを純黒の中で「ネオン」のように映えさせる
- 日本語フォールバックに Noto Sans JP を使用

### やってはいけない
- グレースケールに warm/cool カラーティントを混ぜる — Sanity のグレーは純粋な achromatic
- エレベーションにドロップシャドウを使う — 純黒の上でシャドウは見えない
- 12px と 99998px の間のボーダーラディウスを使う — 12px（大カード）から直接ピル (99999px) にジャンプ
- コーラルレッド CTA とエレクトリックブルーインタラクティブを同じ要素に混ぜる
- 700 以上のフォントウェイトを使う — 最大 600、11px uppercase ラベルのみ
- 従来のオフセットボックスシャドウを使う — リングシャドウまたはボーダーベースのみ
- ニュートラルグレーのボーダーを使う — すべてのボーダーは frost blue-tinted

## 8. レスポンシブ挙動

| ブレークポイント | 幅 | 変化 |
|-----------------|------|------|
| モバイル小 | <480px | 単一カラム、38px ヒーロー |
| モバイル | 480-768px | 単一カラム、48px ヒーロー |
| タブレット | 768-960px | 2カラム開始 |
| デスクトップ | 960-1440px | フルレイアウト |
| ラージ | >1440px | コンテナ最大幅維持 |

### コラプス戦略
- ヒーロー: 72px → 48px → 38px、レタースペーシング比率を維持
- ナビ: 水平 → ハンバーガー (768px 以下)
- ドロップゾーン + プレビュー: 横並び → 縦積み
- セクション間隔: 120px → 64px → 48px
- カードグリッド: モバイルではラップではなく水平スクロール

## 9. エージェントプロンプトガイド

### クイックカラーリファレンス
```
背景:           #0b0b0b (純黒キャンバス)
サーフェス:     #212121 (エレベーテッド)
ボーダー:       rgba(214,235,253,0.19) (frost — icy blue-tinted)
リングシャドウ: rgba(176,199,217,0.145) 0px 0px 0px 1px
テキスト主:     #ffffff
テキスト副:     #b9b9b9 (シルバー)
テキスト三:     #797979 (ミディアムグレー)
CTA:            #f36458 (コーラルレッド)
ホバー:         #0052ef (エレクトリックブルー — 全ホバー統一)
成功:           #19d600 (グリーン)
フォーカス:     0 0 0 2px #0052ef
```

### oshicolor 固有のコンポーネント
- 「ヒーローセクションを作成: #0b0b0b 背景。72px Inter ウェイト400、行間1.05、字間-2.88px、白テキストで推し色でエディタを染めろ！。サブテキスト 18px ウェイト400、#b9b9b9、行間1.50。コーラルレッド (#f36458) ピル CTA と透明 frost ピル (rgba(214,235,253,0.19) ボーダー) セカンダリ」
- 「画像ドロップゾーンを作成: #0b0b0b 背景、2px dashed rgba(214,235,253,0.19) frost ボーダー、12px 角丸。中央に #797979 テキスト『画像をドロップ、またはクリックして選択』。ドラッグオーバーでボーダーが #f36458 に変化」
- 「Vim プレビューパネルを作成: 動的 bg_base 色の背景、1px solid rgba(214,235,253,0.19) frost ボーダー（結晶のフレーム）、6px 角丸。IBM Plex Mono 15px でシンタックスハイライト。シンタックス色: オレンジ (#ff801f)、ブルー (#3b9eff)、グリーン (#11ff99)、イエロー (#ffc53d)」
- 「frost ボーダーのパレットスウォッチパネルを作成: #0b0b0b 背景、1px solid rgba(214,235,253,0.19) ボーダー、16px 角丸。5-8個の 40px ピル (99999px) スウォッチ。各スウォッチ下に 13px IBM Plex Mono で HEX値 (#b9b9b9)。上部に 13px IBM Plex Mono uppercase の技術ラベル (#797979)」
- 「カードグリッドを作成: #0b0b0b 背景に3カラム。各カード: #212121 サーフェス、1px solid rgba(214,235,253,0.19) frost ボーダー、6px 角丸、24px パディング。カードタイトル 24px 白 字間-0.24px。本文 13px #b9b9b9。上部に 13px IBM Plex Mono uppercase タグ (#797979)」
- 「ナビゲーションバーを作成: #0b0b0b + バックドロップブラー。リンク 16px Inter #b9b9b9、ホバーで #0052ef。右端にコーラルレッド (#f36458) ピル CTA。下ボーダー 1px solid #212121」

### イテレーションガイド
1. `#0b0b0b` の純黒から始める。`#ffffff` テキスト、`#b9b9b9` セカンダリ
2. frost ボーダー (`rgba(214,235,253,0.19)`) で構造を作る — グレーではなく、ニュートラルでもなく
3. Inter で極端な負のレタースペーシングを見出しに。本文は 1.50 行間
4. `#f36458` を CTA に、`#0052ef` をすべてのホバー/インタラクティブに
5. 8px ベースユニット。セクション内 16-32px、セクション間 64-120px
6. IBM Plex Mono uppercase で技術ラベルとメタデータを表示
7. シャドウは使わない — frost ボーダーが深度を作る
8. パレットスウォッチは純黒の中で「ネオンサイン」のように映えさせる

---

## 参照元デザインシステム（原文）

以下は、このデザインシステムの構築に使用した参照元の原文です。stitch がデザインの詳細を判断する際に参照してください。

### Sanity DESIGN.md

<details>
<summary>クリックで展開</summary>

#### Visual Theme & Atmosphere

Sanity's website is a developer-content platform rendered as a nocturnal command center -- dark, precise, and deeply structured. The entire experience sits on a near-black canvas (`#0b0b0b`) that reads less like a "dark mode toggle" and more like the natural state of a tool built for people who live in terminals.

The signature typographic voice is waldenburgNormal with tight negative letter-spacing (-0.32px to -4.48px at display sizes) that gives headlines a compressed, engineered quality. This is paired with IBM Plex Mono for code and technical labels.

What makes Sanity distinctive is the interplay between its monochromatic dark palette and vivid, saturated accent punctuation. The neutral scale runs from pure black through a tightly controlled gray ramp (`#0b0b0b` -> `#212121` -> `#353535` -> `#797979` -> `#b9b9b9` -> `#ededed` -> `#ffffff`) with no warm or cool bias.

**Key Characteristics:**
- Near-black canvas (`#0b0b0b`) as the default, natural environment
- Extreme negative tracking at display sizes
- Pure achromatic gray scale — no warm or cool undertones
- Vivid accent punctuation: neon green, electric blue (`#0052ef`), coral-red (`#f36458`)
- Pill-shaped primary buttons (99999px) vs subtle rounded rectangles (3-6px)
- IBM Plex Mono uppercase for technical labels
- Hover states shift to electric blue across all interactive elements

#### Depth Philosophy

Sanity's depth system is almost entirely **colorimetric** rather than shadow-based. Elevation: `#0b0b0b` (ground) -> `#212121` (elevated) -> `#353535` (prominent) -> `#ffffff` (inverted/highest). Traditional drop shadows would be invisible on dark backgrounds. Border-based containment (1px solid `#212121` or `#353535`) serves as the primary spatial separator.

#### Do's
- Use achromatic gray scale as foundation — pure neutral discipline
- Apply Electric Blue (`#0052ef`) consistently as universal hover/active state
- Use extreme negative letter-spacing on display headings 48px+
- Keep primary CTAs as full-pill shapes (99999px) with coral-red
- Use IBM Plex Mono uppercase for technical labels
- Communicate depth through surface color, not shadows

#### Don'ts
- Don't introduce warm or cool color tints to neutral scale
- Don't use drop shadows for elevation
- Don't apply border-radius between 13px and 99998px
- Don't mix coral-red CTA with electric blue in same element
- Don't use heavy font weights (700+)
- Don't use traditional offset box-shadows

</details>

### Resend DESIGN.md

<details>
<summary>クリックで展開</summary>

#### Visual Theme & Atmosphere

Resend's website is a dark, cinematic canvas that treats email infrastructure like a luxury product. The entire page is draped in pure black (`#000000`) with text that glows in near-white (`#f0f0f0`), creating a theater-like experience.

Three carefully chosen typefaces create a hierarchy: Domaine Display (serif hero, 96px), ABC Favorit (geometric sections, 56px), Inter (body/UI). Combined with pill-shaped buttons (9999px radius), multi-color accent system, and OpenType stylistic sets, the result feels premium, precise, and quietly confident.

What makes Resend distinctive is its icy, blue-tinted border system: `rgba(214, 235, 253, 0.19)` — a frosty, slightly blue-tinted line at 19% opacity that gives every container and divider a cold, crystalline quality against the black background.

**Key Characteristics:**
- Pure black background with near-white text — theatrical darkness
- Three-font hierarchy: Domaine Display (serif), ABC Favorit (geometric), Inter (body)
- Icy blue-tinted borders: `rgba(214, 235, 253, 0.19)` — crystalline shimmer
- Multi-color accent system: orange, green, blue, yellow, red
- Pill-shaped buttons (9999px) with transparent backgrounds
- Commit Mono for code — monospace as design element
- Ring shadow: `rgba(176, 199, 217, 0.145) 0px 0px 0px 1px` — blue-tinted shadow-as-border

#### Shadow Philosophy

Resend barely uses shadows. On pure black, traditional shadows are invisible. Instead, depth comes through frost borders — thin, icy blue-tinted lines that catch light against darkness. "Glass panel floating in space" aesthetic where borders are the primary depth mechanism.

#### Do's
- Use pure black as page background
- Apply frost borders for all structural lines
- Use multi-color accent scale with opacity variants
- Keep shadows at ring level (0px 0px 0px 1px)
- Use pill radius (9999px) for CTAs and tags

#### Don'ts
- Don't lighten background above black — the void is non-negotiable
- Don't use neutral gray borders — all borders must have frost blue tint
- Don't mix accent colors in same component
- Don't use box-shadow for elevation — use frost borders
- Don't make buttons opaque on dark — transparency with frost border

</details>
