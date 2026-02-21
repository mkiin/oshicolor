# R5 リアルタイムプレビュー UI

## 1. 概要

キャラクターイラストから抽出したカラーパレット（R3 出力: `ThemeVariants`）をブラウザ上で
Neovim 風 UI としてリアルタイムにプレビューし、各色を GUI で微調整できる機能。

| 項目 | 内容 |
|---|---|
| **入力** | `ThemeVariants`（R3 出力）＋ `ThemeMeta` |
| **出力** | ブラウザ上の Neovim 風プレビュー UI（インタラクティブ） |
| **配置** | `src/features/editor/` |
| **新規パッケージ** | `prism-react-renderer`、`react-colorful` |

---

## 2. シンタックスハイライトライブラリ選定

### 採用: `prism-react-renderer`

| 評価軸 | 内容 |
|---|---|
| **リアルタイム更新との相性** | ◎ トークナイズ結果は一度きり。色変更は CSS 変数の差し替えのみで再レンダリング不要 |
| **バンドルサイズ** | ◎ ~7 KB（Shiki は TextMate 文法込みで 1 MB 超） |
| **言語対応** | ○ TypeScript / Python / Lua を標準サポート |
| **レンダリング制御** | ◎ render-props パターンでトークンごとに完全制御できる |
| **メンテナンス状況** | ◎ Docusaurus が採用・維持 |
| **対応環境** | ◎ クライアントサイド SPA（TanStack Start + Cloudflare Workers）で問題なし |

### 不採用ライブラリと理由

| ライブラリ | 不採用理由 |
|---|---|
| **Shiki / react-shiki** | バンドルサイズが大きい（1 MB+）。SSR / RSC 用途に設計されており Cloudflare Workers SPA では過剰 |
| **react-syntax-highlighter** | メンテナンス停滞。Tailwind Purge との相性問題あり |
| **Bright** | React Server Component 専用。TanStack Start の CSR では使えない |

---

## 3. リアルタイム色更新のアーキテクチャ

```
Jotai editorAtom
  (ThemeVariants base + overrides + activeVariant)
          │
          ▼
  useEditorColors() hook
  → effective HighlightMap（base にoverrides をマージ）
          │
          ▼
  useEffect → <style> タグへ CSS 変数をインジェクト
  --preview-bg: #0d1117;
  --preview-fg: #e8f4f8;
  --preview-comment: #4a7a8a;
  ...
          │
          ▼
  prism-react-renderer が一度トークナイズ済みの DOM に対し
  CSS 変数が即座に適用される（再トークナイズ不要）
```

### CSS 変数命名規則

| HighlightMap キー | CSS 変数名 |
|---|---|
| `Normal.bg` | `--preview-bg` |
| `Normal.fg` | `--preview-fg` |
| `Comment.fg` | `--preview-comment` |
| `String.fg` | `--preview-string` |
| `Function.fg` | `--preview-func` |
| `Keyword.fg` | `--preview-keyword` |
| `Type.fg` | `--preview-type` |
| `Number.fg` | `--preview-number` |
| `Special.fg` | `--preview-special` |
| `CursorLine.bg` | `--preview-cursor-line` |
| `Visual.bg` | `--preview-visual` |
| `Pmenu.bg` | `--preview-pmenu` |
| `PmenuSel.bg` | `--preview-pmenu-sel` |

---

## 4. Prism トークン → HighlightMap キーのマッピング

```typescript
// src/features/editor/utils/token-class-map.ts
export const TOKEN_CLASS_MAP: Record<string, string> = {
  comment:             "Comment",
  string:              "String",
  "template-string":   "String",
  char:                "String",
  function:            "Function",
  "function-variable": "Function",
  method:              "Function",
  keyword:             "Keyword",
  "class-name":        "Type",
  number:              "Number",
  integer:             "Number",
  boolean:             "Number",   // Boolean は Number と同色
  operator:            "Keyword",
  builtin:             "Special",
  regex:               "Special",
  punctuation:         "Normal",
};
// 未マッチのトークンは "Normal" にフォールバック
```

---

## 5. 型定義

```typescript
// src/features/editor/types/types.ts

// ユーザーによる上書き（グループ名 → fg または bg の色上書き）
type EditorOverrides = Partial<HighlightMap>;

// エディタ全体の状態（Jotai アトムが保持）
type EditorState = {
  variants: ThemeVariants;       // R3 出力（元データ。書き換えない）
  overrides: EditorOverrides;    // ユーザーによる個別上書き
  activeVariant: "dark" | "light";
  meta: ThemeMeta;
  activeLang: SampleLang;        // プレビューするサンプルコードの言語
};

// サンプルコード言語
type SampleLang = "typescript" | "python" | "lua";
```

---

## 6. Jotai アトム設計

```typescript
// src/features/editor/stores/editor.store.ts

// 初期状態
const editorAtom = atom<EditorState>({ ... });

// 実効カラーマップ（base + overrides をマージした派生 atom）
const effectiveMapAtom = atom((get) => {
  const { variants, overrides, activeVariant } = get(editorAtom);
  const base = variants[activeVariant];
  // overrides で上書き（Partial<HighlightMap> をマージ）
  return mergeHighlightMap(base, overrides);
});
```

`mergeHighlightMap` は `HighlightAttr` 単位でディープマージする純粋関数（`src/features/editor/utils/` に置く）。

---

## 7. Neovim UI シミュレーション構造

```
┌─────────────────────────────────────────────────┐ ← Normal.bg
│  1  │ import { useState } from 'react';           │
│  2  │                                             │
│  3  │ function App() {                            │ ← CursorLine.bg（カレント行）
│  4  │   const [count, setCount] = useState(0);   │
│  5  │   return <div>{count}</div>;                │
│  6  │ }                                           │
├─────────────────────────────────────────────────┤
│ NORMAL  src/App.tsx           5:1     utf-8      │ ← StatusLine.bg
└─────────────────────────────────────────────────┘
```

- **行番号列**: `LineNr.fg`、カレント行は `CursorLineNr.fg`
- **コード領域**: `Normal.bg` に CSS 変数で色付け
- **ステータス行**: `StatusLine.bg` + `StatusLine.fg` で模倣（簡略版）

---

## 8. コンポーネント構成

```
src/features/editor/
├── components/
│   ├── theme-editor.tsx          # ページルートが使うメインコンポーネント
│   ├── nvim-preview.tsx          # Neovim 風 UI（行番号 + コード + ステータス行）
│   ├── code-preview.tsx          # prism-react-renderer でトークンレンダリング
│   ├── color-swatch.tsx          # クリックでカラーピッカーを開くスウォッチ
│   ├── color-picker-popover.tsx  # react-colorful + Radix Popover
│   ├── variant-toggle.tsx        # dark/light 切り替えボタン
│   └── lang-tabs.tsx             # TypeScript/Python/Lua タブ
├── hooks/
│   └── use-editor-colors.ts      # effectiveMapAtom → CSS 変数インジェクト
├── stores/
│   └── editor.store.ts           # editorAtom, effectiveMapAtom
├── constants/
│   └── sample-code.ts            # TypeScript / Python / Lua サンプルコード定数
├── utils/
│   ├── token-class-map.ts        # Prism トークン → HighlightMap キー
│   └── merge-highlight-map.ts    # base + overrides のディープマージ
└── types/
    └── types.ts                  # EditorOverrides, EditorState, SampleLang
```

---

## 9. サンプルコード

3 言語それぞれのコードは `constants/sample-code.ts` に定数として格納する。
各サンプルは以下のトークンを含むよう設計する（ハイライトの確認のため）:
`comment`, `string`, `function`, `keyword`, `class-name`, `number`, `boolean`, `operator`

| 言語 | サンプルの内容 |
|---|---|
| TypeScript | 関数・型定義・JSX を含む汎用的な React コンポーネント |
| Python | クラス定義・デコレータ・f-string・型ヒントを含む |
| Lua | Neovim プラグイン風（関数・テーブル・文字列） |

---

## 10. カラーピッカーの UX フロー

1. ユーザーが「ハイライトグループ一覧」から色スウォッチをクリック
2. `ColorPickerPopover` が Radix Popover で開く（`react-colorful` の `HexColorPicker` を内包）
3. 色変更イベント → Jotai `editorAtom.overrides` を更新
4. `effectiveMapAtom` が自動再計算 → `useEditorColors` が CSS 変数を更新
5. プレビューが即座に反映（再トークナイズなし）
6. 「元に戻す」ボタンでその色の override を削除し base 値に戻す

---

## 11. 依存パッケージ

| パッケージ | 新規/既存 | 用途 |
|---|---|---|
| `prism-react-renderer` | **新規追加** | コードのトークナイズ + レンダリング |
| `react-colorful` | **新規追加** | HEX カラーピッカー UI（2.8 KB gzip） |
| `jotai` | 既存 | エディタ状態管理 |
| `radix-ui` (Popover) | 既存 | カラーピッカーのポップオーバー |
| `tailwindcss` v4 | 既存 | スタイリング |

---

## 12. ファイル構成まとめ

```
src/features/editor/          ← R5 新規ディレクトリ
├── components/ （上記参照）
├── hooks/
├── stores/
├── constants/
├── utils/
└── types/
```

---

## 13. 検証方法

| 検証項目 | 手順 |
|---|---|
| **シンタックスハイライト** | TypeScript / Python / Lua のサンプルコードが正しく色付けされることを目視確認 |
| **リアルタイム更新** | カラーピッカーで色を変えると 16ms 以内にプレビューへ反映されること（DevTools で確認） |
| **dark / light 切り替え** | トグルで即時切り替えされること |
| **override / reset** | 色を変更後にリセットで元の色に戻ること |
| **Jotai 不変性** | base `ThemeVariants` がユーザー操作で書き換わらないこと（Jotai devtools で確認） |
