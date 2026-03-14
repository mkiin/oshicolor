# file-dialog

`noClick` + `noKeyboard` と `open()` を使い、プログラムからファイルダイアログを開く。

## 基本的な使い方

```jsx
import { useDropzone } from "react-dropzone";

function Dropzone() {
    const { acceptedFiles, getRootProps, getInputProps, open } = useDropzone({
        noClick: true,
        noKeyboard: true,
    });

    const files = acceptedFiles.map((file) => (
        <li key={file.path}>{file.path}</li>
    ));

    return (
        <div className="container">
            <div {...getRootProps({ className: "dropzone" })}>
                <input {...getInputProps()} />
                <p>ここにドロップ（クリック無効）</p>
                <button type="button" onClick={open}>
                    ファイルを開く
                </button>
            </div>
            <aside>
                <h4>Files</h4>
                <ul>{files}</ul>
            </aside>
        </div>
    );
}
```

`open()` は `noClick: true` と組み合わせてプログラムからダイアログを起動する。
ボタンを Dropzone の内側に置く場合は atom は不要。

## Jotai との組み合わせ

**パターン**: `open()` 関数をオブジェクトで包んで atom に格納し、Dropzone 外のボタンからダイアログを開く

```jsx
import { useEffect } from "react";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { useDropzone } from "react-dropzone";

// atom<{ fn: () => void } | null>
//
// 【重要】関数を atom の setter に直接渡してはいけない。
// Jotai の setter は「関数を受け取ると、それを (prevValue) => newValue として解釈する」仕様がある。
// つまり `setOpenDialog(() => open)` は Jotai が `open` を返す更新関数として扱い、
// 結果として `open()` の戻り値（undefined）が atom の値になる。
//
// 解決策: 関数をオブジェクトで包む。オブジェクトは更新関数として解釈されないため、
// `setOpenDialog({ fn: open })` は `{ fn: open }` をそのまま atom の値として格納する。
const openFileDialogAtom = atom(null);

// --- コンポーネント ---

function Dropzone() {
    const setOpenDialog = useSetAtom(openFileDialogAtom);
    const { getRootProps, getInputProps, open } = useDropzone({
        noClick: true,
        noKeyboard: true,
    });

    useEffect(() => {
        // オブジェクトで包むことで Jotai の「関数 = 更新関数」解釈を回避する
        setOpenDialog({ fn: open });
        return () => setOpenDialog(null);
    }, [open, setOpenDialog]);

    return (
        <div {...getRootProps({ className: "dropzone" })}>
            <input {...getInputProps()} />
            <p>ここにドロップ</p>
        </div>
    );
}

// ナビゲーションバーや別の UI 部品からダイアログを開ける
function UploadButton() {
    const dialog = useAtomValue(openFileDialogAtom);
    return (
        <button
            type="button"
            // dialog?.fn() でオブジェクトから関数を取り出して呼ぶ
            onClick={() => dialog?.fn()}
            disabled={!dialog}
        >
            Upload
        </button>
    );
}
```

**解説**:

- **関数-as-updater バグ**: Jotai の `set(atom, value)` は `value` が関数の場合、`(prevValue) => newValue` という更新関数として解釈する。`setOpenDialog(() => open)` と書くと、Jotai は `() => open` を更新関数とみなし `open()` の戻り値を atom の値にセットしようとする。今回 `open()` は `undefined` を返すため、atom に `undefined` が入り、ダイアログが開かなくなる。
- **修正**: `{ fn: open }` のようにオブジェクトで包む。プレーンオブジェクトは更新関数として解釈されず、値としてそのまま atom に格納される。呼び出し側は `dialog?.fn()` でオブジェクトから関数を取り出して実行する。
- `open()` はセキュリティ上ユーザー操作の直後に呼ぶ必要がある。atom を介することでナビゲーションバーやフローティングアクションボタンなど、Dropzone の DOM ツリー外に自由に配置できる。
