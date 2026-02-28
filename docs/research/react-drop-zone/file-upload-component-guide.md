# file-upload.tsx 読み方ガイド

> 対象ファイル: `src/components/ui/file-upload.tsx`

---

## 1. react-dropzone を使っているか？

**使っていない。**

`package.json` に `react-dropzone@14.3.8` が依存として記載されており、`README.md` でも言及されているが、
`.tsx` ファイル内で `react-dropzone` は一切インポートされていない。

`file-upload.tsx` は **ネイティブの HTML Drag Events を直接ハンドリングする完全なフルスクラッチ実装**である。

---

## 2. このコンポーネントが解決している問題

`<input type="file">` は標準 HTML 要素だが、以下の点で扱いにくい。

- UI のカスタマイズが難しい
- ドラッグ&ドロップ対応を自前で書く必要がある
- アップロード進捗、エラー状態などを管理する仕組みがない
- アクセシビリティ（ARIA属性）対応が手間

このコンポーネントはこれらをすべて内包した**再利用可能なコンポーネントライブラリ**として設計されている。

---

## 3. アーキテクチャ: Compound Component パターン

このコンポーネントは **Compound Component パターン** で実装されている。
単一の巨大なコンポーネントではなく、役割ごとに分割されたコンポーネントを組み合わせて使う設計。

```tsx
// 使い方のイメージ
<FileUpload onUpload={...} maxFiles={5}>
  <FileUploadDropzone>        {/* ドロップエリア */}
    <FileUploadTrigger>       {/* クリックでファイル選択を開くボタン */}
      ファイルを選択
    </FileUploadTrigger>
  </FileUploadDropzone>

  <FileUploadList>            {/* 選択済みファイル一覧 */}
    <FileUploadItem value={file}>
      <FileUploadItemPreview />   {/* サムネイル or アイコン */}
      <FileUploadItemMetadata />  {/* ファイル名・サイズ・エラー */}
      <FileUploadItemProgress />  {/* アップロード進捗バー */}
      <FileUploadItemDelete />    {/* 削除ボタン */}
    </FileUploadItem>
  </FileUploadList>

  <FileUploadClear />           {/* 全ファイルクリアボタン */}
</FileUpload>
```

コンポーネント間のデータ共有は **React Context** で行い、Props のバケツリレーを避けている。

---

## 4. コンポーネント一覧と役割

| コンポーネント | HTML要素 | 役割 |
|---|---|---|
| `FileUploadRoot` (`FileUpload`) | `div` | **ルート**。状態管理・バリデーション・アップロード処理を担う |
| `FileUploadDropzone` | `div` | ドラッグ&ドロップエリア。クリックでもファイル選択が開く |
| `FileUploadTrigger` | `button` | クリックでファイル選択ダイアログを開くボタン |
| `FileUploadList` | `div` | ファイル一覧。ファイルが0件のときは非表示 |
| `FileUploadItem` | `div` | 個別ファイル行。`value` propsに `File` オブジェクトを渡す |
| `FileUploadItemPreview` | `div` | 画像ならサムネイル、それ以外はファイル種別アイコン |
| `FileUploadItemMetadata` | `div` | ファイル名・サイズ・エラーメッセージ表示 |
| `FileUploadItemProgress` | `div` | 進捗バー（`circular` propで円形も可） |
| `FileUploadItemDelete` | `button` | 個別ファイルの削除ボタン |
| `FileUploadClear` | `button` | 全ファイルクリアボタン。ファイルが0件のときは非表示 |

---

## 5. 状態管理の仕組み: カスタムStore

React の標準 `useState` / `useReducer` ではなく、**カスタムのExternal Store** を実装している。

### なぜ独自Storeか？

ファイルの `Map<File, FileState>` は参照が変わらないまま内容が変わるミュータブルな構造。
`useState` は参照の変化でしか再レンダリングをトリガーしないため、これと相性が悪い。
独自Storeなら `dispatch` のたびにリスナーへ通知できる。

### Store の構造

```
createStore()
├── state: StoreState
│   ├── files: Map<File, FileState>   ← ファイルとその状態のマップ
│   ├── dragOver: boolean             ← ドラッグ中かどうか
│   └── invalid: boolean             ← バリデーションエラー中かどうか
├── dispatch(action) → stateを更新 → リスナーへ通知
├── getState() → 現在のstateを返す
└── subscribe(listener) → 購読登録・解除
```

### アクション一覧

| action variant | 意味 |
|---|---|
| `ADD_FILES` | ファイルを追加（既存は維持） |
| `SET_FILES` | ファイル一覧を置き換え（Controlled モード用） |
| `SET_PROGRESS` | 進捗を更新、statusを `uploading` に |
| `SET_SUCCESS` | アップロード完了、progress=100 |
| `SET_ERROR` | エラー発生、エラーメッセージを保存 |
| `REMOVE_FILE` | 個別ファイルを削除 |
| `SET_DRAG_OVER` | ドラッグ状態を更新 |
| `SET_INVALID` | バリデーションエラー状態を更新 |
| `CLEAR` | 全ファイルをクリア |

### Reactとの接続

`useSyncExternalStore` (React 18+) を使って外部Storeの変化をReactのレンダリングサイクルに繋いでいる。

```ts
// useStore フック（内部実装）
function useStore<T>(selector: (state: StoreState) => T): T {
  return React.useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

// 使い方
const dragOver = useStore((state) => state.dragOver);
```

セレクター関数を使って**必要な値だけ購読**し、不要な再レンダリングを防いでいる。

---

## 6. Context の二層構造

| Context | 内容 |
|---|---|
| `StoreContext` | カスタムStoreのインスタンス。状態の読み書きに使う |
| `FileUploadContext` | IDやref等の静的な値。Store とは分離して不要な再レンダリングを避ける |
| `FileUploadItemContext` | 各ファイルアイテムの情報（`FileState`, ARIA用ID等） |
| `DirectionContext` | ltr/rtl のテキスト方向 |

Storeのインスタンス自体は変わらないので `StoreContext` から読んでも再レンダリングは起きない。
実際の状態変化は `useStore()` フックが `useSyncExternalStore` 経由で検知する。

---

## 7. `asChild` パターン (Radix UI の Slot)

多くのコンポーネントが `asChild?: boolean` propを持つ。

```tsx
// 通常: <button> を内部でレンダリング
<FileUploadTrigger>クリック</FileUploadTrigger>

// asChild: 子要素がそのまま button の代わりになる
<FileUploadTrigger asChild>
  <CustomButton>クリック</CustomButton>
</FileUploadTrigger>
```

`asChild=true` のとき `@radix-ui/react-slot` の `Slot` コンポーネントを使い、
内部のロジック（onClick等）を子要素に **マージ** する仕組み。
デフォルトのHTMLタグに縛られずに使えるため、柔軟なカスタマイズが可能。

---

## 8. ドラッグ&ドロップの実装

`FileUploadDropzone` は5つのネイティブイベントをハンドリングしている。

| イベント | 処理 |
|---|---|
| `onDragEnter` | `dragOver: true` にセット |
| `onDragOver` | `event.preventDefault()` でブラウザデフォルト動作を抑制・`dragOver: true` |
| `onDragLeave` | `dragOver: false` にセット |
| `onDrop` | `DataTransfer` からファイルを取り出し、`<input>` の `.files` に設定してchangeイベントを発火 |
| `onKeyDown` | Enter/Space キーでファイル選択ダイアログを開く（キーボードアクセシビリティ） |

### ドロップ後の処理フロー

```
onDrop
  → DataTransfer からファイル取得
  → inputElement.files に設定
  → change イベント発火
  → onInputChange (FileUploadRoot内)
  → onFilesChange (バリデーション処理)
  → store.dispatch("ADD_FILES")
  → onUpload コールバック呼び出し
```

---

## 9. バリデーションの流れ

`onFilesChange` 内で以下の順番でチェックされる。

1. **maxFiles チェック**: 受け入れ可能な残り枠を超えたファイルを reject
2. **onFileValidate チェック**: カスタムバリデーション関数の結果
3. **accept チェック**: MIMEタイプ・拡張子のフィルタリング
4. **maxSize チェック**: ファイルサイズの上限チェック

バリデーションエラーが発生すると `invalid: true` が2秒間セットされ、UIに視覚的フィードバックを与える。

---

## 10. Controlled / Uncontrolled の両対応

`value` propを渡すと **Controlled モード**（親が状態を管理）、
渡さなければ **Uncontrolled モード**（コンポーネント内部が状態を管理）。

```tsx
// Uncontrolled
<FileUpload onValueChange={(files) => console.log(files)}>

// Controlled
<FileUpload value={files} onValueChange={setFiles}>
```

---

## 11. ユーティリティ関数

| 関数 | 役割 |
|---|---|
| `useAsRef(data)` | コールバック内で常に最新のpropsを参照するためのRef（stale closure 対策） |
| `useLazyRef(fn)` | 初回レンダリング時のみ初期化関数を実行するRef |
| `useIsomorphicLayoutEffect` | SSR時は `useEffect`、CSR時は `useLayoutEffect` を使い分け |
| `formatBytes(bytes)` | バイト数を `1.2 MB` のような人間が読みやすい形式に変換 |
| `getFileIcon(file)` | ファイルタイプ・拡張子に応じた lucide-react アイコンを返す |

---

## 12. アクセシビリティ (WAI-ARIA)

各コンポーネントに適切なARIA属性が付与されており、スクリーンリーダー対応している。

- `FileUploadDropzone`: `role="region"`, `aria-disabled`, `aria-invalid`
- `FileUploadList`: `role="list"`, `aria-orientation`
- `FileUploadItem`: `role="listitem"`, `aria-setsize`, `aria-posinset`, `aria-describedby`, `aria-labelledby`
- `FileUploadItemProgress`: `role="progressbar"`, `aria-valuemin/max/now/text`
- `<input type="file">`: 視覚的に非表示 (`sr-only`) だがDOMに存在し、ARIAで関連付け
- ステータステキスト（アップロード中・完了・エラー）は `sr-only` で読み上げ対応

---

## 13. エクスポート

同じコンポーネントを2種類の名前でエクスポートしている。

```ts
// フルネーム（名前空間なしで使う場合）
export { FileUpload, FileUploadDropzone, FileUploadTrigger, ... }

// 短縮名（名前空間付きで使う場合）
export { Root, Dropzone, Trigger, List, Item, ... }

// カスタムフック
export { useStore as useFileUpload }
```

短縮名を使う場合は名前空間として import する。

```tsx
import * as FileUpload from "@/components/ui/file-upload";

<FileUpload.Root>
  <FileUpload.Dropzone>...</FileUpload.Dropzone>
</FileUpload.Root>
```
