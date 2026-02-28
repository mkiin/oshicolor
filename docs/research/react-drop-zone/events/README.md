# events

ドロップゾーンを入れ子にする場合のイベント伝播の制御。
`noDragEventsBubbling` で内側の drop が外側に伝播しないようにできる。

## 基本的な使い方

```jsx
import { useState } from 'react';
import { useDropzone } from 'react-dropzone';

function OuterDropzone() {
  const [outerFiles, setOuterFiles] = useState([]);
  const [innerFiles, setInnerFiles] = useState([]);

  const { getRootProps: outerRootProps, getInputProps: outerInputProps } = useDropzone({
    onDrop: files => setOuterFiles(files),
  });

  const { getRootProps: innerRootProps, getInputProps: innerInputProps } = useDropzone({
    noDragEventsBubbling: true, // outer の onDrop を発火させない
    onDrop: files => setInnerFiles(files),
  });

  return (
    <div {...outerRootProps({ className: 'dropzone outer' })}>
      <input {...outerInputProps()} />
      <p>Outer dropzone</p>
      <div {...innerRootProps({ className: 'dropzone inner' })}>
        <input {...innerInputProps()} />
        <p>Inner dropzone</p>
      </div>
    </div>
  );
}
```

`noDragEventsBubbling: true` を内側の Dropzone に指定すると、
内側へのドロップが外側の `onDrop` を呼ばない。

## Jotai との組み合わせ

**パターン**: `atomFamily` + `splitAtom` で n 個の Dropzone を動的に管理する

固定の 2 個ではなく、ID ベースで任意の数の Dropzone を管理できる設計。

```jsx
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { atomFamily, splitAtom } from 'jotai/utils';
import { useDropzone } from 'react-dropzone';

// --- atom 定義 ---

// atomFamily: ID ごとに独立したファイルリスト atom を生成するファクトリ
// atomFamily(id => atom([])) で、'outer' や 'inner' などの ID を渡すと
// それぞれの ID に対応する atom が返る。同じ ID では常に同じ atom が返る。
const dropzoneFilesFamily = atomFamily((id) => atom([]));

// splitAtom: ファイルリスト atom を個別ファイルの atom の配列に分解する
// これにより個別ファイルの削除が O(1) で行え、削除されたファイルだけが再レンダリングされる
const dropzoneFileAtomsFamily = atomFamily((id) =>
  splitAtom(dropzoneFilesFamily(id))
);

// --- コンポーネント ---

// id prop で任意の Dropzone を独立して管理できる
function Dropzone({ id, label, noBubble = false }) {
  const setFiles = useSetAtom(dropzoneFilesFamily(id));
  const [fileAtoms, dispatch] = useAtom(dropzoneFileAtomsFamily(id));

  const { getRootProps, getInputProps } = useDropzone({
    noDragEventsBubbling: noBubble,
    onDrop: setFiles,
  });

  return (
    <div {...getRootProps({ className: `dropzone ${id}` })}>
      <input {...getInputProps()} />
      <p>{label}</p>
      <ul>
        {fileAtoms.map((fileAtom) => (
          <FileItem key={`${fileAtom}`} fileAtom={fileAtom} dispatch={dispatch} />
        ))}
      </ul>
    </div>
  );
}

// 個別ファイルコンポーネント: fileAtom のみを購読するため、
// 他のファイルが削除されてもこのコンポーネントは再レンダリングされない
function FileItem({ fileAtom, dispatch }) {
  const file = useAtomValue(fileAtom);
  return (
    <li>
      {file.name}
      {/* splitAtom の dispatch を使って特定のファイルだけを削除 */}
      <button
        type="button"
        onClick={() => dispatch({ type: 'remove', atom: fileAtom })}
      >
        ×
      </button>
    </li>
  );
}

// --- 配置例 ---

function NestedDropzones() {
  return (
    <Dropzone id="outer" label="Outer dropzone">
      <Dropzone id="inner" label="Inner dropzone" noBubble />
    </Dropzone>
  );
}

// 任意の場所でファイル状況を集計できる
function DropzoneSummary() {
  const outerFiles = useAtomValue(dropzoneFilesFamily('outer'));
  const innerFiles = useAtomValue(dropzoneFilesFamily('inner'));

  return (
    <div>
      <p>外側: {outerFiles.length} ファイル</p>
      <p>内側: {innerFiles.length} ファイル</p>
    </div>
  );
}
```

**解説**:

- **`atomFamily`** は `jotai/utils` からインポートする。`atomFamily(id => atom([]))` は ID をキーとして atom を生成するファクトリ。同じ ID を渡すと常に同じ atom が返るため、複数コンポーネントが同じ ID で `dropzoneFilesFamily('outer')` を呼んでも同一の atom を参照する。
- **`splitAtom`** は `jotai/utils` からインポートする。リスト atom（`atom([])` のような配列の atom）を受け取り、各要素を個別の atom として返す。`useAtom(splitAtom(listAtom))` が返す `dispatch` で要素の追加・削除・並び替えができる。個別要素の atom を削除するには `dispatch({ type: 'remove', atom: targetAtom })` を使う。
- **`FileItem`** は自分の `fileAtom` しか購読しないため、他のファイルが削除されても再レンダリングされない。大量のファイルがある場合にパフォーマンスが重要な場面で効果が出る。
- `atomFamily` で生成された atom はメモリに残り続けるため、Dropzone が動的に追加・削除される場合は `atomFamily.remove(id)` でクリーンアップを行う。
