# plugins

`getFilesFromEvent` をカスタマイズして、ドロップ時に File オブジェクトにカスタムプロパティを付与する。

## 基本的な使い方

```jsx
import { useDropzone } from "react-dropzone";

async function customGetFilesFromEvent(event) {
  const fileList = event.dataTransfer?.files ?? event.target.files;
  const files = [];
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList.item(i);
    // カスタムプロパティを付与
    Object.defineProperty(file, "myProp", {
      value: true,
      writable: false,
    });
    files.push(file);
  }
  return files;
}

function PluginDropzone() {
  const { acceptedFiles, getRootProps, getInputProps } = useDropzone({
    getFilesFromEvent: customGetFilesFromEvent,
  });

  return (
    <section>
      <div {...getRootProps({ className: "dropzone" })}>
        <input {...getInputProps()} />
        <p>ファイルをドロップ</p>
      </div>
      <aside>
        <ul>
          {acceptedFiles.map((f) => (
            <li key={f.name}>
              {f.name}: myProp={String(f.myProp)}
            </li>
          ))}
        </ul>
      </aside>
    </section>
  );
}
```

`getFilesFromEvent` は `File[]` または `Promise<File[]>` を返す非同期関数。
`Object.defineProperty` で read-only のカスタムプロパティを付与できる。

## Jotai との組み合わせ

**パターン**: Write atom でカスタムプロパティ付与と格納をカプセル化する

```jsx
import { atom, useAtomValue, useSetAtom } from "jotai";
import { useDropzone } from "react-dropzone";

// --- atom 定義 ---

// atom<Array<File & { myProp: boolean }>>
const enrichedFilesAtom = atom([]);

// Write atom: カスタムプロパティの付与と atom への格納を一箇所にまとめる。
// コンポーネントに「どのようにファイルを enrichment するか」のロジックを持たせない。
// async Write atom は (get, set, payload) => Promise<void> として書ける。
const enrichFilesAtom = atom(null, async (_get, set, event) => {
  const fileList = event.dataTransfer?.files ?? event.target.files;
  if (!fileList) return;

  const files = [];
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList.item(i);
    Object.defineProperty(file, "myProp", { value: true });
    files.push(file);
  }
  set(enrichedFilesAtom, files);
});

// 派生 atom: カスタムプロパティが付いたファイルの件数
const enrichedFileCountAtom = atom((get) => get(enrichedFilesAtom).length);

// --- コンポーネント ---

function PluginDropzone() {
  const setEnrichedFiles = useSetAtom(enrichedFilesAtom);
  const enrichFiles = useSetAtom(enrichFilesAtom);

  const { getRootProps, getInputProps } = useDropzone({
    // getFilesFromEvent でカスタムプロパティを付与した上で onDrop に渡す
    getFilesFromEvent: async (event) => {
      const fileList = event.dataTransfer?.files ?? event.target.files;
      if (!fileList) return [];
      const files = [];
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList.item(i);
        Object.defineProperty(file, "myProp", { value: true });
        files.push(file);
      }
      return files;
    },
    onDrop: (enrichedFiles) => setEnrichedFiles(enrichedFiles),
  });

  return (
    <div {...getRootProps({ className: "dropzone" })}>
      <input {...getInputProps()} />
      <p>ファイルをドロップ</p>
    </div>
  );
}

// カスタムプロパティを参照する別コンポーネント
function EnrichedFileList() {
  const files = useAtomValue(enrichedFilesAtom);
  return (
    <ul>
      {files.map((f) => (
        <li key={f.name}>
          {f.name}: myProp={String(f.myProp)}
        </li>
      ))}
    </ul>
  );
}

// 件数だけ知りたいコンポーネントは派生 atom で
function EnrichedFileCount() {
  const count = useAtomValue(enrichedFileCountAtom);
  return <p>{count} ファイル処理済み</p>;
}
```

**解説**:

- **`enrichFilesAtom`** は async Write-Only atom。`atom(null, async (_get, set, event) => { ... })` の形式で書く。非同期処理（ファイルリストの反復）も Write atom 内に閉じ込められる。ただし今回は `getFilesFromEvent` + `onDrop` の組み合わせのほうが react-dropzone の設計に沿っているため、上記例では `getFilesFromEvent` パターンを示している。
- **`enrichedFileCountAtom`** のような派生 atom を用意しておくことで、件数だけ知りたいコンポーネントがリスト全体を購読せずに済む。`enrichedFilesAtom` が更新されると `enrichedFileCountAtom` も自動更新される。
- TypeScript を使う場合は `atom<Array<File & { myProp: boolean }>>([])` と型を明示することでカスタムプロパティへの型安全なアクセスが可能になる。
