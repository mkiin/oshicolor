# prism-react-renderer 使い方ガイド

本プロジェクト（oshicolor）での `prism-react-renderer` 利用方法をまとめたガイドです。

## インストール

```sh
pnpm add prism-react-renderer
```

> `react` が peer dependency として必要です（本プロジェクトではすでにインストール済み）。

---

## 基本的な使い方

`Highlight` コンポーネントと `themes` をインポートして使います。

```tsx
import { Highlight, themes } from "prism-react-renderer";

const codeBlock = `
const hello = "world";
console.log(hello);
`;

export function CodeBlock() {
  return (
    <Highlight theme={themes.vsDark} code={codeBlock} language="typescript">
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre className={className} style={style}>
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line })}>
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token })} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  );
}
```

---

## Props

### 必須 Props

| Prop       | 型         | 説明                                             |
| ---------- | ---------- | ------------------------------------------------ |
| `code`     | `string`   | ハイライト対象のコード文字列                     |
| `language` | `string`   | 言語指定（例: `"typescript"`, `"tsx"`, `"css"`） |
| `children` | `function` | レンダー関数（後述）                             |

### オプション Props

| Prop    | 型           | デフォルト | 説明                                |
| ------- | ------------ | ---------- | ----------------------------------- |
| `theme` | `PrismTheme` | `vsDark`   | シンタックスハイライトのテーマ      |
| `prism` | `PrismLib`   | 同梱版     | 独自の Prism インスタンスを使う場合 |

---

## children レンダー関数

`Highlight` は render props パターンを採用しています。children に関数を渡し、その返り値で描画内容を制御します。

```tsx
<Highlight code={code} language="typescript">
  {({ className, style, tokens, getLineProps, getTokenProps }) => (
    // ここで自由に描画
  )}
</Highlight>
```

### children 関数に渡されるオブジェクト

| プロパティ      | 型              | 説明                                                      |
| --------------- | --------------- | --------------------------------------------------------- |
| `tokens`        | `Token[][]`     | 行ごとのトークン配列（外側が行、内側がトークン）          |
| `className`     | `string`        | `<pre>` に付与すべきクラス名（常に `.token-line` を含む） |
| `style`         | `CSSProperties` | テーマに基づくスタイル                                    |
| `getLineProps`  | `function`      | 行要素（`<div>`）に spread するpropsを返す                |
| `getTokenProps` | `function`      | トークン要素（`<span>`）に spread するpropsを返す         |

#### `getLineProps` の使い方

```tsx
<div {...getLineProps({ line })}>{/* 行内のトークンを描画 */}</div>
```

#### `getTokenProps` の使い方

```tsx
<span {...getTokenProps({ token })} />
```

---

## テーマ

### ビルトインテーマ一覧

`themes` オブジェクトから選択できます。

```tsx
import { themes } from "prism-react-renderer";

// 利用可能なテーマ例
themes.vsDark; // Visual Studio Code Dark（デフォルト）
themes.vsLight; // Visual Studio Code Light
themes.dracula; // Dracula
themes.github; // GitHub
themes.nightOwl; // Night Owl
themes.shadesOfPurple; // Shades of Purple
themes.oceanicNext; // Oceanic Next
themes.okaidia; // Okaidia
themes.ultramin; // Ultramin
themes.duotoneDark; // Duotone Dark
themes.duotoneLight; // Duotone Light
```

### カスタムテーマ

`PrismTheme` 型に従って独自テーマを定義できます。

```tsx
import type { PrismTheme } from "prism-react-renderer";

const customTheme: PrismTheme = {
  plain: {
    backgroundColor: "#1e1e2e",
    color: "#cdd6f4",
  },
  styles: [
    {
      types: ["comment"],
      style: { color: "#6c7086", fontStyle: "italic" },
    },
    {
      types: ["keyword"],
      style: { color: "#cba6f7" },
    },
    {
      types: ["string"],
      style: { color: "#a6e3a1" },
    },
  ],
};
```

### CSS テーマを使う場合

CSS ファイルベースのテーマ（PrismJS 公式テーマ等）を使う場合は、`theme` に空オブジェクトを渡してビルトインテーマを無効化します。

```tsx
const emptyTheme = { plain: {}, styles: [] };

<Highlight theme={emptyTheme} code={code} language="typescript">
  {/* ... */}
</Highlight>;
```

---

## 行番号の表示

`getLineProps` に渡すオブジェクトを活用して行番号を追加できます。

```tsx
<Highlight theme={themes.vsDark} code={code} language="typescript">
  {({ className, style, tokens, getLineProps, getTokenProps }) => (
    <pre className={className} style={style}>
      {tokens.map((line, i) => (
        <div key={i} {...getLineProps({ line })}>
          {/* 行番号 */}
          <span style={{ color: "#6c7086", userSelect: "none", marginRight: "1rem" }}>{i + 1}</span>
          {/* トークン */}
          {line.map((token, key) => (
            <span key={key} {...getTokenProps({ token })} />
          ))}
        </div>
      ))}
    </pre>
  )}
</Highlight>
```

---

## 追加言語のサポート

デフォルトでは基本的な言語セットのみ同梱されています。追加言語が必要な場合は `prismjs` をインストールして読み込みます。

```sh
pnpm add prismjs
```

```tsx
import { Highlight, Prism } from "prism-react-renderer";

// グローバルに Prism を登録
(typeof global !== "undefined" ? global : window).Prism = Prism;

// 必要な言語を非同期インポート
await import("prismjs/components/prism-ruby");
```

### デフォルトで含まれる主な言語

- `markup` / `html` / `xml`
- `css`
- `javascript` / `js`
- `typescript` / `ts`
- `tsx` / `jsx`
- `json`
- `bash` / `shell`
- `markdown`
- `python`
- `rust`
- `go`

---

## ユーティリティ関数（上級者向け）

### `useTokenize` フック

Prism のトークン化処理のみを行うフックです。`<Highlight>` を使わず自前でレンダリングする場合に有用です。

```tsx
import { useTokenize, Prism } from "prism-react-renderer";

const tokens = useTokenize({
  prism: Prism,
  code: "const x = 1;",
  language: "typescript",
});
```

### `normalizeTokens`

Prism のトークン配列を行ごとの配列に正規化するユーティリティ関数です。

```tsx
import { normalizeTokens } from "prism-react-renderer";

const normalized = normalizeTokens(rawTokens);
// Token[][] 形式に変換される
```

---

## oshicolor での活用ポイント

- 生成した Neovim カラースキーム（Lua コード）をプレビュー表示する際に利用する
- テーマは `themes.vsDark` または `themes.vsLight` をベースに、抽出したパレットカラーでカスタムテーマを動的生成することを検討する
- コードブロックは `<pre>` + Tailwind でスタイリングし、スクロール対応にする
