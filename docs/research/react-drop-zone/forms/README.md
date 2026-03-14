# forms

通常の HTML フォームと組み合わせる。hidden の `<input type="file">` に `DataTransfer` でファイルをセットしてフォーム送信に乗せる。

## 基本的な使い方

```jsx
import { useRef } from "react";
import { useDropzone } from "react-dropzone";

function FormDropzone({ name }) {
  const hiddenInputRef = useRef(null);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (incomingFiles) => {
      // DataTransfer 経由で hidden input にセット（フォーム送信用）
      if (hiddenInputRef.current) {
        const dt = new DataTransfer();
        incomingFiles.forEach((f) => dt.items.add(f));
        hiddenInputRef.current.files = dt.files;
      }
    },
  });

  return (
    <form method="post" encType="multipart/form-data">
      <div {...getRootProps({ className: "dropzone" })}>
        <input {...getInputProps()} />
        <p>ファイルをドロップ</p>
      </div>
      {/* フォーム送信に使う hidden input */}
      <input type="file" name={name} ref={hiddenInputRef} style={{ display: "none" }} />
      <button type="submit">送信</button>
    </form>
  );
}
```

フォーム送信の仕組みは DataTransfer + hidden input で維持する。

## Jotai との組み合わせ

**パターン**: 派生 atom で送信可否を表現し、Dropzone とフォーム送信処理を分離する

```jsx
import { useRef } from "react";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { useDropzone } from "react-dropzone";

// --- atom 定義 ---

const pendingFilesAtom = atom([]);

// 派生 atom: 送信可否を atom から計算する
// SubmitButton は「ファイルが何件あるか」ではなく「送信できるか」だけを知ればよい
const isSubmittableAtom = atom((get) => get(pendingFilesAtom).length > 0);

// アクション atom: 送信後のクリアをカプセル化する
const clearPendingFilesAtom = atom(null, (_get, set) => set(pendingFilesAtom, []));

// --- コンポーネント ---

function FormDropzone({ name }) {
  const setPendingFiles = useSetAtom(pendingFilesAtom);
  const hiddenInputRef = useRef(null);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (incomingFiles) => {
      // hidden input に DataTransfer でセット（フォーム送信用）
      if (hiddenInputRef.current) {
        const dt = new DataTransfer();
        incomingFiles.forEach((f) => dt.items.add(f));
        hiddenInputRef.current.files = dt.files;
      }
      // 確認表示用に atom にもセット
      setPendingFiles(incomingFiles);
    },
  });

  return (
    <>
      <div {...getRootProps({ className: "dropzone" })}>
        <input {...getInputProps()} />
        <p>ファイルをドロップ</p>
      </div>
      <input type="file" name={name} ref={hiddenInputRef} style={{ display: "none" }} />
    </>
  );
}

// フォームの別の場所でファイル確認プレビューを出せる
function PendingFilesPreview() {
  const files = useAtomValue(pendingFilesAtom);
  if (files.length === 0) return null;
  return (
    <ul>
      {files.map((f) => (
        <li key={f.name}>
          {f.name} ({f.size} bytes)
        </li>
      ))}
    </ul>
  );
}

// 派生 atom により、このコンポーネントは pendingFilesAtom の中身を知らなくてよい
// ファイルが 0 件の場合に disabled になるロジックがコンポーネントに入らない
function SubmitButton() {
  const isSubmittable = useAtomValue(isSubmittableAtom);
  const clearPendingFiles = useSetAtom(clearPendingFilesAtom);

  const handleSubmit = () => {
    // フォーム送信処理...
    clearPendingFiles(); // 送信後に atom をクリア
  };

  return (
    <button type="button" disabled={!isSubmittable} onClick={handleSubmit}>
      送信
    </button>
  );
}
```

**解説**:

- **`isSubmittableAtom`** は `pendingFilesAtom` から派生した読み取り専用 atom。`SubmitButton` は `pendingFilesAtom` を直接参照せず、「送信できるか」という意味レベルの情報だけを受け取る。ファイル数の判定ロジックがコンポーネントに漏れない。
- **`clearPendingFilesAtom`** は Write-Only atom。送信後のクリア処理がどこに書かれているかを呼び出し元が知る必要がない。
- フォーム送信の仕組み（DataTransfer + hidden input）はそのまま維持しながら、確認 UI 用の状態を atom に持つことでコンポーネントを分離できる。
