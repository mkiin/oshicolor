---
title: "Jotaiでファイルアップローダーを作ろう"
---

ファイルアップローダーは、Reactの状態管理が凝縮されたコンポーネントです。「どのファイルが選ばれているか」「アップロードの進捗は何%か」「ドラッグ中かどうか」——複数の状態が絡み合い、複数のコンポーネントが同じ状態を共有する必要があります。

この章では、そのような状態管理を**jotai**で実装する方法を、実際に動くコンポーネントを組み立てながら学びます。jotaiの基本的な概念（atom、useAtomなど）はすでに知っている前提で進めますが、今回初めて「複数コンポーネントで状態を共有する」場面でjotaiを使う方でも理解できるよう丁寧に解説します。

## このガイドで作るもの

完成形のコンポーネントは、以下のように使います。

```tsx
const [files, setFiles] = useState<File[]>([]);

<FileUpload
    value={files}
    onValueChange={setFiles}
    onUpload={async (files, { onProgress, onSuccess, onError }) => {
        for (const file of files) {
            await uploadToServer(file, (progress) =>
                onProgress(file, progress),
            );
            onSuccess(file);
        }
    }}
    accept="image/*"
    maxFiles={5}
>
    <FileUploadDropzone>
        ここにファイルをドロップするか
        <FileUploadTrigger>クリックして選択</FileUploadTrigger>
    </FileUploadDropzone>

    <FileUploadList>
        {files.map((file) => (
            <FileUploadItem key={file.name} value={file}>
                <FileUploadItemPreview />
                <FileUploadItemMetadata />
                <FileUploadItemDelete />
            </FileUploadItem>
        ))}
    </FileUploadList>
</FileUpload>;
```

`FileUpload`がルートのコンポーネントで、その中に`FileUploadDropzone`（ドロップエリア）や`FileUploadList`（ファイル一覧）が並んでいます。このような「親が文脈を提供し、子が必要な部分だけを使う」設計を**Compound Component**パターンといいます。

今回のテーマは、**このコンポーネントの状態管理にjotaiを使う**ことです。

---

## 状態の設計から始める

コードを書く前に「何を状態として持つか」を整理しましょう。ファイルアップローダーには、3つの状態が必要です。

| 状態                 | 型                     | 意味                                            |
| -------------------- | ---------------------- | ----------------------------------------------- |
| ファイル一覧         | `Map<File, FileState>` | 選択済みファイルとそれぞれの状態                |
| ドラッグ中           | `boolean`              | ファイルをドラッグしている最中かどうか          |
| バリデーションエラー | `boolean`              | 不正なファイルが追加されたとき2秒間`true`になる |

配列（`FileState[]`）ではなく`Map<File, FileState>`を使う理由があります。配列では「特定のファイルの状態を更新する」のに全件を走査する必要がありますが（O(n)）、Mapなら`Map.get(file)`で即座に取得できます（O(1)）[^note_key]。

[^note_key]: `Map`のキーにブラウザのネイティブ`File`オブジェクトを使えることがポイントです。同じファイル名でも、異なる`File`オブジェクトは別のエントリとして扱われます。

また、各ファイルには「現在の状態」が必要です。アップロード中なのか、成功したのか、エラーが起きたのかを追跡します。

```ts
type FileState = {
    file: File;
    progress: number; // アップロード進捗 0〜100
    error?: string; // エラーメッセージ
    status: "idle" | "uploading" | "error" | "success"; // 状態
};
```

これをjotaiのatomとして定義します。

```ts
import { atom } from "jotai";

const filesAtom = atom<Map<File, FileState>>(new Map());
const dragOverAtom = atom(false);
const invalidAtom = atom(false);
```

`useState`と比べると、jotaiでは「状態の定義」がコンポーネントの外に出ます。これが後で「複数コンポーネントが同じ状態を共有する」ための鍵になります。

---

## アクションを派生atomで定義する

状態を定義したら、次は「状態をどう変えるか」を定義します。元の実装では、これをredux風の`dispatch`/`reducer`で実現していました。jotaiでは、**書き込み専用の派生atom**（write atom）が同じ役割を果たします。

```ts
// 書き込み専用atomの基本的な形
const somethingAtom = atom(
    null, // 読み取り値なし（nullを返す読み取り専用）
    (get, set, 引数) => {
        // 書き込み時に呼ばれる関数
        const current = get(somethingElseAtom);
        set(somethingElseAtom /* 新しい値 */);
    },
);

// 呼び出し方
const doSomething = useSetAtom(somethingAtom);
doSomething(引数);
```

ファイルアップローダーで必要なアクションをwrite atomとして定義します。

### 注意点：イミュータブルな更新

書き始める前に、**必ず守らなければならないルール**を説明します。

jotaiは、atomの値が変化したかどうかを `Object.is(前の値, 新しい値)` で判定します。`Map`に対してこれを使うと、**中身を変えても参照が同じなら変化なしと判断されます**。

```ts
// ❌ 動かない例
const addFilesAtom = atom(null, (get, set, newFiles: File[]) => {
    const map = get(filesAtom);
    for (const file of newFiles) {
        map.set(file, { file, progress: 0, status: "idle" }); // 同じmapを直接書き換える
    }
    set(filesAtom, map); // 参照が変わっていないのでjotaiは変化を検知できない！
});
```

```ts
// ✅ 動く例：必ず新しいMapを作って渡す
const addFilesAtom = atom(null, (get, set, newFiles: File[]) => {
    const next = new Map(get(filesAtom)); // コピーを作る → 新しい参照になる
    for (const file of newFiles) {
        next.set(file, { file, progress: 0, status: "idle" });
    }
    set(filesAtom, next); // 新しい参照なのでjotaiが変化を検知する
});
```

`new Map(get(filesAtom))`でコピーを作ることで、常に新しい参照を`set`に渡すようにしてください。これはjotaiに限らず、ReactのステートでMapやオブジェクトを扱う際の基本です。

### ファイルの追加・削除・クリア

```ts
// ── ファイルを追加する（既存のファイルはそのまま） ───────────
const addFilesAtom = atom(null, (get, set, newFiles: File[]) => {
    const next = new Map(get(filesAtom));
    for (const file of newFiles) {
        if (!next.has(file)) {
            next.set(file, { file, progress: 0, status: "idle" });
        }
    }
    set(filesAtom, next);
});

// ── ファイル一覧を置き換える（Controlledモード用） ──────────
// 差分更新なので、既存ファイルのprogress/statusは保持される
const setFilesAtom = atom(null, (get, set, newFiles: File[]) => {
    const current = get(filesAtom);
    const next = new Map<File, FileState>();
    for (const file of newFiles) {
        next.set(
            file,
            current.get(file) ?? { file, progress: 0, status: "idle" },
        );
    }
    set(filesAtom, next);
});

// ── 個別ファイルを削除する ────────────────────────────────
const removeFileAtom = atom(null, (get, set, file: File) => {
    const next = new Map(get(filesAtom));
    next.delete(file);
    set(filesAtom, next);
});

// ── 全ファイルをクリアする ────────────────────────────────
const clearFilesAtom = atom(null, (_get, set) => {
    set(filesAtom, new Map());
    set(invalidAtom, false);
});
```

### アップロード進捗の更新

```ts
// ── 進捗を更新する ─────────────────────────────────────
const setProgressAtom = atom(
    null,
    (get, set, { file, progress }: { file: File; progress: number }) => {
        const next = new Map(get(filesAtom));
        const fileState = next.get(file);
        if (fileState) {
            next.set(file, {
                ...fileState,
                progress: Math.min(Math.max(0, progress), 100), // 0〜100にクランプ
                status: "uploading",
            });
        }
        set(filesAtom, next);
    },
);

// ── 成功を記録する ──────────────────────────────────────
const setSuccessAtom = atom(null, (get, set, file: File) => {
    const next = new Map(get(filesAtom));
    const fileState = next.get(file);
    if (fileState) {
        next.set(file, { ...fileState, progress: 100, status: "success" });
    }
    set(filesAtom, next);
});

// ── エラーを記録する ────────────────────────────────────
const setErrorAtom = atom(
    null,
    (get, set, { file, error }: { file: File; error: string }) => {
        const next = new Map(get(filesAtom));
        const fileState = next.get(file);
        if (fileState) {
            next.set(file, { ...fileState, error, status: "error" });
        }
        set(filesAtom, next);
    },
);
```

write atomを並べてみると、それぞれが「ある1つの操作」を表していることが分かります。元実装のredux風reducerと比べると、アクションが独立したatomとして定義されているため、どのatomが何をするかが一目瞭然です。これがjotaiにおけるカプセル化のひとつの形です。

---

## インスタンスを分離する

jotaiのatomはデフォルトでグローバルな状態です。これは、同じページに`<FileUpload>`を2つ並べたとき、片方にファイルを追加するともう片方にも表示される、という問題を引き起こします。

```tsx
// こうすると filesAtom を2つのコンポーネントが共有してしまう
<FileUpload />  {/* Aのファイルを追加すると… */}
<FileUpload />  {/* Bにも表示される！ */}
```

これを防ぐために、`createStore`と`Provider`を使います。jotaiでは、`Provider`にstoreを渡すことで、**そのツリー内のatom操作が指定したstoreに対して行われる**ようになります。

```ts
import { createStore, Provider } from "jotai";

// createStoreを呼ぶたびに独立したstoreが作られる
const storeA = createStore();
const storeB = createStore();

storeA.set(filesAtom, mapA); // storeAにだけ書き込まれる
storeB.set(filesAtom, mapB); // storeBにだけ書き込まれる
```

`FileUploadRoot`の中で`createStore()`を呼ぶことで、コンポーネントのインスタンスごとに独立したstoreが作られます。

```tsx
import { createStore, Provider } from "jotai";

const FileUploadRoot: React.FC<FileUploadRootProps> = (props) => {
    const { children, ...rest } = props;

    // useMemoでstoreを安定させる
    // useMemoがないと再レンダリングのたびに新しいstoreが作られてしまう
    const jotaiStore = useMemo(() => createStore(), []);

    return (
        <Provider store={jotaiStore}>
            <FileUploadContext.Provider value={{ ...contextValue, jotaiStore }}>
                {children}
            </FileUploadContext.Provider>
        </Provider>
    );
};
```

`Provider`を使うことで、その中のコンポーネントが`useAtomValue`を呼ぶとき、自動的に`jotaiStore`が参照されます。`store`を明示的に渡す必要はありません[^note_store_option]。

[^note_store_option]: `useAtomValue(anAtom, { store: jotaiStore })`のように明示的に渡すこともできます。`Provider`を使わず、storeを直接操作したい場合に使います。

`jotaiStore`は`FileUploadContext`に入れておき、子コンポーネントが必要なときに取り出せるようにします。

```ts
// FileUploadContext の型定義
type FileUploadContextValue = {
    inputRef: React.RefObject<HTMLInputElement | null>;
    inputId: string;
    dropzoneId: string;
    listId: string;
    labelId: string;
    disabled: boolean;
    dir: "ltr" | "rtl";
    jotaiStore: ReturnType<typeof createStore>; // ← 追加
};
```

---

## 子コンポーネントから状態を読む

`Provider`で囲まれた子コンポーネントでは、`useAtomValue`でatomの現在の値を購読できます。

### FileUploadDropzoneの実装

`FileUploadDropzone`は「ドラッグ中かどうか」と「バリデーションエラー中かどうか」を知る必要があります。

```tsx
const FileUploadDropzone = React.forwardRef<
    HTMLDivElement,
    FileUploadDropzoneProps
>((props, forwardedRef) => {
    const { jotaiStore } = useFileUploadContext(DROPZONE_NAME);

    // useAtomValueでatomを購読する
    // dragOverAtomが変化したときだけこのコンポーネントが再レンダリングされる
    const dragOver = useAtomValue(dragOverAtom);
    const invalid = useAtomValue(invalidAtom);

    const onDragOver = useCallback(
        (event: React.DragEvent<HTMLDivElement>) => {
            event.preventDefault(); // これがないとonDropが発火しない
            jotaiStore.set(dragOverAtom, true);
        },
        [jotaiStore],
    );

    const onDragLeave = useCallback(
        (event: React.DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            jotaiStore.set(dragOverAtom, false);
        },
        [jotaiStore],
    );

    const onDrop = useCallback(
        (event: React.DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            jotaiStore.set(dragOverAtom, false);
            // ドロップされたファイルを input.files に渡す
            // （詳細は後述）
        },
        [jotaiStore],
    );

    return (
        <div
            data-dragging={dragOver ? "" : undefined}
            data-invalid={invalid ? "" : undefined}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            ref={forwardedRef}
        />
    );
});
```

ここで`jotaiStore.set(dragOverAtom, true)`のように、storeを直接操作してatomに書き込んでいます。`useSetAtom`を使う方法もありますが、イベントハンドラの中では`jotaiStore.set`の方が素直に書けます[^note_set_or_useset]。

[^note_set_or_useset]: `useSetAtom(dragOverAtom)`でも同じことができます。どちらを選ぶかは好みや場面次第です。この例では`jotaiStore`をContextから取り出す手間がありますが、write atomと組み合わせるときに一貫性が出るという利点があります。

`data-dragging`や`data-invalid`といった属性はTailwindのCSSと連動させるための仕組みです。値は`""`（空文字）か`undefined`で、属性が存在するかどうかでスタイルを切り替えます。

```
data-dragging="" が存在するとき → ボーダーが青くなる
data-invalid="" が存在するとき  → ボーダーが赤くなる（2秒後に消える）
```

### FileUploadItemの実装

個別ファイルのコンポーネントでは、「このファイルの状態」だけを購読したいです。`filesAtom`全体を購読すると、**他のファイルの状態が変わっても再レンダリングが起きてしまいます**。

`selectAtom`を使うと、atomの一部だけを購読できます。

```ts
import { selectAtom } from "jotai/utils";
```

```tsx
const FileUploadItem = React.forwardRef<HTMLDivElement, FileUploadItemProps>(
    (props, forwardedRef) => {
        const { value: file } = props;

        // selectAtomで「このファイルの状態」だけを選択する
        // useMemoで安定させることが重要（毎レンダリングで新しいatomを作らないように）
        const fileStateAtom = useMemo(
            () => selectAtom(filesAtom, (files) => files.get(file)),
            [file],
        );
        const fileState = useAtomValue(fileStateAtom);

        // fileStateがundefined = このファイルは削除済み → 何も表示しない
        if (!fileState) return null;

        // ...
    },
);
```

`useMemo`で`fileStateAtom`を固定している理由を説明します。`selectAtom(filesAtom, selector)`はコードを見ると「atomを返す関数」ですが、呼ぶたびに**新しいatomオブジェクトを作ります**。jotaiはatomオブジェクトの参照でキャッシュを管理しているので、毎レンダリングで新しいatomを作ると毎回購読の張り直しが起きてしまいます。`useMemo`で「`file`が変わるまで同じatomを使い回す」ようにするわけです。

これは`useCallback`でコールバックを安定させることに似た発想です。

---

## Controlledモードを実装する

`value` propが渡されたとき（**Controlledモード**）は、propが変化するたびにstoreの状態を同期する必要があります。

`useHydrateAtoms`を使うと、コンポーネントの初期レンダリング時にatomに値を設定できます。

```ts
import { useHydrateAtoms } from "jotai/utils";
```

ただし`useHydrateAtoms`は初期化専用です。その後の同期には`useEffect`を使います。

```tsx
// Provider の内側で動くコンポーネントとして分離する
const FileUploadSync: React.FC<{ value: File[] | undefined }> = ({ value }) => {
    const setFiles = useSetAtom(setFilesAtom);

    // valueが変化するたびにstoreを同期する
    useEffect(() => {
        if (value !== undefined) {
            setFiles(value);
        }
    }, [value, setFiles]);

    return null; // このコンポーネント自体はUIを持たない
};
```

```tsx
const FileUploadRoot: React.FC<FileUploadRootProps> = (props) => {
    const { value, defaultValue, children } = props;
    const jotaiStore = useMemo(() => createStore(), []);

    // defaultValueがある場合はstoreを初期化する
    const initialMap = useMemo(() => {
        const files = value ?? defaultValue ?? [];
        const map = new Map<File, FileState>();
        for (const file of files) {
            map.set(file, { file, progress: 0, status: "idle" });
        }
        return map;
    }, []); // 初回のみ

    return (
        <Provider store={jotaiStore}>
            <FileUploadContext.Provider value={{ ...contextValue, jotaiStore }}>
                <FileUploadSync value={value} />
                {children}
            </FileUploadContext.Provider>
        </Provider>
    );
};
```

---

## onValueChangeの注意点

`onValueChange`はpropsから渡されるコールバックです。これをwrite atomの中で直接使おうとすると問題が起きます。

jotaiのwrite atomはコンポーネントの外で定義されます。つまり、atomが定義された時点の`onValueChange`を「覚えて」しまい、後でpropが変わっても古い関数を呼び続けてしまうのです。これを**stale closure（古いクロージャ）問題**といいます。

解決策は、`onValueChange`の最新バージョンを**Ref**に入れておいて、write atomからはRefを経由して呼ぶことです。

```ts
// これは元実装にもある、stale closureを防ぐカスタムフック
function useAsRef<T>(data: T) {
    const ref = React.useRef<T>(data);
    useLayoutEffect(() => {
        ref.current = data; // レンダリングのたびに最新の値で更新する
    });
    return ref;
}
```

```tsx
const FileUploadRoot: React.FC<FileUploadRootProps> = (props) => {
    const { onValueChange } = props;

    // onValueChangeの最新版をRefに保持する
    const onValueChangeRef = useAsRef(onValueChange);

    // ファイルが変化したら onValueChange を呼ぶ
    const filesValue = useAtomValue(filesAtom);
    useEffect(() => {
        const fileList = Array.from(filesValue.values()).map((s) => s.file);
        onValueChangeRef.current?.(fileList);
    }, [filesValue, onValueChangeRef]);
};
```

`filesAtom`が変化したときに`useEffect`が動き、最新の`onValueChange`を呼ぶ仕組みです。`onValueChangeRef.current`を通じて参照することで、Refが古いコールバックを掴み続ける問題を防いでいます。

---

## アップロード処理を実装する

アップロード処理は非同期なので、write atomを`async`関数で書きます。jotaiはwrite atomで`async`を使えます。

```ts
// onUploadコールバックをRefで受け取るfactory関数
const createUploadAtom = (
    onUploadRef: React.RefObject<FileUploadRootProps["onUpload"]>,
) =>
    atom(null, async (get, set, files: File[]) => {
        if (!onUploadRef.current) return;

        // まず全ファイルを uploading 状態にする（progress=0）
        const startMap = new Map(get(filesAtom));
        for (const file of files) {
            const s = startMap.get(file);
            if (s)
                startMap.set(file, { ...s, progress: 0, status: "uploading" });
        }
        set(filesAtom, startMap);

        try {
            await onUploadRef.current(files, {
                // 進捗が来たらatomを更新する
                onProgress: (file, progress) => {
                    const next = new Map(get(filesAtom));
                    const s = next.get(file);
                    if (s)
                        next.set(file, { ...s, progress, status: "uploading" });
                    set(filesAtom, next);
                },
                onSuccess: (file) => {
                    const next = new Map(get(filesAtom));
                    const s = next.get(file);
                    if (s)
                        next.set(file, {
                            ...s,
                            progress: 100,
                            status: "success",
                        });
                    set(filesAtom, next);
                },
                onError: (file, error) => {
                    const next = new Map(get(filesAtom));
                    const s = next.get(file);
                    if (s)
                        next.set(file, {
                            ...s,
                            error: error.message,
                            status: "error",
                        });
                    set(filesAtom, next);
                },
            });
        } catch (error) {
            // onUpload全体で例外が起きた場合は全ファイルをerrorにする
            const message =
                error instanceof Error ? error.message : "Upload failed";
            const errorMap = new Map(get(filesAtom));
            for (const file of files) {
                const s = errorMap.get(file);
                if (s)
                    errorMap.set(file, {
                        ...s,
                        error: message,
                        status: "error",
                    });
            }
            set(filesAtom, errorMap);
        }
    });
```

`createUploadAtom`のように「atomを作るファクトリー関数」を使うパターンは、jotaiではよく登場します。今回は`onUploadRef`という外部の値をwrite atomに閉じ込めるために使っています。

```tsx
const FileUploadRoot: React.FC<FileUploadRootProps> = (props) => {
    const { onUpload } = props;
    const onUploadRef = useAsRef(onUpload);

    // このコンポーネントのライフサイクルで固定する
    const uploadAtom = useMemo(() => createUploadAtom(onUploadRef), []);

    const handleUpload = (files: File[]) => {
        jotaiStore.set(uploadAtom, files);
    };
};
```

---

## 元の実装との対応

ここまで実装してきた内容と、元の`file-upload.tsx`の実装がどう対応するかを整理しましょう。

| 元の実装（カスタムStore）       | jotai版                              |
| ------------------------------- | ------------------------------------ |
| `createStore()` 関数（約170行） | 削除（jotai本体に委譲）              |
| `listeners: Set<() => void>`    | 削除（jotai内部で管理）              |
| `store.subscribe()`             | 削除（`useAtomValue`が担う）         |
| `useSyncExternalStore()`        | 削除（`useAtomValue`が担う）         |
| `useStore(selector)` フック     | `useAtomValue(selectAtom(...))`      |
| `useLazyRef(() => new Set())`   | 削除                                 |
| `useLazyRef(() => new Map())`   | 削除                                 |
| reducer の `"ADD_FILES"`        | `addFilesAtom`                       |
| reducer の `"SET_FILES"`        | `setFilesAtom`                       |
| reducer の `"REMOVE_FILE"`      | `removeFileAtom`                     |
| reducer の `"SET_PROGRESS"`     | `setProgressAtom`                    |
| reducer の `"SET_SUCCESS"`      | `setSuccessAtom`                     |
| reducer の `"SET_ERROR"`        | `setErrorAtom`                       |
| reducer の `"SET_DRAG_OVER"`    | `jotaiStore.set(dragOverAtom, bool)` |
| reducer の `"SET_INVALID"`      | `jotaiStore.set(invalidAtom, bool)`  |
| reducer の `"CLEAR"`            | `clearFilesAtom`                     |

`createStore`関数と`useStore`フックを合わせると元コードで約170行ありました。jotaiに置き換えることで、それらがすべてatomの定義（数十行）に置き換えられます。

---

## Suspenseとの連携は必要か？

ここで一度立ち止まって考えてみましょう。`onUpload`は`async`関数です。ガイドの読者の中には「非同期処理があるなら Suspense を使えばよいのでは？」と思った方もいるはずです。

### アップロード処理に Suspense は向かない

Suspense の設計思想は「**データが準備できるまで UI をサスペンドし、準備できたら表示する**」というものです。言い換えれば、「見せるものが決まっていない間は、代わりのUI（fallback）を表示する」ということです。

ファイルアップロードは、この思想と根本的に合っていません。

```
Suspense が得意な場面:
  「まだ何も見せられない（データ取得中）→ skeleton や spinner を表示」
  例: ユーザープロフィールの取得、検索結果の取得

ファイルアップロードの実態:
  「ユーザーが操作した → 進捗が 0%→50%→100% と変化していく」
  → 変化の過程を「見せる」のが重要
```

もし Suspense を使ってしまうと、アップロード中にコンポーネントが fallback UI（"アップロード中..."のspinner）に差し替えられ、**個別ファイルの進捗バーが消えてしまいます**。それはUXの改悪です。

また、アップロードは「ユーザー操作をきっかけに始まる命令型の処理」です。Suspense が得意とする「ステートが変わったら自動的に再フェッチが走る宣言型の処理」とは仕組みが異なります。

**結論：アップロード処理そのものに Suspense は使わない。** `createUploadAtom`が返すのは`async`な write atom ですが、Suspense とは無関係に動きます[^note_async_write]。

[^note_async_write]: jotai の write atom は `async` にできますが、write atom の非同期処理はサスペンドを引き起こしません。サスペンドが起きるのは、`atom(async (get) => ...)` のように**読み取り関数が Promise を返す**場合だけです。

### Suspense が活きる場面：初期ファイル一覧の取得

では、どんな場面で Suspense を使うべきでしょうか。例えば、**サーバーから初期ファイル一覧を取得してコンポーネントを初期化する**ケースを考えてみます。

```tsx
// たとえば「このユーザーのアップロード済みファイルを取得してコンポーネントを初期化する」
type SavedFile = { id: string; name: string; url: string };

// キーワード（userId）を保持する atom
const userIdAtom = atom<string | null>(null);

// userId が変わったら自動的に再取得する派生 atom
// atom の読み取り関数が Promise を返すと、useAtomValue を呼ぶコンポーネントがサスペンドする
const savedFilesAtom = atom(async (get): Promise<SavedFile[]> => {
    const userId = get(userIdAtom);
    if (!userId) return [];
    const response = await fetch(`/api/users/${userId}/files`);
    return response.json();
});
```

```tsx
// コンポーネント側
const FileUploadWithHistory: React.FC<{ userId: string }> = ({ userId }) => {
    const setUserId = useSetAtom(userIdAtom);

    // userId が変わったら userIdAtom を更新 → savedFilesAtom が再計算 → サスペンド
    React.useEffect(() => {
        setUserId(userId);
    }, [userId, setUserId]);

    return (
        // サスペンド中は fallback が表示される
        <Suspense fallback={<FileListSkeleton />}>
            <FileUploadWithData />
        </Suspense>
    );
};

const FileUploadWithData: React.FC = () => {
    // savedFilesAtom が Promise を返すのでサスペンドし、データが来たら再レンダリングされる
    const savedFiles = useAtomValue(savedFilesAtom);

    return (
        <FileUpload defaultValue={savedFiles.map(toFile)}>
            {/* ... */}
        </FileUpload>
    );
};
```

このように、**「コンポーネントの初期化に必要なデータをサーバーから取得する」場面**では、Suspense + jotai の組み合わせが機能します。今回作ったコンポーネント自体の内部では使いませんが、コンポーネントを使う側でこのパターンを採用することはあります。

### 判断の基準

Suspense を使うかどうかは、「**その非同期処理がサスペンド（表示を止める）に値するか**」で判断します。

| 非同期処理の種類                                   | Suspense を使う？ | 理由                                         |
| -------------------------------------------------- | ----------------- | -------------------------------------------- |
| 初期データの取得（ユーザー情報、既存ファイル一覧） | ✅ 使う           | 取得できるまで表示するものがない             |
| ファイルのアップロード（進捗あり）                 | ❌ 使わない       | 進捗をリアルタイムで見せる必要がある         |
| バリデーション結果（即時）                         | ❌ 使わない       | 同期処理として扱える                         |
| アップロード後の後処理（通知など）                 | ❌ 使わない       | 完了後の副作用。UIをサスペンドする必要がない |

---

## まとめ

この章では、ファイルアップローダーの状態管理をjotaiで実装しました。ポイントを整理します。

**状態はatomで定義する。** `filesAtom`, `dragOverAtom`, `invalidAtom` の3つで、コンポーネントが持つべき状態すべてが表現できます。

**アクションはwrite atomで定義する。** 「ファイルを追加する」「削除する」「進捗を更新する」といった操作それぞれをwrite atomとして表現することで、操作の意図が明確になります。

**MapはイミュータブルなUpdateが必要。** `new Map(get(filesAtom))`でコピーを作り、必ず新しい参照を`set`に渡してください。これを守らないとjotaiが変化を検知できません。

**複数インスタンスは`createStore` + `Provider`で分離する。** `FileUploadRoot`の中で`createStore()`を呼ぶことで、コンポーネントごとに独立した状態を持てます。

**コールバックはRefで受け渡す。** `onValueChange`のようなpropsのコールバックは`useAsRef`でRefに入れ、stale closureを防ぎます。

---

## 練習問題

ファイルアップローダーには、まだ実装していない機能があります。「全ファイルのクリア」ボタン（`FileUploadClear`）を実装してみましょう。

仕様:

- クリックすると全ファイルが削除される
- ファイルが0件のときは表示されない（`forceMount` propが`true`のときは常に表示）

```tsx
interface FileUploadClearProps extends React.ComponentPropsWithoutRef<"button"> {
    forceMount?: boolean;
}

const FileUploadClear = React.forwardRef<
    HTMLButtonElement,
    FileUploadClearProps
>((props, forwardedRef) => {
    const { forceMount, ...clearProps } = props;
    const { jotaiStore } = useFileUploadContext(CLEAR_NAME);

    // ここを実装する
    // ヒント1: filesAtomのfiles.sizeを参照する
    // ヒント2: forceMountがfalseのとき、ファイルが0件なら return null
    // ヒント3: クリックしたら clearFilesAtom を呼ぶ
});
```

:::details 答え

```tsx
const FileUploadClear = React.forwardRef<
    HTMLButtonElement,
    FileUploadClearProps
>((props, forwardedRef) => {
    const { forceMount, ...clearProps } = props;
    const { jotaiStore } = useFileUploadContext(CLEAR_NAME);

    const filesSize = useAtomValue(
        useMemo(() => selectAtom(filesAtom, (files) => files.size), []),
    );

    const shouldRender = forceMount || filesSize > 0;
    if (!shouldRender) return null;

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        clearProps.onClick?.(event);
        if (event.defaultPrevented) return;
        jotaiStore.set(clearFilesAtom, undefined);
    };

    return (
        <button
            type="button"
            {...clearProps}
            ref={forwardedRef}
            onClick={handleClick}
        />
    );
});
```

ポイントは2つあります。

1つ目は`selectAtom`でファイル数だけを購読していること。`filesAtom`全体を購読すると、ファイルの進捗が変わるたびに`FileUploadClear`も再レンダリングされてしまいます。`files.size`だけ選択することで、ファイル数が変わったときだけ再レンダリングされるようになります。

2つ目はクリック時に`event.defaultPrevented`をチェックしていること。利用者が`onClick`ハンドラの中で`event.preventDefault()`を呼ぶことで、クリアをキャンセルできる設計になっています。確認ダイアログを挟みたいときなどに使えます。

:::
