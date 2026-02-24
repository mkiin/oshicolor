# Neovim プレビューコンポーネント 設計マップ

## 前提：このコンポーネントが何をするか

`CharacterPalette`（画像から生成した色）を受け取り、
「Neovim でこのカラースキームを使ったらどう見えるか」をブラウザ上で再現する。

主に表現したい要素：
- エディタ背景・文字色（`bg` / `fg`）
- シンタックスハイライト（`fn` / `kw` / `string` など 8 ロール）
- UI クローム（ステータスライン、行番号）

---

## コンポーネント分解案

```
NeovimPreview                      ← 外から触るエントリーポイント（orchestrator）
├── NeovimTabLine?                 ← タブバー（省略可能）
├── NeovimEditorArea               ← エディタ本体
│   ├── NeovimGutter               ← 行番号 + サインカラム
│   └── NeovimCodeBlock            ← prism-react-renderer を包むコンポーネント
└── NeovimStatusLine               ← 下部ステータスバー
      ├── ModeTag                  ← NORMAL / INSERT / VISUAL
      ├── FileInfo                 ← ファイル名 + 言語
      └── CursorPosition           ← 行:列
```

### 各コンポーネントの責務

| コンポーネント | 責務 | 外部から変えたい props |
|---|---|---|
| `NeovimPreview` | 全体オーケストレーション・色の変換を一括処理 | `palette`, `code`, `language`, 表示スイッチ類 |
| `NeovimTabLine` | タブ表示（省略可能） | `fileName`, `colors` |
| `NeovimEditorArea` | Gutter と CodeBlock のレイアウト | `colors`（内部向け） |
| `NeovimGutter` | 行番号の描画 | `lineCount`, `currentLine`, `colors` |
| `NeovimCodeBlock` | `Highlight` コンポーネントのラッパー | `code`, `language`, `prismTheme` |
| `NeovimStatusLine` | UI クローム下部の描画 | `mode`, `fileName`, `language`, `lineCount`, `colors` |

---

## Props 設計

### 設計原則：外部型に依存しない

`NeovimPreview` は `CharacterPalette` を**知らない**。
このコンポーネント自身が色の型（`NeovimColorTokens`）を定義し、
hex 文字列の集まりとして受け取る。

```
[呼び出し側]
  CharacterPalette
      │
      │  変換（コンポーネントの外）
      ▼
  NeovimColorTokens ──→ <NeovimPreview colors={...} />
```

変換関数はこのコンポーネントのスコープ外（`oshicolor` の機能側）に置く。

---

### `NeovimColorTokens`（コンポーネント自身が定義する型）

```typescript
/** NeovimPreview が必要とする色トークン。すべて hex 文字列 */
type NeovimColorTokens = {
  // ── エディタ背景・前景 ──────────────────────────────────────────────
  bg: string;
  fg: string;
  comment: string;

  // ── シンタックス ────────────────────────────────────────────────────
  fn: string;
  kw: string;
  field: string;
  string: string;
  type: string;
  op: string;
  const: string;
  special: string;

  // ── UI クローム ─────────────────────────────────────────────────────
  /** ステータスライン背景（未指定なら bg より少し明るい色を自動生成してもよい） */
  statusLineBg?: string;
  /** ステータスラインのモード表示に使うアクセント色 */
  accent: string;
};
```

### `NeovimPreviewProps`（外部公開 props）

```typescript
type NeovimPreviewProps = {
  // ── コア ──────────────────────────────────────────────────────────
  /** 表示に使う色トークン */
  colors: NeovimColorTokens;

  // ── コンテンツ ─────────────────────────────────────────────────────
  /** ハイライト表示するコード文字列 */
  code: string;
  /** Prism の言語識別子（例: "typescript", "lua"） */
  language: string;
  /** ステータスラインに表示するファイル名 */
  fileName?: string;           // default: "preview.ts"

  // ── UI トグル ──────────────────────────────────────────────────────
  /** 行番号を表示するか */
  showLineNumbers?: boolean;   // default: true
  /** ステータスラインを表示するか */
  showStatusLine?: boolean;    // default: true
  /** タブラインを表示するか */
  showTabLine?: boolean;       // default: false

  // ── 見た目調整 ─────────────────────────────────────────────────────
  /** ステータスラインに表示するモード */
  mode?: "NORMAL" | "INSERT" | "VISUAL";  // default: "NORMAL"
  /** 外側コンテナへの追加クラス（サイズ指定に使う） */
  className?: string;
};
```

### 内部コンポーネントには何を渡すか

子コンポーネントは `NeovimColorTokens` の一部だけを受け取る（全部 drill-down しない）。

```typescript
// NeovimGutter
type NeovimGutterProps = {
  lineCount: number;
  currentLine?: number;
  bg: string;
  fg: string;
  comment: string;
};

// NeovimStatusLine
type NeovimStatusLineProps = {
  mode: "NORMAL" | "INSERT" | "VISUAL";
  fileName: string;
  language: string;
  lineCount: number;
  bg: string;
  fg: string;
  accent: string;
};

// NeovimCodeBlock
type NeovimCodeBlockProps = {
  code: string;
  language: string;
  prismTheme: PrismTheme;  // ← NeovimPreview 内で colors から変換して渡す
  bg: string;
};
```

---

## 最重要な変換レイヤー：`NeovimColorTokens` → `PrismTheme`

`NeovimColorTokens` の syntax 色を prism-react-renderer の token タイプにマッピングする
**純粋関数**が必要。`NeovimPreview` 内部（あるいは `lib/`）に置く。

```
colors.fn       → types: ["function", "function-variable"]
colors.kw       → types: ["keyword", "control-flow", "module"]
colors.field    → types: ["property", "attr-name"]
colors.string   → types: ["string", "char", "template-string"]
colors.type     → types: ["class-name", "builtin", "namespace"]
colors.op       → types: ["operator", "punctuation"]
colors.const    → types: ["constant", "number", "boolean"]
colors.special  → types: ["decorator", "annotation", "tag"]
colors.comment  → types: ["comment", "block-comment"]
colors.bg / fg  → plain: { backgroundColor, color }
```

この変換関数の型：
```typescript
const colorTokensToPrismTheme = (colors: NeovimColorTokens): PrismTheme => { ... };
```

**この関数をどこに置くか**: `src/features/neovim-preview/lib/color-tokens-to-prism-theme.ts`

> `CharacterPalette → NeovimColorTokens` の変換は **oshicolor 側の責務**。
> このコンポーネントのスコープ外（例: `src/features/editor/lib/`）に置く。

---

## ファイル配置案

```
src/features/neovim-preview/
├── components/
│   ├── neovim-preview.tsx           ← エントリーポイント（外部公開）
│   ├── neovim-editor-area.tsx       ← Gutter + CodeBlock のレイアウト
│   ├── neovim-gutter.tsx            ← 行番号
│   ├── neovim-code-block.tsx        ← prism-react-renderer ラッパー
│   ├── neovim-status-line.tsx       ← ステータスバー
│   └── neovim-tab-line.tsx          ← タブライン（後回し可）
├── lib/
│   ├── palette-to-prism-theme.ts    ← 変換ロジック（テスト対象）
│   └── sample-code.ts               ← デフォルトサンプルコード定数
└── types/
    └── index.ts                     ← 内部共有型（GutterColors 等）
```

---

## データフロー図

```
[oshicolor 側（コンポーネント外）]
  CharacterPalette
      │
      │  characterPaletteToNeovimColors()  ← oshicolor の変換関数
      ▼
  NeovimColorTokens
      │
      │  code / language / fileName / ...
      ▼
┌─────────────────────────────────────────────────────┐
│  NeovimPreview                                      │
│                                                     │
│  colorTokensToPrismTheme(colors) → prismTheme       │  ← コンポーネント内部
│  code.split("\n").length → lineCount                │
│                                                     │
│  ┌──────────────────┐  ┌────────────────────────┐  │
│  │  NeovimTabLine   │  │ NeovimStatusLine        │  │
│  │  fileName        │  │ mode / fileName         │  │
│  │  bg/fg/accent    │  │ lineCount / bg/fg/accent│  │
│  └──────────────────┘  └────────────────────────┘  │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  NeovimEditorArea                           │   │
│  │  ┌──────────────┐  ┌─────────────────────┐ │   │
│  │  │NeovimGutter  │  │ NeovimCodeBlock      │ │   │
│  │  │lineCount     │  │ code / language      │ │   │
│  │  │bg/fg/comment │  │ prismTheme (変換済み)│ │   │
│  │  └──────────────┘  └─────────────────────┘ │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## 未決定事項（詰めが必要な点）

### 1. CursorLine をどう扱うか
Neovim では現在行を `CursorLine` highlight で薄く背景色を変える。
どの行をハイライトするか、固定（例: 5行目）にするか、prop にするかを決める必要がある。

### 2. サンプルコードは誰が管理するか
**案 A**: `code` / `language` は必須 props → 呼び出し元が管理
**案 B**: デフォルト値を `sample-code.ts` に持ち、省略可能にする
→ プレビューとして使う場面を考えると B の方が便利（デモページで毎回渡さなくていい）

### 3. `language` に何を使うか
oshicolor の出力物は Lua（Neovim の設定ファイル）。
ただしプレビューとして TypeScript の方が「構文のバリエーション」を見せやすい。
両方サポートして切り替えられるようにする？

### 4. タブライン（`NeovimTabLine`）は v1 に入れるか
視覚的なリアリティは上がるが、必須ではない。後から足せるので v1 はスキップでも良い。

### 5. サインカラム（sign column）
`●` や `│` などの git/診断マーカーを入れると Neovim らしさが増す。
ただし完全に装飾なので後回しにしても困らない。

### 6. スクロールバー
Neovim には右端にスクロールバーが出る。コードが長い場合に有効だが、装飾レベル。

### 7. ウィンドウのサイズ制御
- 固定サイズ（例: 700x400px）
- `className` で外から制御（推奨: 親が決める設計）
- アスペクト比固定

### 8. Light テーマ対応
`CharacterPalette.bg` は L=0.15 でダークテーマ固定。
ライトモードのプレビューが必要になった場合は別パレット生成が必要になる（現時点ではスコープ外）。

---

## 実装順序の推奨

1. `palette-to-prism-theme.ts` の変換関数（最優先・テスト書きやすい）
2. `NeovimCodeBlock`（prism-react-renderer ラッパー、これだけで動作確認できる）
3. `NeovimGutter`（行番号）
4. `NeovimEditorArea`（Gutter + CodeBlock を横並びにするだけ）
5. `NeovimStatusLine`（UI クローム）
6. `NeovimPreview`（全部組み合わせる）
7. `NeovimTabLine`（任意・後回し可）
