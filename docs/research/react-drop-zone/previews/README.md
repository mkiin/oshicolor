# previews

`URL.createObjectURL` でドロップした画像のプレビューを表示する。
メモリリーク防止のため `URL.revokeObjectURL` での解放が必須。

## 基本的な使い方

```jsx
import { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";

function PreviewDropzone() {
  const [files, setFiles] = useState([]);

  const { getRootProps, getInputProps } = useDropzone({
    accept: { "image/*": [] },
    onDrop: (acceptedFiles) => {
      setFiles(
        acceptedFiles.map((file) => Object.assign(file, { preview: URL.createObjectURL(file) })),
      );
    },
  });

  const thumbs = files.map((file) => (
    <div key={file.name}>
      <img src={file.preview} alt={file.name} />
    </div>
  ));

  // アンマウント時・files 更新時に Object URL を解放
  useEffect(() => {
    return () => files.forEach((f) => URL.revokeObjectURL(f.preview));
  }, [files]);

  return (
    <section>
      <div {...getRootProps({ className: "dropzone" })}>
        <input {...getInputProps()} />
        <p>画像をドロップ</p>
      </div>
      <aside>{thumbs}</aside>
    </section>
  );
}
```

`URL.createObjectURL` の戻り値はメモリ上のブロブ参照なので、
`useEffect` の cleanup で必ず `revokeObjectURL` する。

## Jotai との組み合わせ

**パターン**: Write atom に URL lifecycle を閉じ込める（最重要リライト）

```jsx
import { atom, useAtomValue, useSetAtom } from "jotai";
import { useDropzone } from "react-dropzone";

// --- atom 定義 ---

// base atom: プレビュー付きファイルリストを保持する
// atom<Array<File & { preview: string }>>
const filesWithPreviewAtom = atom([]);

// Write atom: 旧 URL の revoke と新ファイルのセットをアトミックに実行する。
// URL lifecycle（create → revoke）の責任がこの atom に集約されるため、
// コンポーネントはいつ・どこで URL が解放されるかを知らなくてよい。
//
// 【なぜ useEffect cleanup より優れるか】
// - useEffect cleanup 版: "コンポーネントのアンマウント時に revoke する"
//   → コンポーネントのアンマウントタイミングと URL の使用終了タイミングが
//     一致しない場合（他コンポーネントがまだプレビューを表示中など）に
//     メモリリークや broken image になるリスクがある。
// - Write atom 版: "新しいファイルがセットされる瞬間に旧 URL を revoke する"
//   → 新旧の切り替えがアトミックに行われるため、タイミングの問題が発生しない。
const setPreviewFilesAtom = atom(null, (get, set, newFiles) => {
  // 旧プレビュー URL をすべて解放してからセット
  get(filesWithPreviewAtom).forEach((f) => URL.revokeObjectURL(f.preview));
  set(
    filesWithPreviewAtom,
    newFiles.map((f) => Object.assign(f, { preview: URL.createObjectURL(f) })),
  );
});

// アクション atom: 全ファイルクリア時も URL を解放する
const clearPreviewFilesAtom = atom(null, (get, set) => {
  get(filesWithPreviewAtom).forEach((f) => URL.revokeObjectURL(f.preview));
  set(filesWithPreviewAtom, []);
});

// --- コンポーネント ---

// Dropzone: setPreviewFilesAtom を呼ぶだけ。URL 管理は不要。
function PreviewDropzone() {
  const setPreviewFiles = useSetAtom(setPreviewFilesAtom);
  const { getRootProps, getInputProps } = useDropzone({
    accept: { "image/*": [] },
    // useEffect cleanup が不要。setPreviewFilesAtom 内で旧 URL を revoke している。
    onDrop: setPreviewFiles,
  });

  return (
    <div {...getRootProps({ className: "dropzone" })}>
      <input {...getInputProps()} />
      <p>画像をドロップ</p>
    </div>
  );
}

// 別コンポーネントでサムネイルグリッドを表示できる
function ThumbnailGrid() {
  const files = useAtomValue(filesWithPreviewAtom);
  const clearPreviewFiles = useSetAtom(clearPreviewFilesAtom);

  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {files.map((f) => (
          <img key={f.name} src={f.preview} alt={f.name} width={100} height={100} />
        ))}
      </div>
      {files.length > 0 && (
        <button type="button" onClick={clearPreviewFiles}>
          クリア
        </button>
      )}
    </>
  );
}
```

**解説**:

- **`setPreviewFilesAtom`** は Write-Only atom。`atom(null, (get, set, newFiles) => ...)` の形式で書く。`get` で現在の `filesWithPreviewAtom` の値を読み取り、旧 URL を revoke してから新しいファイルをセットする。この「読み取り → 副作用 → 書き込み」がアトミックに実行されるため、タイミングの問題が起きない。
- **`clearPreviewFilesAtom`** も同様に、クリア前に全 URL を revoke する責任を持つ。コンポーネントは `clearPreviewFiles()` を呼ぶだけでよく、URL の解放漏れが起きない。
- `useEffect` cleanup による revoke は「コンポーネントのライフサイクル」に URL 管理を依存させる設計。複数コンポーネントが同じ atom を参照する場合、どのコンポーネントがアンマウントされるかによって動作が変わり、設計が複雑になる。Write atom に集約することで、URL の lifecycle が「ファイルが差し替えられたとき」という明確なイベントに紐づく。
