# validator

`validator` オプションでカスタムバリデーション関数を渡す。
ファイル単位で詳細なバリデーションが必要な場合に使う。

## 基本的な使い方

```jsx
import { useDropzone } from "react-dropzone";

function nameLengthValidator(file) {
  if (file.name.length > 20) {
    return {
      code: "name-too-large",
      message: `Name is larger than 20 characters`,
    };
  }
  return null;
}

function ValidatorDropzone() {
  const { acceptedFiles, fileRejections, getRootProps, getInputProps } = useDropzone({
    validator: nameLengthValidator,
  });

  return (
    <section>
      <div {...getRootProps({ className: "dropzone" })}>
        <input {...getInputProps()} />
        <p>ファイル名が20文字以下のファイルのみ受け付けます</p>
      </div>
      <aside>
        <h4>Accepted ({acceptedFiles.length})</h4>
        <ul>
          {acceptedFiles.map((f) => (
            <li key={f.name}>{f.name}</li>
          ))}
        </ul>
        <h4>Rejected</h4>
        <ul>
          {fileRejections.map(({ file, errors }) => (
            <li key={file.name}>
              {file.name}
              <ul>
                {errors.map((e) => (
                  <li key={e.code}>{e.message}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </aside>
    </section>
  );
}
```

`validator` 関数は `FileError | FileError[] | null` を返す。
`null` を返せばバリデーション通過。

## Jotai との組み合わせ

**パターン**: `atomWithStorage` で設定を永続化 + 派生 atom でバリデーター関数を生成する

```jsx
import { useAtom, useAtomValue } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { atom } from "jotai";
import { useDropzone } from "react-dropzone";

// --- atom 定義 ---

// atomWithStorage: ユーザーが設定した最大文字数をリロード後も記憶する
const maxLengthAtom = atomWithStorage("dropzone-validator-max-length", 20);

// 派生 atom: maxLengthAtom の値からバリデーター関数を生成する。
// useCallback に maxLength を渡す代わりに、派生 atom でバリデーター関数そのものを atom にする。
// これにより、コンポーネントは「バリデーターの生成ロジック」を知らなくてよい。
const validatorAtom = atom((get) => {
  const maxLength = get(maxLengthAtom);
  return (file) => {
    if (file.name.length > maxLength) {
      return {
        code: "name-too-large",
        message: `Name is larger than ${maxLength} characters`,
      };
    }
    return null;
  };
});

// --- コンポーネント ---

function DynamicValidatorDropzone() {
  // validatorAtom から関数を受け取るだけ。useCallback は不要。
  const validator = useAtomValue(validatorAtom);
  const { acceptedFiles, fileRejections, getRootProps, getInputProps } = useDropzone({
    validator,
  });

  // maxLength の表示用に maxLengthAtom を直接参照する
  const maxLength = useAtomValue(maxLengthAtom);

  return (
    <section>
      <div {...getRootProps({ className: "dropzone" })}>
        <input {...getInputProps()} />
        <p>ファイル名が {maxLength} 文字以下のファイルのみ受け付けます</p>
      </div>
      <aside>
        <h4>Accepted ({acceptedFiles.length})</h4>
        <ul>
          {acceptedFiles.map((f) => (
            <li key={f.name}>{f.name}</li>
          ))}
        </ul>
        <h4>Rejected</h4>
        <ul>
          {fileRejections.map(({ file, errors }) => (
            <li key={file.name}>
              {file.name}
              <ul>
                {errors.map((e) => (
                  <li key={e.code}>{e.message}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </aside>
    </section>
  );
}

// 設定 UI から上限文字数を変更できる
// 変更は localStorage に自動保存され、リロード後も維持される
function ValidatorControl() {
  const [maxLength, setMaxLength] = useAtom(maxLengthAtom);
  return (
    <label>
      ファイル名の最大文字数:
      <input
        type="number"
        min={1}
        value={maxLength}
        onChange={(e) => setMaxLength(Number(e.target.value))}
      />
    </label>
  );
}
```

**解説**:

- **`validatorAtom`** は `maxLengthAtom` を購読する派生 atom。`maxLengthAtom` が変わると自動的にバリデーター関数が再生成される。コンポーネントは `useAtomValue(validatorAtom)` で最新の関数を取得するだけでよく、`useCallback` と依存配列の管理が不要になる。
- **`atomWithStorage`** により `maxLength` の設定がリロード後も保持される。`atom(20)` から `atomWithStorage('...', 20)` に変えるだけで永続化できる。
- 派生 atom が関数を返す（atom of function）パターンは Jotai で有効。Jotai は値の型を制限しないため、バリデーター関数を atom で管理することは自然。
