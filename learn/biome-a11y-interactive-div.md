---
title: Biome a11y — div に onClick を付けたときのアクセシビリティ警告
---

# Biome a11y — div に onClick を付けたときのアクセシビリティ警告

## はじめに

画像のドラッグ&ドロップとクリックによるファイル選択を兼ねたドロップゾーンを実装していた。よくある実装として `<div>` にドラッグイベントと `onClick` を付け、内側の `<input type="file">` をプログラムから呼び出す構成にした。

```tsx
<div
  onDrop={handleDrop}
  onDragOver={handleDragOver}
  onDragLeave={handleDragLeave}
  onClick={() => inputRef.current?.click()}
  className="border-2 border-dashed rounded-xl p-12 ..."
>
  <p>画像をドラッグ&ドロップ、またはクリックして選択</p>
  <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
</div>
```

動作はするものの、Biome のアクセシビリティルールから複数の警告が出た。その警告を潰していくなかで、さらに別の警告が出るという連鎖が発生したので、流れごと整理する。

## 問題

ファイルドロップゾーンとして `<div>` に `onClick` を付けたところ、Biome から以下の2つの警告が出た。

```
noStaticElementInteractions: Static Elements should not be interactive.
useKeyWithClickEvents: Enforce to have the onClick mouse event with the onKeyUp, the onKeyDown, or the onKeyPress keyboard event.
```

さらに `role="button"` を付けて対処しようとしたところ、今度は別の警告が出た。

```
useSemanticElements: The elements with this role can be changed to the following elements: <button>
```

## 原因

### Biome の各警告が指している問題

**`noStaticElementInteractions`**
`<div>` や `<span>` はデフォルトで ARIA ロールを持たない「静的要素」。マウスイベントを付けてもキーボードユーザーや支援技術には伝わらない。

**`useKeyWithClickEvents`**
`onClick` のみでは、タブキーでフォーカスしてからスペース/Enter で発火するキーボード操作に対応できない。

**`useSemanticElements`**
`role="button"` は `<div>` を「ボタンのように振る舞わせる」回避策。しかし HTML にはもともと `<button>` というセマンティックな要素が存在するため、Biome はそちらを使うよう促す。`role` で意味を後付けするより、最初から正しい要素を使うべきというルール。

### なぜ `<div onClick>` は嫌われるのか

Biome の警告はあくまで表面的な症状であり、根本には「セマンティック HTML を無視している」という問題がある。

#### 1. ブラウザのネイティブ動作を自分で再実装しなければならない

`<button>` はブラウザが長年かけて実装してきたインタラクティブ要素で、何もしなくても以下が動作する。

| 機能                                 | `<button>`                  | `<div>`                                                 |
| ------------------------------------ | --------------------------- | ------------------------------------------------------- |
| タブキーでフォーカス                 | ✅ ネイティブ               | ❌ `tabIndex={0}` が必要                                |
| Enter / Space で発火                 | ✅ ネイティブ               | ❌ `onKeyDown` を自前で書く必要がある                   |
| フォーカスリング（`:focus-visible`） | ✅ ネイティブ               | ❌ 自前のスタイルが必要                                 |
| `disabled` 属性                      | ✅ ネイティブ               | ❌ `aria-disabled` + クリック制御を自前で書く必要がある |
| フォームの submit 阻止               | ✅ `type="button"` で制御可 | —                                                       |

`<div>` でボタンを再現しようとすると、これらをすべて自分で実装しなければならない。見た目だけ真似ても、機能は追いつかない。

#### 2. スクリーンリーダーに意味が伝わらない

スクリーンリーダー（VoiceOver、NVDA 等）はHTML要素のセマンティクスをもとにページを読み上げる。

- `<button>` → 「ボタン、ファイルを選択」と読み上げる
- `<div>` → ロールがないため読み上げない、またはテキストだけ読む

視覚的に「クリックできる領域」だと分かっても、スクリーンリーダーのユーザーにはその意図が届かない。

#### 3. `role` の後付けは根本解決にならない

`role="button"` を付けることでスクリーンリーダーへの伝達は改善されるが、キーボード操作や `disabled` の管理は依然として自前で実装しなければならない。

WAI-ARIA の仕様には **ARIA の第一のルール** がある。

> ネイティブの HTML 要素や属性で必要なセマンティクスと動作が実現できる場合は、要素を再利用して ARIA を後付けするのではなく、ネイティブの要素を使うこと。
>
> — [WAI-ARIA Authoring Practices](https://www.w3.org/TR/using-aria/#rule1)

`role` はネイティブ要素では表現できない複雑なウィジェット（タブ、ツリービュー等）のために存在する。`<button>` の代替として使うのは本末転倒。

#### 4. なぜ `<div>` でボタンを作りたくなるのか

よくある動機は「`<button>` のデフォルトスタイルが邪魔」というもの。ブラウザが `<button>` にデフォルトで付与する `border`・`background`・`padding` を消したくて、スタイルの自由度が高い `<div>` を選んでしまう。

しかしこれは CSS リセットで一行で解決できる。

```css
button {
  all: unset;
  cursor: pointer;
}
```

Tailwind CSS であれば `appearance-none` や `bg-transparent border-0` を使えばよい。スタイリングの問題はセマンティクスを捨てる理由にならない。

## 対処方

`<div>` を `<button type="button">` に置き換えた。

```tsx
// 修正前
<div
    onClick={() => inputRef.current?.click()}
    onDrop={handleDrop}
    onDragOver={handleDragOver}
    onDragLeave={handleDragLeave}
    className="..."
>

// 修正後
<button
    type="button"
    onClick={() => inputRef.current?.click()}
    onDrop={handleDrop}
    onDragOver={handleDragOver}
    onDragLeave={handleDragLeave}
    className="w-full ..."
>
```

`<button>` に置き換えることで得られるもの：

- **キーボード操作**：Enter / Space でのアクティベーションをブラウザがネイティブに処理
- **フォーカス**：`tabIndex` を付けなくてもタブ移動に含まれる
- **ARIA**：デフォルトの role が `button` なので `role` 属性が不要
- **ドラッグイベント**：`<button>` でも `onDrop` / `onDragOver` は問題なく動作する

なお `<button>` はインライン要素のためレイアウトが崩れる場合は `w-full` など幅指定が必要。

## まとめ

`<div onClick>` は「動くが、アクセシブルでない」実装の典型例。Biome の a11y ルールはその問題を段階的に指摘してくる。

| 警告                          | 根本原因                              | 正しい対処                    |
| ----------------------------- | ------------------------------------- | ----------------------------- |
| `noStaticElementInteractions` | 静的要素をインタラクティブにしている  | セマンティックな要素に変える  |
| `useKeyWithClickEvents`       | キーボード操作に未対応                | セマンティックな要素に変える  |
| `useSemanticElements`         | `role` の後付けで回避しようとしている | `role` でなく適切な要素を使う |

### 今後のための判断基準

何かをクリックできるようにするとき、まず以下の問いを立てる。

- **別のページや URL に遷移する** → `<a href="...">`
- **その場でアクションを起こす（送信・開く・閉じる等）** → `<button type="button">`
- **上記のいずれでもない複雑なウィジェット** → ネイティブ要素 + ARIA（最終手段）

`<div>` / `<span>` にインタラクションを付けるのは、ネイティブ要素では表現できないカスタムウィジェットを作る場合の最終手段。スタイリングが理由なら CSS で解決する。
