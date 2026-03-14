# styling

`isFocused` / `isDragAccept` / `isDragReject` を使ってドラッグ状態に応じたスタイルを適用する。

## 基本的な使い方

```jsx
import { useMemo } from "react";
import { useDropzone } from "react-dropzone";

const baseStyle = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "20px",
  borderWidth: 2,
  borderRadius: 2,
  borderColor: "#eeeeee",
  borderStyle: "dashed",
  backgroundColor: "#fafafa",
  color: "#bdbdbd",
  outline: "none",
  transition: "border .24s ease-in-out",
};

const focusedStyle = { borderColor: "#2196f3" };
const acceptStyle = { borderColor: "#00e676" };
const rejectStyle = { borderColor: "#ff1744" };

function StyledDropzone() {
  const { getRootProps, getInputProps, isFocused, isDragAccept, isDragReject } = useDropzone({
    accept: { "image/*": [] },
  });

  const style = useMemo(
    () => ({
      ...baseStyle,
      ...(isFocused ? focusedStyle : {}),
      ...(isDragAccept ? acceptStyle : {}),
      ...(isDragReject ? rejectStyle : {}),
    }),
    [isFocused, isDragAccept, isDragReject],
  );

  return (
    <div className="container">
      <div {...getRootProps({ style })}>
        <input {...getInputProps()} />
        <p>ここに画像をドロップ</p>
      </div>
    </div>
  );
}
```

`isFocused` / `isDragAccept` / `isDragReject` は `useDropzone` が管理するローカル UI 状態。
これらはドラッグ中のリアルタイムな見た目の変化に使うため、Jotai に入れる必要はない。

## Jotai との組み合わせ

**パターン**: `atomWithStorage` で受け入れ MIME タイプ設定を永続化する（UI 状態は Jotai 不要）

```jsx
import { useMemo } from "react";
import { useAtom, useAtomValue } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useDropzone } from "react-dropzone";

// isFocused / isDragAccept / isDragReject は useDropzone のローカル値で十分。
// Jotai が有効なのは「どのファイル種別を受け付けるか」という設定値を
// 外から変えたい場合、かつリロード後も設定を維持したい場合。

// atomWithStorage: localStorage に保存されるため、ページリロード後も設定が復元される
const acceptedMimeTypesAtom = atomWithStorage("dropzone-accepted-mime", { "image/*": [] });

// --- コンポーネント ---

function DynamicStyledDropzone() {
  const accept = useAtomValue(acceptedMimeTypesAtom);
  const { getRootProps, getInputProps, isFocused, isDragAccept, isDragReject } = useDropzone({
    accept,
  });

  const style = useMemo(
    () => ({
      ...baseStyle,
      ...(isFocused ? focusedStyle : {}),
      ...(isDragAccept ? acceptStyle : {}),
      ...(isDragReject ? rejectStyle : {}),
    }),
    [isFocused, isDragAccept, isDragReject],
  );

  return (
    <div {...getRootProps({ style })}>
      <input {...getInputProps()} />
      <p>ここにドロップ</p>
    </div>
  );
}

// 設定パネルから受け入れ種別を変更できる
// 変更は localStorage に自動保存され、リロード後も維持される
function AcceptControl() {
  const [accept, setAccept] = useAtom(acceptedMimeTypesAtom);
  return (
    <div>
      <button type="button" onClick={() => setAccept({ "image/*": [] })}>
        画像のみ
      </button>
      <button type="button" onClick={() => setAccept({ "image/*": [], "application/pdf": [] })}>
        画像 + PDF
      </button>
    </div>
  );
}
```

**解説**:

- **ドラッグ中の見た目**（`isFocused` / `isDragAccept` / `isDragReject`）は `useDropzone` が管理するローカル UI 状態なので atom に入れる必要はない。これらの値は Jotai で管理しても `useMemo` の依存配列は変わらないため、何も嬉しくない。
- **`atomWithStorage`** が活きるのは「受け入れるファイル種別」のような**設定値**。ユーザーが「画像 + PDF」を選んだらそれをリロード後も覚えておくべき、というユースケースに自然に対応できる。`atom({ 'image/*': [] })` を `atomWithStorage('...', { 'image/*': [] })` に変えるだけで永続化が完成する。
