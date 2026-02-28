# accept

`accept` オプションで受け入れるファイル種別を制限する。
制限に引っかかったファイルは `fileRejections` に格納される。

## 基本的な使い方

```jsx
import { useDropzone } from 'react-dropzone';

function AcceptDropzone() {
  const { acceptedFiles, fileRejections, getRootProps, getInputProps } = useDropzone({
    accept: {
      'image/jpeg': [],
      'image/png': []
    }
  });

  const acceptedItems = acceptedFiles.map(file => (
    <li key={file.path}>{file.path} - {file.size} bytes</li>
  ));

  const rejectedItems = fileRejections.map(({ file, errors }) => (
    <li key={file.path}>
      {file.path} - {file.size} bytes
      <ul>
        {errors.map(e => <li key={e.code}>{e.message}</li>)}
      </ul>
    </li>
  ));

  return (
    <section>
      <div {...getRootProps({ className: 'dropzone' })}>
        <input {...getInputProps()} />
        <p>JPEG/PNG のみ受け付けます</p>
      </div>
      <aside>
        <h4>Accepted</h4>
        <ul>{acceptedItems}</ul>
        <h4>Rejected</h4>
        <ul>{rejectedItems}</ul>
      </aside>
    </section>
  );
}
```

`fileRejections` は `{ file: File, errors: FileError[] }[]` の形式。
`isDragAccept` / `isDragReject` を使うとドラッグ中にスタイルを変化させられる。

## Jotai との組み合わせ

**パターン**: 派生 atom でエラー有無を表現 + アクション atom でクリア

```jsx
import { atom, useAtomValue, useSetAtom } from 'jotai';
import { useDropzone } from 'react-dropzone';

// --- atom 定義 ---

const fileRejectionsAtom = atom([]);

// 派生 atom: エラーがあるかどうかを atom から計算する
// コンポーネント内で `rejections.length > 0` と書かない
const hasRejectionAtom = atom((get) => get(fileRejectionsAtom).length > 0);
const rejectionCountAtom = atom((get) => get(fileRejectionsAtom).length);

// アクション atom: エラーリストのクリアをカプセル化する
const clearRejectionsAtom = atom(null, (_get, set) =>
  set(fileRejectionsAtom, [])
);

// --- コンポーネント ---

function AcceptDropzone() {
  const setRejections = useSetAtom(fileRejectionsAtom);
  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'image/*': [] },
    onDropRejected: (rejections) => setRejections(rejections),
  });

  return (
    <div {...getRootProps({ className: 'dropzone' })}>
      <input {...getInputProps()} />
      <p>画像ファイルのみ受け付けます</p>
    </div>
  );
}

// ページ上部のエラーバナーなど、Dropzone と離れた場所に表示できる
// hasRejectionAtom のおかげでコンポーネント内に条件判定ロジックが不要
function ErrorBanner() {
  const hasRejection = useAtomValue(hasRejectionAtom);
  const rejections = useAtomValue(fileRejectionsAtom);
  const clearRejections = useSetAtom(clearRejectionsAtom);

  if (!hasRejection) return null;

  return (
    <div className="error-banner">
      {rejections.map((r) => (
        <p key={r.file.name}>{r.errors[0].message}</p>
      ))}
      <button type="button" onClick={clearRejections}>
        閉じる
      </button>
    </div>
  );
}

// 件数バッジなど小さな UI にも派生 atom が使える
function RejectionBadge() {
  const count = useAtomValue(rejectionCountAtom);
  if (count === 0) return null;
  return <span className="badge">{count}</span>;
}
```

**解説**:

- **`hasRejectionAtom`** は `fileRejectionsAtom` から派生した読み取り専用 atom。`ErrorBanner` は「エラーがあるかどうか」を知りたいだけで、リスト全体を購読する必要はない（ただし今回は表示もするので両方使っている）。
- **`clearRejectionsAtom`** は Write-Only atom。クリアロジックが atom に集約されているので、何箇所からでも同じ操作を呼び出せる。
- `isDragAccept` / `isDragReject` はドラッグ中のリアルタイムな見た目の変化に使うため Jotai 不要。`useDropzone` のローカル状態に留める。
