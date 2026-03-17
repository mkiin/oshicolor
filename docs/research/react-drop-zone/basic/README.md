# basic

最もシンプルな react-dropzone の使い方。`useDropzone` フックを使い、ファイルをドロップして `acceptedFiles` に格納する。

## 基本的な使い方

```jsx
import { useDropzone } from "react-dropzone";

function BasicDropzone() {
    const { acceptedFiles, getRootProps, getInputProps } = useDropzone();

    const files = acceptedFiles.map((file) => (
        <li key={file.path}>
            {file.path} - {file.size} bytes
        </li>
    ));

    return (
        <section className="container">
            <div {...getRootProps({ className: "dropzone" })}>
                <input {...getInputProps()} />
                <p>
                    ここにファイルをドラッグ＆ドロップ、またはクリックしてファイルを選択
                </p>
            </div>
            <aside>
                <h4>Files</h4>
                <ul>{files}</ul>
            </aside>
        </section>
    );
}
```

`acceptedFiles` は `useDropzone` フックのローカル状態として管理される。
同じコンポーネント内でのみ参照できる。

## Jotai との組み合わせ

**パターン**: 派生 atom（Derived Atom）+ アクション atom（Write-Only Atom）で Jotai らしい設計にする

```jsx
import { atom, useAtomValue, useSetAtom } from "jotai";
import { useDropzone } from "react-dropzone";

// --- atom 定義（モジュールスコープ） ---

// base atom: ファイルリストの唯一の真実の源
const filesAtom = atom([]);

// 派生 atom: base atom から計算できる状態は派生させる
// コンポーネント内で `files.length > 0` と書かない
const hasFilesAtom = atom((get) => get(filesAtom).length > 0);
const totalSizeAtom = atom((get) =>
    get(filesAtom).reduce((sum, f) => sum + f.size, 0),
);
const fileCountAtom = atom((get) => get(filesAtom).length);

// アクション atom（Write-Only Atom）: 副作用のある操作をカプセル化する
// コンポーネントに「ファイルをクリアする」ロジックを散らばらせない
const clearFilesAtom = atom(null, (_get, set) => set(filesAtom, []));

// --- コンポーネント ---

// ファイルを受け取る Dropzone（書き込み専用 useSetAtom）
function BasicDropzone() {
    const setFiles = useSetAtom(filesAtom);
    const { getRootProps, getInputProps } = useDropzone({
        onDrop: (acceptedFiles) => setFiles(acceptedFiles),
    });

    return (
        <div {...getRootProps({ className: "dropzone" })}>
            <input {...getInputProps()} />
            <p>ここにファイルをドロップ</p>
        </div>
    );
}

// ファイルリストの表示（読み取り専用 useAtomValue）
// BasicDropzone とは DOM ツリー上で完全に独立して配置できる
function FileList() {
    const files = useAtomValue(filesAtom);
    return (
        <ul>
            {files.map((f) => (
                <li key={f.name}>{f.name}</li>
            ))}
        </ul>
    );
}

// 派生 atom を使うコンポーネント: 条件分岐のロジックがない
function FileStats() {
    const hasFiles = useAtomValue(hasFilesAtom);
    const count = useAtomValue(fileCountAtom);
    const totalSize = useAtomValue(totalSizeAtom);

    if (!hasFiles) return <p>ファイルが選択されていません</p>;
    return (
        <p>
            {count} ファイル / 合計 {totalSize} bytes
        </p>
    );
}

// アクション atom を使うコンポーネント: クリアロジックを持たない
function ClearButton() {
    const clearFiles = useSetAtom(clearFilesAtom);
    return (
        <button type="button" onClick={clearFiles}>
            クリア
        </button>
    );
}
```

**解説**:

- **`filesAtom`** が唯一の真実の源（Single Source of Truth）。
- **派生 atom** (`hasFilesAtom`, `totalSizeAtom`, `fileCountAtom`) は `filesAtom` から計算される読み取り専用の値。コンポーネント内で `files.length > 0` のような計算を書く必要がなくなる。Jotai は派生 atom の依存関係を自動追跡するため、`filesAtom` が更新されると派生 atom を購読するコンポーネントだけが再レンダリングされる。
- **アクション atom** (`clearFilesAtom`) は `atom(null, (get, set, payload) => ...)` の形式で書く Write-Only atom。`null` が初期値で、第 2 引数の関数が「実行するアクション」。副作用のある操作をモジュールに閉じ込めることで、コンポーネントはアクションを呼ぶだけでよくなる。
- **`useSetAtom`** は書き込みのみ必要なコンポーネントで使う。`useAtom` を使うと読み取り値の変化でも再レンダリングが発生するため、書き込みしか使わない箇所では `useSetAtom` が正しい。
