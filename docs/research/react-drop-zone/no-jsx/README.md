# no-jsx

JSX を使わずに `React.createElement` で react-dropzone を利用する。

## 基本的な使い方

```js
const { useState } = React;
const { useDropzone } = ReactDropzone;
const e = React.createElement;

function Basic() {
  const [files, setFiles] = useState([]);
  const { getRootProps, getInputProps } = useDropzone({
    onDrop: acceptedFiles => setFiles(acceptedFiles),
  });

  const fileList = files.map(f =>
    e('li', { key: f.name }, `${f.name} - ${f.size} bytes`)
  );

  return e(
    'section',
    null,
    e(
      'div',
      getRootProps({ className: 'dropzone' }),
      e('input', getInputProps()),
      e('p', null, 'ファイルをドロップ')
    ),
    e('aside', null, e('ul', null, ...fileList))
  );
}
```

JSX なし（`React.createElement` 直接呼び出し）でも react-dropzone は完全に動作する。
`getRootProps` / `getInputProps` の使い方は JSX 版と同じ。

## Jotai との組み合わせ

**パターン**: JSX の有無に関わらず、派生 atom + アクション atom の設計は同じ

```js
const { atom, useAtomValue, useSetAtom } = jotai;
const e = React.createElement;

// --- atom 定義（JSX がなくても atom の書き方は変わらない）---

const filesAtom = atom([]);

// 派生 atom: JSX 版と全く同じ書き方
const hasFilesAtom = atom((get) => get(filesAtom).length > 0);
const totalSizeAtom = atom((get) =>
  get(filesAtom).reduce((sum, f) => sum + f.size, 0)
);

// アクション atom: JSX 版と全く同じ書き方
const clearFilesAtom = atom(null, (_get, set) => set(filesAtom, []));

// --- コンポーネント（JSX なし）---

function Basic() {
  const setFiles = useSetAtom(filesAtom);
  const { getRootProps, getInputProps } = useDropzone({ onDrop: setFiles });

  return e(
    'section',
    null,
    e(
      'div',
      getRootProps({ className: 'dropzone' }),
      e('input', getInputProps()),
      e('p', null, 'ファイルをドロップ')
    ),
    e(FileStats, null), // 派生 atom を使うコンポーネントも同様に配置できる
    e(ClearButton, null)
  );
}

// 派生 atom を使うコンポーネント: JSX 版と同じロジック、createElement で書くだけ
function FileStats() {
  const hasFiles = useAtomValue(hasFilesAtom);
  const totalSize = useAtomValue(totalSizeAtom);

  if (!hasFiles) return e('p', null, 'ファイルが選択されていません');
  return e('p', null, `合計 ${totalSize} bytes`);
}

// アクション atom を使うコンポーネント
function ClearButton() {
  const clearFiles = useSetAtom(clearFilesAtom);
  return e('button', { type: 'button', onClick: clearFiles }, 'クリア');
}

// atom を読む別コンポーネントも JSX なしで書ける
function FileCounter() {
  const files = useAtomValue(filesAtom);
  return e('p', null, `${files.length} ファイル選択中`);
}
```

**解説**:

- **JSX と Jotai は独立している**。`atom()`, `useAtomValue()`, `useSetAtom()` はすべて通常の JavaScript 関数であり、JSX のトランスパイルとは無関係。`React.createElement` を使う環境でも全く同じ API で動作する。
- **派生 atom・アクション atom の設計も変わらない**。`atom((get) => ...)` や `atom(null, (get, set, payload) => ...)` の書き方は JSX の有無に影響されない。JSX 版のドキュメントで学んだパターンはそのまま適用できる。
- `React.createElement` 呼び出しの構造（`e(type, props, ...children)`）は JSX との対応関係を理解すると読みやすくなる: `<div className="x">text</div>` は `e('div', { className: 'x' }, 'text')` に相当する。
