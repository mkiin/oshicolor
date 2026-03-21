# R5/V1 Neovim 再現プレビューコンポーネント

## なぜ V1 が必要か

R2 でカラーパレットからハイライトグループへの色割り当てを実装中だが、結果の評価には実際のエディタ表示に近いプレビューが必要。既存の `r5-preview-editor.md` に設計がまとめられているので、これに基づいて初期実装を行う。

## 設計方針

既存設計ドキュメント（`docs/projects/features/R5/r5-preview-editor.md`）に従う。

### 核心: CSS 変数ベースのリアルタイムプレビュー

```
HighlightMap → CSS 変数インジェクト → prism-react-renderer の DOM に即反映
```

- prism-react-renderer で一度トークナイズ → CSS 変数の差し替えだけで色が即座に更新
- Jotai で状態管理、override で個別色の上書きが可能

### コンポーネント構成

```
src/features/neovim-preview/
├── components/
│   ├── nvim-preview.tsx          # Neovim 風 UI（行番号 + コード + ステータス行）
│   ├── code-preview.tsx          # prism-react-renderer でトークンレンダリング
│   └── color-swatch.tsx          # カラースウォッチ表示
├── hooks/
│   └── use-editor-colors.ts      # HighlightMap → CSS 変数インジェクト
├── constants/
│   └── sample-code.ts            # TypeScript / Python / Lua サンプルコード
├── lib/
│   ├── token-class-map.ts        # Prism トークン → HighlightMap キー
│   └── prism-theme.ts            # CSS 変数ベースの Prism テーマ定義
└── neovim-preview.types.ts       # 型定義
```

### Neovim UI 再現

```
┌─────────────────────────────────────────────────┐ ← Normal.bg
│  1  │ import { useState } from 'react';           │
│  2  │                                             │
│  3  │ function App() {                            │ ← CursorLine.bg
│  4  │   const [count, setCount] = useState(0);   │
│  5  │   return <div>{count}</div>;                │
│  6  │ }                                           │
├─────────────────────────────────────────────────┤
│ NORMAL  src/App.tsx           5:1     utf-8      │ ← StatusLine.bg
└─────────────────────────────────────────────────┘
```

## 実装タスク

1. **prism-react-renderer のセットアップ**
   - パッケージインストール
   - トークン → HighlightMap キーのマッピング定義
   - CSS 変数ベースの Prism テーマ作成

2. **nvim-preview コンポーネント**
   - 行番号列（LineNr / CursorLineNr）
   - コード領域（Normal.bg + syntax ハイライト）
   - ステータスライン（StatusLine.bg/fg）

3. **CSS 変数インジェクト hook**
   - HighlightMap → CSS 変数への変換
   - `<style>` タグへの動的インジェクト

4. **サンプルコード定数**
   - TypeScript / Python / Lua の 3 言語
   - 各トークン種別（comment, string, function, keyword, type, number）を含む

## 依存パッケージ

| パッケージ | 用途 |
| --- | --- |
| `prism-react-renderer` | コードのトークナイズ + レンダリング |

## 備考

- カラーピッカー（react-colorful）は V1 スコープ外。まず表示のみ
- R2/V9 の HighlightMap 生成と並行して進められる
