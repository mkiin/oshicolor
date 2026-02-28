# class-component

クラスコンポーネントで react-dropzone を使う場合は `<Dropzone>` レンダープロップコンポーネントを利用する。

## 基本的な使い方

```jsx
import { Component } from 'react';
import Dropzone from 'react-dropzone';

class ClassDropzone extends Component {
  constructor(props) {
    super(props);
    this.state = { files: [] };
  }

  render() {
    return (
      <Dropzone onDrop={acceptedFiles => this.setState({ files: acceptedFiles })}>
        {({ getRootProps, getInputProps }) => (
          <section>
            <div {...getRootProps({ className: 'dropzone' })}>
              <input {...getInputProps()} />
              <p>ファイルをドロップ</p>
            </div>
            <aside>
              <ul>
                {this.state.files.map(f => (
                  <li key={f.name}>{f.name}</li>
                ))}
              </ul>
            </aside>
          </section>
        )}
      </Dropzone>
    );
  }
}
```

クラスコンポーネントでは `useDropzone` フックが使えないため、
レンダープロップ形式の `<Dropzone>` コンポーネントを使う。

## Jotai との組み合わせ

**パターン**: Jotai フックはクラスコンポーネントで使えないため、薄い関数コンポーネントラッパーで橋渡しする

```jsx
import { Component } from 'react';
import Dropzone from 'react-dropzone';
import { atom, useAtomValue, useSetAtom } from 'jotai';

// --- atom 定義 ---

const filesAtom = atom([]);

// 派生 atom: ファイル件数をコンポーネントの外で計算する
// クラスコンポーネント内ではフックを使えないが、
// 派生 atom の値は props として渡すことで利用できる
const fileCountAtom = atom((get) => get(filesAtom).length);

// --- ラッパーと本体 ---

// 【重要】Jotai のフック（useAtom, useAtomValue, useSetAtom 等）は
// React のルール上、クラスコンポーネント内では使用できない。
// 薄い関数コンポーネントを挟み、atom の読み書きを props としてクラスコンポーネントに渡す。
// このラッパーは「Jotai ↔ クラスコンポーネントの橋渡し役」に徹し、
// それ以上のロジックは持たない。
function ClassDropzoneWrapper() {
  const setFiles = useSetAtom(filesAtom);
  const files = useAtomValue(filesAtom);
  const fileCount = useAtomValue(fileCountAtom);

  return (
    <ClassDropzone
      onDrop={setFiles}
      files={files}
      fileCount={fileCount}
    />
  );
}

class ClassDropzone extends Component {
  render() {
    const { onDrop, files, fileCount } = this.props;

    return (
      <Dropzone onDrop={onDrop}>
        {({ getRootProps, getInputProps }) => (
          <section>
            <div {...getRootProps({ className: 'dropzone' })}>
              <input {...getInputProps()} />
              <p>ファイルをドロップ</p>
            </div>
            <aside>
              <p>{fileCount} ファイル選択中</p>
              <ul>
                {files.map((f) => (
                  <li key={f.name}>{f.name}</li>
                ))}
              </ul>
            </aside>
          </section>
        )}
      </Dropzone>
    );
  }
}

// atom を直接読む関数コンポーネントは通常通り使える
// クラスコンポーネントとは別のコンポーネントツリーに配置できる
function FileCounter() {
  const count = useAtomValue(fileCountAtom);
  return <p>{count} ファイル選択中</p>;
}
```

**解説**:

- **Jotai フックとクラスコンポーネントの制限**: `useAtom`, `useAtomValue`, `useSetAtom` はすべて React フック。React のルール（Rules of Hooks）により、フックは関数コンポーネントとカスタムフックの中でしか呼び出せない。クラスコンポーネントの `render()` や `componentDidMount()` 内で呼ぶことはできない。
- **ラッパーパターン**: 薄い関数コンポーネント（`ClassDropzoneWrapper`）がフックを呼び出し、atom の値と setter を props としてクラスコンポーネントに渡す。クラスコンポーネントは props を受け取るだけで Jotai を知らなくてよい。ラッパーはロジックを持たない「橋渡し」に徹する。
- **派生 atom の props 渡し**: `fileCountAtom` のような派生 atom の値も、ラッパーが `useAtomValue` で取得して props として渡せる。クラスコンポーネント内でフックなしに派生値を利用できる。
- 新規開発では関数コンポーネントを選択することで、このラッパーパターンを避けられる。
