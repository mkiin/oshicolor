# react-dropzone × Jotai 例集 書き直しプラン（JotaiNist 版）

## Context

前回生成した Jotai 組み合わせ例が「Jotai を全く理解していない」レベルだったため、
`docs/research/jotai/` のドキュメントを精読した上で、Jotai らしい設計原則に基づいて
`docs/research/react-drop-zone/` 配下の全 14 README を書き直す。

---

## 現行例の何が問題か（診断）

### 問題 1: 派生 atom（Derived Atom）が一切ない

Jotai の核心は「atom を合成して派生状態を作る」こと。
現行例はすべて `atom([])` に値をセットするだけで、合成が一切ない。

```javascript
// 現状 - Jotai を useState の代替としか使っていない
const filesAtom = atom([]);
// Jotai らしくない。atom の価値の半分を捨てている。

// あるべき姿 - 派生 atom で関連する状態を計算
const filesAtom = atom([]);
const hasFilesAtom = atom((get) => get(filesAtom).length > 0);
const totalSizeAtom = atom((get) =>
  get(filesAtom).reduce((sum, f) => sum + f.size, 0),
);
```

### 問題 2: アクション atom（Write-Only Atom）が一切ない

副作用を持つ処理（URL の revoke、ファイルのクリア等）は Write-Only atom に閉じ込めるべき。
現行例はコンポーネント内のイベントハンドラに副作用を直書きしている。

```javascript
// 現状 - コンポーネントに URL cleanup ロジックが漏れる
const { getRootProps } = useDropzone({
  onDrop: (acceptedFiles) => {
    setFiles(
      acceptedFiles.map((f) =>
        Object.assign(f, { preview: URL.createObjectURL(f) }),
      ),
    );
    // cleanup はどこかの useEffect で...（場所が散らばる）
  },
});

// あるべき姿 - Write atom に副作用を閉じ込める
const updateFilesAtom = atom(null, (get, set, newFiles) => {
  // 旧 URL を revoke してから新ファイルをセット（副作用がここに集約される）
  get(filesWithPreviewAtom).forEach((f) => URL.revokeObjectURL(f.preview));
  set(
    filesWithPreviewAtom,
    newFiles.map((f) => Object.assign(f, { preview: URL.createObjectURL(f) })),
  );
});
```

### 問題 3: `file-dialog` の関数-as-updater バグ

Jotai の setter に関数を渡すと「現在値からの更新関数」として扱われる。

```javascript
// バグ: setOpenDialog(() => open) は
// Jotai が (prev) => open として解釈し、結果として open が格納される。
// 動くが意図が不明瞭で、引数が増えたら壊れる。

// 正しい: 関数をオブジェクトで包んで setter 解釈を回避する
const openFileDialogAtom = atom(null); // atom<{ fn: () => void } | null>
setOpenDialog({ fn: open }); // オブジェクトはそのまま値として扱われる
openDialog?.fn(); // 呼び出し側
```

### 問題 4: `atomWithStorage` が一切使われていない

`maxFiles` や `accept` の MIME タイプなどユーザー設定は、
永続化するのが自然なユースケース。`atomWithStorage` で 1 行で解決できる。

### 問題 5: `splitAtom` が使われていない

ファイルリストから個別ファイルを削除・移動するケースに `splitAtom` が使えるが無視されている。

---

## 書き直しの設計原則

1. **Derived atom ファースト**: 計算できる状態は atom から派生させる
2. **副作用は Write atom に閉じ込める**: URL cleanup、localStorage 書き込み等
3. **`useAtomValue` / `useSetAtom` を積極活用**: `useAtom` は両方必要な時だけ
4. **`atomWithStorage` で設定値を永続化**: ユーザー設定系の atom
5. **`splitAtom` でリスト管理**: 個別アイテムの削除・並び替え

---

## 各ファイルの書き直し内容

### `basic/README.md`

**旧**: `filesAtom` に onDrop 結果を突っ込むだけ
**新**: 派生 atom + アクション atom を示す

```javascript
const filesAtom = atom([]);
// 派生 atom - 合成の基本
const hasFilesAtom = atom((get) => get(filesAtom).length > 0);
const totalSizeAtom = atom((get) =>
  get(filesAtom).reduce((sum, f) => sum + f.size, 0),
);
// アクション atom - ファイルクリア
const clearFilesAtom = atom(null, (_get, set) => set(filesAtom, []));
```

---

### `accept/README.md`

**旧**: `fileRejectionsAtom` に格納するだけ
**新**: 派生 atom でエラー有無を表現 + アクション atom でクリア

```javascript
const fileRejectionsAtom = atom([]);
const hasRejectionAtom = atom((get) => get(fileRejectionsAtom).length > 0);
const clearRejectionsAtom = atom(null, (_get, set) =>
  set(fileRejectionsAtom, []),
);
```

---

### `drag-overlay/README.md`

**旧**: `useEffect` で `isDragGlobal` を atom に同期（パターン自体は仕方ない）
**新**: 同じく `useEffect` だが、「外部ライブラリ状態を atom に橋渡しする唯一の正当パターン」として明示的に説明し、Write atom に橋渡しをカプセル化する

```javascript
const isDraggingGloballyAtom = atom(false);
// Write atom でカプセル化
const setDragStateAtom = atom(null, (_get, set, isDragging) => {
  set(isDraggingGloballyAtom, isDragging);
});
// useEffect は外部ライブラリ→Jotai の橋渡しとして唯一正当なパターン
useEffect(() => {
  setDragState(isDragGlobal);
}, [isDragGlobal]);
```

---

### `file-dialog/README.md`

**旧**: `setOpenDialog(() => open)` でバグの可能性
**新**: 関数をオブジェクトで包んで setter の曖昧さを排除

```javascript
// atom<{ fn: () => void } | null>
const openFileDialogAtom = atom(null);

useEffect(() => {
  setOpenDialog({ fn: open }); // オブジェクトで包む → setter 解釈されない
  return () => setOpenDialog(null);
}, [open, setOpenDialog]);

// 呼び出し側
const dialog = useAtomValue(openFileDialogAtom);
<button onClick={() => dialog?.fn()}>Upload</button>;
```

---

### `forms/README.md`

**旧**: `pendingFilesAtom` に格納するだけ
**新**: 派生 atom で送信可否を表現

```javascript
const pendingFilesAtom = atom([]);
const isSubmittableAtom = atom((get) => get(pendingFilesAtom).length > 0);

// 送信ボタンは derived atom で disabled を制御
function SubmitButton() {
  const isSubmittable = useAtomValue(isSubmittableAtom);
  return (
    <button type="submit" disabled={!isSubmittable}>
      送信
    </button>
  );
}
```

---

### `maxFiles/README.md`

**旧**: `atom(2)` で動的制御
**新**: `atomWithStorage` でページリロード後も設定が残る

```javascript
import { atomWithStorage } from "jotai/utils";

const maxFilesAtom = atomWithStorage("dropzone-max-files", 2);
// ページをリロードしても設定値が localStorage から復元される
```

---

### `previews/README.md`

**旧**: `useEffect` cleanup でメモリ解放（タイミングが散らばる）
**新**: Write atom に URL lifecycle を閉じ込める（最重要リライト）

```javascript
const filesWithPreviewAtom = atom([]); // 生の値を保持する base atom

// Write atom: 旧 URL の revoke と新ファイルのセットをアトミックに実行
const setPreviewFilesAtom = atom(null, (get, set, newFiles) => {
  get(filesWithPreviewAtom).forEach((f) => URL.revokeObjectURL(f.preview));
  set(
    filesWithPreviewAtom,
    newFiles.map((f) => Object.assign(f, { preview: URL.createObjectURL(f) })),
  );
});

// Dropzone は setPreviewFilesAtom だけ使う（cleanup 不要）
const setPreviewFiles = useSetAtom(setPreviewFilesAtom);
const { getRootProps, getInputProps } = useDropzone({
  onDrop: setPreviewFiles,
});
```

---

### `styling/README.md`

**旧**: `acceptedMimeTypesAtom` を atom で管理
**新**: `atomWithStorage` で MIME タイプ設定を永続化

```javascript
const acceptedMimeTypesAtom = atomWithStorage("dropzone-accepted-mime", {
  "image/*": [],
});
```

---

### `validator/README.md`

**旧**: `maxLengthAtom` + `useCallback` で validator を再生成
**新**: `atomWithStorage` で永続化 + 派生 atom でバリデーター関数を作る

```javascript
const maxLengthAtom = atomWithStorage('dropzone-validator-max-length', 20);

// 派生 atom でバリデーター関数を生成（useCallback 不要）
const validatorAtom = atom((get) => {
  const maxLength = get(maxLengthAtom);
  return (file) => {
    if (file.name.length > maxLength) {
      return { code: 'name-too-large', message: `Name is larger than ${maxLength} characters` };
    }
    return null;
  };
});

// コンポーネントではそのまま使う
const validator = useAtomValue(validatorAtom);
const { ... } = useDropzone({ validator });
```

---

### `events/README.md`

**旧**: 2 つの atom を手動管理するだけ
**新**: `atomFamily` で n 個の dropzone を柔軟に管理 + `splitAtom` で個別ファイル削除

```javascript
import { atom } from "jotai";
import { atomFamily, splitAtom } from "jotai/utils";

// 任意の ID を持つ dropzone のファイルリスト
const dropzoneFilesFamily = atomFamily((id) => atom([]));
const dropzoneFileAtomsFamily = atomFamily((id) =>
  splitAtom(dropzoneFilesFamily(id)),
);

function Dropzone({ id }) {
  const setFiles = useSetAtom(dropzoneFilesFamily(id));
  const [fileAtoms, dispatch] = useAtom(dropzoneFileAtomsFamily(id));
  const { getRootProps, getInputProps } = useDropzone({ onDrop: setFiles });

  return (
    <div {...getRootProps()}>
      <input {...getInputProps()} />
      {fileAtoms.map((fileAtom) => (
        <FileItem key={`${fileAtom}`} fileAtom={fileAtom} dispatch={dispatch} />
      ))}
    </div>
  );
}
```

---

### `plugins/README.md`

**旧**: `enrichedFilesAtom` に格納
**新**: Write atom でカスタムプロパティ付与と格納をカプセル化

```javascript
const enrichedFilesAtom = atom([]);
const enrichFilesAtom = atom(null, async (_get, set, event) => {
  const fileList = event.dataTransfer?.files ?? event.target.files;
  const files = [];
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList.item(i);
    Object.defineProperty(file, "myProp", { value: true });
    files.push(file);
  }
  set(enrichedFilesAtom, files);
});
```

---

### `pintura/README.md`

**旧**: `editableFilesAtom` を `useAtom` で読み書き
**新**: Write atom で画像編集後の URL lifecycle を管理

```javascript
const editableFilesAtom = atom([]);

// 編集後ファイルを更新するアクション atom
const updateEditedFileAtom = atom(null, (get, set, { index, dest }) => {
  const files = get(editableFilesAtom);
  URL.revokeObjectURL(files[index].preview); // 旧 URL を解放
  const updated = [...files];
  updated[index] = Object.assign(dest, {
    preview: URL.createObjectURL(dest),
  });
  set(editableFilesAtom, updated);
});
```

---

### `class-component/README.md`

**旧/新**: 変更なし（ラッパー関数コンポーネントパターンは正しい）
解説に「Jotai フックはクラスコンポーネントで使えないため薄いラッパーが必要」を明記。

---

### `no-jsx/README.md`

**旧**: basic と同じ
**新**: 派生 atom も JSX なしで同様に使えることを示す

```javascript
const filesAtom = atom([]);
const totalSizeAtom = atom((get) =>
  get(filesAtom).reduce((sum, f) => sum + f.size, 0),
);
```

---

## 対象ファイル一覧

| ファイル                    | 変更内容                                           |
| --------------------------- | -------------------------------------------------- |
| `basic/README.md`           | 派生 atom + アクション atom を追加                 |
| `accept/README.md`          | 派生 atom + clear アクション atom を追加           |
| `drag-overlay/README.md`    | Write atom でカプセル化、useEffect の正当性を説明  |
| `file-dialog/README.md`     | 関数をオブジェクトで包んでバグ修正                 |
| `forms/README.md`           | 派生 atom で送信可否を表現                         |
| `maxFiles/README.md`        | `atomWithStorage` で永続化                         |
| `previews/README.md`        | Write atom で URL lifecycle を閉じ込める（最重要） |
| `styling/README.md`         | `atomWithStorage` で永続化                         |
| `validator/README.md`       | `atomWithStorage` + 派生 atom でバリデーター生成   |
| `events/README.md`          | `atomFamily` + `splitAtom` で n 個の dropzone 管理 |
| `plugins/README.md`         | Write atom でカプセル化                            |
| `pintura/README.md`         | Write atom で URL lifecycle を管理                 |
| `class-component/README.md` | 変更なし（解説を加筆）                             |
| `no-jsx/README.md`          | 派生 atom を追加                                   |

---

## 検証方法

対象はドキュメントファイルのみ（`.md` ファイル）なのでコード実行は不要。
書き直し後に以下を確認する：

1. Jotai の derived atom パターンが各ファイルで正しく示されているか
2. Write atom（action atom）のシグネチャが正しいか（`atom(null, (get, set, payload) => ...)`)
3. `atomWithStorage` のインポート元が正しいか（`jotai/utils`）
4. `splitAtom` / `atomFamily` の使い方が正しいか（`jotai/utils`）
5. `file-dialog` の関数-in-atom パターンが正しく修正されているか
