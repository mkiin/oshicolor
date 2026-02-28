# pintura

Pintura Image Editor と react-dropzone を組み合わせて、ドロップした画像をインライン編集する。

## 基本的な使い方

```jsx
import { useState } from 'react';
import { openEditor } from 'pintura';
import { useDropzone } from 'react-dropzone';

function PinturaDropzone() {
  const [files, setFiles] = useState([]);

  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'image/*': [] },
    onDrop: acceptedFiles => {
      setFiles(acceptedFiles.map(f =>
        Object.assign(f, { preview: URL.createObjectURL(f) })
      ));
    },
  });

  const handleEdit = (index) => {
    const file = files[index];
    openEditor({ src: file }).then(({ dest }) => {
      const updated = [...files];
      URL.revokeObjectURL(file.preview);
      updated[index] = Object.assign(dest, { preview: URL.createObjectURL(dest) });
      setFiles(updated);
    });
  };

  return (
    <section>
      <div {...getRootProps({ className: 'dropzone' })}>
        <input {...getInputProps()} />
        <p>画像をドロップ</p>
      </div>
      <aside>
        {files.map((f, i) => (
          <div key={f.name}>
            <img src={f.preview} alt={f.name} />
            <button onClick={() => handleEdit(i)}>編集</button>
          </div>
        ))}
      </aside>
    </section>
  );
}
```

Pintura の `openEditor` は Promise を返し、編集後の File を `dest` として返す。
編集前の Object URL は `revokeObjectURL` で解放し、新しい URL を発行し直す。

## Jotai との組み合わせ

**パターン**: Write atom で URL lifecycle を管理し、編集ロジックをカプセル化する

```jsx
import { atom, useAtomValue, useSetAtom } from 'jotai';
import { openEditor } from 'pintura';
import { useDropzone } from 'react-dropzone';

// --- atom 定義 ---

// atom<Array<File & { preview: string }>>
const editableFilesAtom = atom([]);

// Write atom: ドロップ時のプレビュー URL 生成をカプセル化する
// previews の例と同様のパターン
const setEditableFilesAtom = atom(null, (get, set, newFiles) => {
  // 旧プレビュー URL を解放してから新しいファイルをセット
  get(editableFilesAtom).forEach((f) => URL.revokeObjectURL(f.preview));
  set(
    editableFilesAtom,
    newFiles.map((f) => Object.assign(f, { preview: URL.createObjectURL(f) }))
  );
});

// Write atom: 編集後のファイル更新と URL の差し替えをカプセル化する。
// index と dest を受け取り、旧 URL の revoke と新 URL の発行をアトミックに実行する。
// コンポーネントに URL lifecycle の管理責任を持たせない。
const updateEditedFileAtom = atom(null, (get, set, { index, dest }) => {
  const files = get(editableFilesAtom);
  // 旧プレビュー URL を解放
  URL.revokeObjectURL(files[index].preview);
  const updated = [...files];
  // 編集後ファイルに新しいプレビュー URL を付与して差し替え
  updated[index] = Object.assign(dest, { preview: URL.createObjectURL(dest) });
  set(editableFilesAtom, updated);
});

// --- コンポーネント ---

// Dropzone: ファイルの受け取りのみを担当
function PinturaDropzone() {
  const setEditableFiles = useSetAtom(setEditableFilesAtom);

  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'image/*': [] },
    onDrop: setEditableFiles,
  });

  return (
    <div {...getRootProps({ className: 'dropzone' })}>
      <input {...getInputProps()} />
      <p>画像をドロップ</p>
    </div>
  );
}

// サムネイルグリッド: 表示と編集トリガーのみを担当
// URL の revoke/create は updateEditedFileAtom が行うため、このコンポーネントは知らなくてよい
function EditableThumbnailGrid() {
  const files = useAtomValue(editableFilesAtom);
  const updateEditedFile = useSetAtom(updateEditedFileAtom);

  const handleEdit = (index) => {
    const file = files[index];
    openEditor({ src: file }).then(({ dest }) => {
      // URL lifecycle の管理は updateEditedFileAtom に委ねる
      updateEditedFile({ index, dest });
    });
  };

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {files.map((f, i) => (
        <div key={f.name}>
          <img src={f.preview} alt={f.name} width={100} height={100} />
          <button type="button" onClick={() => handleEdit(i)}>
            編集
          </button>
        </div>
      ))}
    </div>
  );
}
```

**解説**:

- **`setEditableFilesAtom`** は Write-Only atom。ドロップ時の「旧 URL revoke → 新 URL 付与 → atom セット」をアトミックに実行する。`previews` の `setPreviewFilesAtom` と同じパターン。
- **`updateEditedFileAtom`** は Write-Only atom。`{ index, dest }` をペイロードとして受け取り、特定インデックスのファイルを更新する。旧 URL の解放と新 URL の発行を一箇所に集約することで、`EditableThumbnailGrid` コンポーネントが URL lifecycle を意識しなくてよくなる。
- **分離の恩恵**: `PinturaDropzone`（ファイル受け取り）と `EditableThumbnailGrid`（表示・編集）が atom を介して分離されているため、DOM ツリー上の任意の場所に配置できる。編集 UI をモーダルやサイドパネルに置くといった構成に対応しやすい。
