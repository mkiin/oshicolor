# maxFiles

`maxFiles` オプションで受け入れるファイル数の上限を設定する。

## 基本的な使い方

```jsx
import { useDropzone } from 'react-dropzone';

function MaxFilesDropzone() {
  const { acceptedFiles, fileRejections, getRootProps, getInputProps } = useDropzone({
    maxFiles: 2,
  });

  const acceptedItems = acceptedFiles.map(file => (
    <li key={file.path}>{file.path}</li>
  ));

  const rejectedItems = fileRejections.map(({ file, errors }) => (
    <li key={file.path}>
      {file.path}
      <ul>{errors.map(e => <li key={e.code}>{e.message}</li>)}</ul>
    </li>
  ));

  return (
    <section>
      <div {...getRootProps({ className: 'dropzone' })}>
        <input {...getInputProps()} />
        <p>最大 2 ファイルまで受け付けます</p>
      </div>
      <aside>
        <h4>Accepted ({acceptedFiles.length})</h4>
        <ul>{acceptedItems}</ul>
        <h4>Rejected</h4>
        <ul>{rejectedItems}</ul>
      </aside>
    </section>
  );
}
```

`maxFiles: 2` を超えたファイルは `fileRejections` に `too-many-files` エラーコードで格納される。

## Jotai との組み合わせ

**パターン**: `atomWithStorage` でページリロード後も設定が永続化される

```jsx
import { useAtom, useAtomValue } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { useDropzone } from 'react-dropzone';

// --- atom 定義 ---

// atomWithStorage: localStorage の 'dropzone-max-files' キーに値を永続化する
// ページをリロードしても設定値が localStorage から自動復元される
// 通常の atom(2) と異なり、ユーザーが変更した設定が次回も維持される
const maxFilesAtom = atomWithStorage('dropzone-max-files', 2);

// --- コンポーネント ---

function DynamicMaxFilesDropzone() {
  const maxFiles = useAtomValue(maxFilesAtom);
  const { getRootProps, getInputProps, acceptedFiles, fileRejections } = useDropzone({
    maxFiles,
  });

  return (
    <section>
      <div {...getRootProps({ className: 'dropzone' })}>
        <input {...getInputProps()} />
        <p>最大 {maxFiles} ファイルまで受け付けます</p>
      </div>
      <aside>
        <h4>Accepted ({acceptedFiles.length})</h4>
        <ul>{acceptedFiles.map((f) => <li key={f.name}>{f.name}</li>)}</ul>
        <h4>Rejected</h4>
        <ul>{fileRejections.map(({ file }) => <li key={file.name}>{file.name}</li>)}</ul>
      </aside>
    </section>
  );
}

// 設定パネルなど別の場所から上限を変更できる
// 変更した値は localStorage に自動保存され、リロード後も維持される
function MaxFilesControl() {
  const [maxFiles, setMaxFiles] = useAtom(maxFilesAtom);
  return (
    <label>
      最大ファイル数:
      <input
        type="number"
        min={1}
        value={maxFiles}
        onChange={(e) => setMaxFiles(Number(e.target.value))}
      />
    </label>
  );
}
```

**解説**:

- **`atomWithStorage`** は `jotai/utils` からインポートする。第 1 引数が localStorage のキー名、第 2 引数がデフォルト値。`atom(2)` と使い方はほぼ同じだが、値の変更が localStorage に自動保存され、ページリロード後に自動復元される。
- `maxFiles` のようなユーザー設定値は永続化するのが自然なユースケース。`atomWithStorage` で 1 行で実現できる。
- `useDropzone` は `maxFiles` の変化を自動で反映するため、再マウントなしに制限を切り替えられる。
