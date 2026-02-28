# file-upload.tsx コンポーネント設計ガイド

> フロントエンドエンジニアが初めてこのコードを読む際のメンタルモデルを構築するためのガイド。
> 「このコードは何をしているのか」「この変数は何のためにあるのか」を順を追って解説する。

---

## 読み始める前に：ファイル全体の地図

このファイルは大きく3層に分かれている。

```
Layer 1: インフラ（全コンポーネントが共有する基盤）
  - 定数・型定義
  - カスタムHooks（useAsRef, useLazyRef）
  - カスタムStore（createStore）
  - Context群（StoreContext, FileUploadContext）
  - useStore フック

Layer 2: ルートコンポーネント（FileUploadRoot）
  - 全状態の管理中枢
  - バリデーションロジック
  - アップロード処理

Layer 3: 子コンポーネント群
  - FileUploadDropzone     … ドロップエリア
  - FileUploadTrigger      … ダイアログ起動ボタン
  - FileUploadList         … ファイル一覧
  - FileUploadItem         … 個別ファイル行
  - FileUploadItemPreview  … サムネイル / アイコン
  - FileUploadItemMetadata … ファイル名・サイズ・エラー
  - FileUploadItemDelete   … 個別削除ボタン
```

**読む順番**: Layer 1 → Layer 2 → Layer 3 の順に読むとロジックの流れが把握しやすい。

---

## Layer 1: インフラ（L.16〜L.269）

### 1-1. 定数群（L.16〜L.38）

```ts
const ROOT_NAME = "FileUpload";
const DROPZONE_NAME = "FileUploadDropzone";
// ... 各コンポーネント名

const FILE_UPLOAD_ERRORS = {
  [ROOT_NAME]: `\`FileUpload\` must be used as root component`,
  [DROPZONE_NAME]: `\`FileUploadDropzone\` must be within \`FileUpload\``,
  // ...
} as const;
```

**なぜ文字列を定数にするのか**
エラーメッセージの中でコンポーネント名を参照するとき、文字列リテラルを直接書くと
コンポーネント名を変えたときに漏れが生じる。定数化することで一箇所の変更で済む。

`FILE_UPLOAD_ERRORS` は「コンポーネントが間違った場所に使われたとき」の
開発者向けエラーメッセージ集。型は `keyof typeof FILE_UPLOAD_ERRORS` で
コンポーネント名のunion型になる。

---

### 1-2. カスタムHooks（L.40〜L.57）

#### `useIsomorphicLayoutEffect`（L.40〜L.41）

```ts
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;
```

**問題**: `useLayoutEffect` はSSR（サーバーサイドレンダリング）環境では動作せず、
警告が出る。
**解決策**: ブラウザ環境なら `useLayoutEffect`、サーバー環境なら `useEffect` に切り替える。
`"use client"` が付いているので理論上は常にブラウザだが、SSR互換の安全策として記述されている。

---

#### `useAsRef<T>(data: T)`（L.43〜L.49）

```ts
function useAsRef<T>(data: T) {
  const ref = React.useRef<T>(data);
  useIsomorphicLayoutEffect(() => {
    ref.current = data;
  });
  return ref;
}
```

**問題: stale closure（古いクロージャ）**
`useCallback` でイベントハンドラをメモ化すると、その中で参照している変数が
古い値に固定されてしまうことがある（stale closure問題）。

```ts
// 悪い例
const onClick = useCallback(() => {
  // onFileReject はレンダリング時点の値に固定される
  props.onFileReject?.(file, message);
}, []); // 依存配列が空
```

**解決策**: Refに最新の値を同期させ、コールバック内ではRefを経由して参照する。

```ts
const propsRef = useAsRef(props); // レンダリングのたびに ref.current を更新

const onClick = useCallback(() => {
  propsRef.current.onFileReject?.(file, message); // 常に最新のpropsを参照
}, [propsRef]); // RefオブジェクトはReactが安定性を保証するので依存に含めなくていい
```

**`useLayoutEffect` を使う理由**: `useEffect` より前（ペイントより前）に実行されるため、
新しいpropsがレンダリングに反映された直後にRefを更新できる。

---

#### `useLazyRef<T>(fn: () => T)`（L.51〜L.57）

```ts
function useLazyRef<T>(fn: () => T) {
  const ref = React.useRef<T | null>(null);
  if (ref.current === null) {
    ref.current = fn();
  }
  return ref as React.RefObject<T>;
}
```

**問題**: `useRef(initialValue)` は毎レンダリングで `initialValue` の式を評価する。
`new Map()` や `new Set()` は軽いが、コストが高い初期化を避けたい場合がある。

**解決策**: 初回レンダリング時（`ref.current === null` のとき）だけ初期化関数 `fn` を実行する。
`useState(() => new Map())` の lazy initial state と同じ発想だが、Refなので再レンダリングをトリガーしない。

このHookはファイルで2箇所使われている:
- `useLazyRef(() => new Set<() => void>())` — Storeのリスナー集合
- `useLazyRef<Map<File, FileState>>(() => new Map())` — ファイルのMap

---

### 1-3. 型定義（L.68〜L.90）

#### `FileState`（L.68〜L.73）

```ts
interface FileState {
  file: File;         // ブラウザネイティブのFileオブジェクト
  progress: number;   // アップロード進捗 0〜100
  error?: string;     // エラーメッセージ（なければundefined）
  status: "idle" | "uploading" | "error" | "success";
}
```

各ファイル1件分の状態。`file` を持つのは、MapのKeyからStateを引いたとき
`file` を再取得しなくて済むようにするため（利便性）。

**status の状態遷移**:
```
idle → uploading → success
                 → error
```

---

#### `StoreState`（L.75〜L.79）

```ts
interface StoreState {
  files: Map<File, FileState>;  // ファイル全件の状態（FileオブジェクトをキーにしたMap）
  dragOver: boolean;            // ドラッグ中かどうか（UIのハイライト制御用）
  invalid: boolean;             // バリデーションエラー中かどうか（2秒間trueになる）
}
```

`Map<File, FileState>` を使う理由:
- 配列（`FileState[]`）ではなくMapを使うことで、`O(1)` でファイルの状態を取得できる
- `File` オブジェクトの参照をキーにするので、同名・同サイズでも別オブジェクトなら別エントリになる
- 「削除」も `Map.delete(file)` で `O(1)`

---

#### `StoreAction`（L.81〜L.90）

```ts
type StoreAction =
  | { variant: "ADD_FILES"; files: File[] }     // ファイルを追加（既存は維持）
  | { variant: "SET_FILES"; files: File[] }     // ファイル一覧を置き換え（Controlledモード）
  | { variant: "SET_PROGRESS"; file: File; progress: number }
  | { variant: "SET_SUCCESS"; file: File }
  | { variant: "SET_ERROR"; file: File; error: string }
  | { variant: "REMOVE_FILE"; file: File }      // 個別削除
  | { variant: "SET_DRAG_OVER"; dragOver: boolean }
  | { variant: "SET_INVALID"; invalid: boolean }
  | { variant: "CLEAR" };                        // 全クリア
```

Redux の Action と同じパターン。`type` ではなく `variant` を使っているのは
開発者の好みによる差異で、機能的な違いはない。

---

### 1-4. `createStore`（L.92〜L.233）

このファイルの心臓部。React の `useState` を使わず、**外部Store**として設計されている。

```ts
function createStore(
  listeners: Set<() => void>,        // 変化を通知するリスナー集合
  files: Map<File, FileState>,       // ファイルのMap（外から参照を受け取る）
  onValueChange?: (files: File[]) => void,  // Storeが変化したとき親に通知するコールバック
  invalid?: boolean,                 // 初期のinvalid状態
)
```

**なぜ `useState` を使わないのか**

`Map` はミュータブル（中身を変えても参照は同じ）なデータ構造。
Reactの再レンダリングは「前回と今回の値が参照レベルで異なるとき」に発生する。

```ts
// useState ではこうなってしまう
const [files, setFiles] = useState(new Map());
files.set(newFile, newState);     // Mapを変更しても...
setFiles(files);                  // 参照が同じなので再レンダリングされない！
setFiles(new Map(files));         // こうすれば再レンダリングされるが、全件コピーになる
```

外部StoreとRe-renderを `useSyncExternalStore` で繋げば、
「このMapの中身が変わった」ことを確実にReactに伝えられる。

**Storeのインターフェース**:
```
getState()        → 現在のstateを返す（Reactのレンダリングサイクル外から呼べる）
dispatch(action)  → stateを更新し、すべてのlistenerに通知
subscribe(fn)     → listenerを登録し、解除関数を返す
```

**`ADD_FILES` vs `SET_FILES`**:
- `ADD_FILES`: 既存ファイルを保持したまま新しいファイルを追加（Uncontrolledモード用）
- `SET_FILES`: 親から渡された `value` と内部Mapを同期させる（Controlledモード用）

`SET_FILES` がSmart Diffを行う点に注目:
```ts
case "SET_FILES": {
  const newFileSet = new Set(action.files);
  // 1. 新しいリストにないファイルを削除
  for (const existingFile of files.keys()) {
    if (!newFileSet.has(existingFile)) files.delete(existingFile);
  }
  // 2. 新しいファイルのうち、まだStateがないものだけ追加
  for (const file of action.files) {
    const existingState = files.get(file);
    if (!existingState) {
      files.set(file, { file, progress: 0, status: "idle" });
    }
    // 既存ファイルのStateは維持（progressやstatusが保持される）
  }
}
```
これにより、Controlledモードでも**アップロード中のファイルの進捗状態が保持される**。

---

### 1-5. Context群（L.235〜L.291）

#### `StoreContext`（L.235〜L.246）

```ts
const StoreContext = React.createContext<ReturnType<typeof createStore> | null>(null);

function useStoreContext(name) {
  const context = React.useContext(StoreContext);
  if (!context) throw new Error(FILE_UPLOAD_ERRORS[name]);
  return context;
}
```

**Storeインスタンス**（`{getState, dispatch, subscribe}` オブジェクト）を渡す。
Storeの「状態」ではなく「Storeへの窓口」を渡していることに注意。
Storeインスタンス自体は変わらないので、このContextを読んでも再レンダリングは起きない。

---

#### `useStore<T>` フック（L.248〜L.269）

```ts
function useStore<T>(selector: (state: StoreState) => T): T {
  const store = useStoreContext(ROOT_NAME);

  const lastValueRef = useLazyRef<{ value: T; state: StoreState } | null>(() => null);

  const getSnapshot = React.useCallback(() => {
    const state = store.getState();
    const prevValue = lastValueRef.current;

    // stateオブジェクトの参照が変わっていなければ前回の選択値をそのまま返す
    if (prevValue && prevValue.state === state) {
      return prevValue.value;
    }

    const nextValue = selector(state);
    lastValueRef.current = { value: nextValue, state };
    return nextValue;
  }, [store, selector, lastValueRef]);

  return React.useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}
```

**`selector` 関数**で「Storeのどの値を購読するか」を指定する。
これにより**必要な値だけが変化したときにのみ**再レンダリングが起きる。

```ts
// dragOverが変わったときだけDropzoneが再レンダリング
const dragOver = useStore((state) => state.dragOver);

// 特定ファイルのstateが変わったときだけItemが再レンダリング
const fileState = useStore((state) => state.files.get(value));
```

**`lastValueRef` の役割**: `useSyncExternalStore` はレンダリングのたびに `getSnapshot` を呼ぶ。
毎回 `selector(state)` を実行するのを避けるため、「前回のstate参照」と「前回の選択値」をキャッシュしている。
stateオブジェクトの参照（`===`）が同じなら内容も変わっていないと判断できるので、前回の値を返す。

---

#### `FileUploadContext`（L.271〜L.291）

```ts
interface FileUploadContextValue {
  inputId: string;      // <input>のid属性（ARIA用）
  dropzoneId: string;   // <Dropzone>のid属性（ARIA用）
  listId: string;       // <List>のid属性（ARIA用）
  labelId: string;      // ラベルspanのid属性（ARIA用）
  disabled: boolean;    // 全体の無効状態
  dir: Direction;       // テキスト方向（ltr/rtl）
  inputRef: React.RefObject<HTMLInputElement | null>;  // 非表示inputへの参照
}
```

StoreContextと分離されている理由:
- これらの値は**めったに変わらない静的な値**
- StoreContextと同じContextにまとめると、Store変化のたびにこれらの値も再計算される

`inputRef` がここにある理由: 非表示の `<input type="file">` は `FileUploadRoot` が所有しているが、
`Dropzone` や `Trigger` からも `inputRef.current.click()` でクリックを発火させる必要がある。
Contextを通じてRefを共有することで、親への参照なしに操作できる。

---

## Layer 2: `FileUploadRoot`（L.293〜L.619）

### 責務

すべての状態・ロジック・コールバックを管理する**コンテナコンポーネント**。
UIは持たず、3つのContextプロバイダと非表示の `<input>` をレンダリングするだけ。

---

### Props

```ts
interface FileUploadRootProps {
  // ── Controlled / Uncontrolled ──
  value?: File[];                      // Controlled: 親が管理するファイル一覧
  defaultValue?: File[];               // Uncontrolled: 初期値
  onValueChange?: (files: File[]) => void;  // ファイル一覧が変化したとき

  // ── イベントコールバック ──
  onAccept?: (files: File[]) => void;            // バリデーション通過したファイル（まとめて）
  onFileAccept?: (file: File) => void;           // バリデーション通過したファイル（1件ずつ）
  onFileReject?: (file: File, message: string) => void;  // 拒否されたファイル
  onFileValidate?: (file: File) => string | null | undefined;  // カスタムバリデーション

  // ── アップロード ──
  onUpload?: (files, { onProgress, onSuccess, onError }) => Promise<void> | void;
  // ↑ このcallbackを渡すとアップロード処理が自動実行される

  // ── バリデーションルール ──
  accept?: string;     // MIMEタイプ or 拡張子（例: "image/*,.pdf"）
  maxFiles?: number;   // 最大ファイル数
  maxSize?: number;    // 最大ファイルサイズ（バイト）

  // ── その他 ──
  dir?: "ltr" | "rtl";
  label?: string;      // スクリーンリーダー用のラベル
  name?: string;       // <input name>属性（フォーム送信用）
  asChild?: boolean;   // Radix Slot: 子要素をルート要素として使う
  disabled?: boolean;
  invalid?: boolean;   // 外部からエラー状態を強制する
  multiple?: boolean;  // 複数ファイル選択を許可
  required?: boolean;  // フォームのrequired属性
}
```

**`onUpload` の設計**:
```ts
onUpload?: (
  files: File[],
  options: {
    onProgress: (file: File, progress: number) => void,
    onSuccess: (file: File) => void,
    onError: (file: File, error: Error) => void,
  }
) => Promise<void> | void
```
`onUpload` を受け取るだけでなく、進捗・成功・エラーの**コールバックをオプションとして提供する**。
これにより、コンポーネント側がアップロード状態を管理でき、利用者はアップロードロジックに集中できる。

---

### 内部変数・状態

```ts
const inputId    = React.useId();   // <input> の id（ARIA: aria-labelledby / aria-controls）
const dropzoneId = React.useId();   // <Dropzone> の id（ARIA: aria-describedby）
const listId     = React.useId();   // <List> の id（ARIA: aria-controls）
const labelId    = React.useId();   // sr-only <span> の id（ARIA: aria-labelledby）
```
`useId` は同一コンポーネントが複数マウントされても**ユニークなIDを生成**する。
これらのIDはコンポーネント間の ARIA 関連付けに使われる（後述）。

```ts
const dir = useDirection(dirProp);
```
`DirectionContext` から値を取るか、propが直接指定されていればそちらを優先。

```ts
const propsRef = useAsRef(props);
```
`onFilesChange` や `onFilesUpload` から `props.onFileReject` 等を参照するために使う。
`useCallback` の依存配列に `props` を入れると、propsが変わるたびに関数が再生成される問題を回避。

```ts
const listeners = useLazyRef(() => new Set<() => void>()).current;
const files     = useLazyRef<Map<File, FileState>>(() => new Map()).current;
```
`listeners` と `files` は `createStore` に渡す参照。
**コンポーネントのライフサイクル全体で同じ参照を維持するため** に `useLazyRef` を使っている。
もし `useState(new Set())` で作ると、再レンダリング時に `createStore` が再実行されてしまう。

```ts
const inputRef = React.useRef<HTMLInputElement>(null);
```
非表示の `<input type="file">` への参照。`Dropzone` や `Trigger` が `.click()` を呼ぶ。

```ts
const isControlled = value !== undefined;
```
`value` propがあれば **Controlled モード**、なければ **Uncontrolled モード**。

---

### ロジック

#### useEffect: Controlled / Uncontrolled の同期（L.383〜L.393）

```ts
React.useEffect(() => {
  if (isControlled) {
    store.dispatch({ variant: "SET_FILES", files: value });
  } else if (defaultValue && defaultValue.length > 0 && !store.getState().files.size) {
    store.dispatch({ variant: "SET_FILES", files: defaultValue });
  }
}, [value, defaultValue, isControlled, store]);
```

- **Controlled**: `value` が変わるたびにStoreを同期（Smart Diff付きなので進捗は保持）
- **Uncontrolled**: Storeが空のときだけ `defaultValue` を適用する（一度適用したら親は干渉しない）

---

#### `onFilesChange`: バリデーションの中心（L.395〜L.521）

ファイルが追加されるたびに呼ばれる。バリデーションの順序:

```
Step 1: maxFiles チェック
   ├─ 現在のファイル数 + 新規ファイル数 > maxFiles なら
   │   超過分を先頭から切り落とし（先に選んだ方を優先）
   └─ 切り落としたファイルは onFileReject に通知

Step 2: 個別ファイルのバリデーション（filesToProcess の各ファイルに対して）
   ├─ onFileValidate（カスタム）→ 文字列を返したらreject
   ├─ accept チェック（MIME / ワイルドカード / 拡張子）
   └─ maxSize チェック

Step 3: 結果の処理
   ├─ invalid が true なら SET_INVALID → 2秒後に false へリセット
   └─ acceptedFiles があれば
       ├─ ADD_FILES でStoreに追加
       ├─ onAccept / onFileAccept を呼ぶ
       └─ onUpload があれば requestAnimationFrame 後にアップロード開始
```

**`requestAnimationFrame` の理由**:
```ts
if (propsRef.current.onUpload) {
  requestAnimationFrame(() => {
    onFilesUpload(acceptedFiles);
  });
}
```
`ADD_FILES` のdispatch直後にアップロードを開始すると、Storeの変化をReactが反映する前に
アップロードが始まる可能性がある。`rAF` で1フレーム遅らせ、UIの更新後に開始する。

**`accept` のパース**（L.448〜L.467）:
```ts
// "image/*,.pdf,video/mp4" → ["image/*", ".pdf", "video/mp4"] に分割
const acceptTypes = propsRef.current.accept.split(",").map((t) => t.trim());

// 一致パターン:
//   "video/mp4"   → 完全一致（fileType === type）
//   ".pdf"        → 拡張子一致（fileExtension === type）
//   "image/*"     → ワイルドカード（fileType.startsWith("image/")）
```

---

#### `onFilesUpload`: アップロード処理（L.523〜L.568）

```ts
const onFilesUpload = async (files: File[]) => {
  // 1. 全ファイルを "uploading" 状態に（progress=0）
  for (const file of files) {
    store.dispatch({ variant: "SET_PROGRESS", file, progress: 0 });
  }

  // 2. onUpload コールバックを呼び、進捗を追跡
  await propsRef.current.onUpload(files, {
    onProgress: (file, progress) => {
      store.dispatch({ variant: "SET_PROGRESS", file,
        progress: Math.min(Math.max(0, progress), 100) // 0〜100にクランプ
      });
    },
    onSuccess: (file) => store.dispatch({ variant: "SET_SUCCESS", file }),
    onError: (file, error) => store.dispatch({ variant: "SET_ERROR", file, error: error.message }),
  });

  // 3. onUpload が未定義なら即座に全ファイルをsuccess扱い
};
```

`onUpload` は非同期関数として設計されており、`await` で完了を待つ。
個別ファイルの進捗・成功・エラーは利用者が `onProgress` / `onSuccess` / `onError` を呼んで報告する。

---

#### `onInputChange`: inputのchangeイベント（L.570〜L.577）

```ts
const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(event.target.files ?? []);
  onFilesChange(files);
  event.target.value = "";  // ← ここが重要
};
```

**`event.target.value = ""`** の理由:
同じファイルを再度選択したとき、`<input>` の値が前回と同じなら `change` イベントが発火しない。
選択後にリセットすることで、**同じファイルを再選択しても `change` イベントが発火する**ようになる。

---

### レンダリング構造

```tsx
<DirectionContext.Provider value={dir}>
  <StoreContext.Provider value={store}>
    <FileUploadContext.Provider value={contextValue}>
      <RootPrimitive>   {/* "div" or Slot */}
        {children}       {/* Dropzone, List 等 */}

        {/* 非表示のネイティブfile input */}
        <input type="file" className="sr-only" onChange={onInputChange} />

        {/* スクリーンリーダー用ラベル */}
        <span id={labelId} className="sr-only">
          {label ?? "File upload"}
        </span>
      </RootPrimitive>
    </FileUploadContext.Provider>
  </StoreContext.Provider>
</DirectionContext.Provider>
```

`<input type="file">` が `sr-only`（視覚的に非表示）な理由:
ネイティブのfile inputはスタイリングが難しいため、UIは `Dropzone` と `Trigger` で代替し、
実際のファイル選択は非表示 input の `.click()` をプログラム的に呼んで行う。

---

## Layer 3: 子コンポーネント

---

## 2. `FileUploadDropzone`（L.621〜L.762）

### 責務

ファイルをドラッグ&ドロップで受け付けるエリア。クリックでもファイル選択ダイアログが開く。
**状態を自分では持たず、すべてStoreから読み書きする**。

### 購読している状態

```ts
const dragOver = useStore((state) => state.dragOver);
// → data-dragging 属性 → CSS でボーダーが青くなる

const invalid  = useStore((state) => state.invalid);
// → data-invalid 属性 → CSS でボーダーが赤くなる（2秒間）
```

### ロジック

#### `onClick`（L.638〜L.655）

```ts
const onClick = (event) => {
  propsRef.current?.onClick?.(event);
  if (event.defaultPrevented) return;

  const isFromTrigger = target.closest('[data-slot="file-upload-trigger"]');
  if (!isFromTrigger) {
    context.inputRef.current?.click();
  }
};
```

**`isFromTrigger` チェックの理由**:
`FileUploadTrigger` を Dropzone の中に置くと、Triggerのクリックイベントが
バブリングして Dropzone の onClick も発火し、inputの `.click()` が2回呼ばれてしまう。
`[data-slot="file-upload-trigger"]` を持つ祖先要素からのクリックなら何もしない。

#### `onDragOver / onDragEnter`（L.657〜L.678）

```ts
event.preventDefault(); // ← これがないとブラウザがファイルを直接開いてしまう
store.dispatch({ variant: "SET_DRAG_OVER", dragOver: true });
```

`onDragOver` でのデフォルト防止は**必須**。これがないと `onDrop` が発火しない。

#### `onDrop`（L.693〜L.715）

```ts
const onDrop = (event) => {
  event.preventDefault();
  store.dispatch({ variant: "SET_DRAG_OVER", dragOver: false });

  const files = Array.from(event.dataTransfer.files);
  const inputElement = context.inputRef.current;

  // DataTransferを使って input.files に設定
  const dataTransfer = new DataTransfer();
  for (const file of files) dataTransfer.items.add(file);

  inputElement.files = dataTransfer.files;
  inputElement.dispatchEvent(new Event("change", { bubbles: true }));
};
```

**なぜ `DataTransfer` を経由するのか**:
`input.files` は読み取り専用の `FileList` 型で、直接代入できない。
`DataTransfer` オブジェクトを介することで、ドロップされたファイルを `input.files` に設定できる。

**`new Event("change", { bubbles: true })` の理由**:
`files` を設定しても `change` イベントは自動発火しない。手動でイベントを作成・発火させることで
`onInputChange`（FileUploadRoot内）を経由してバリデーション処理に繋げる。
`{ bubbles: true }` でイベントが親要素に伝播する。

#### `onKeyDown`（L.717〜L.730）

```ts
if (event.key === "Enter" || event.key === " ") {
  event.preventDefault();
  context.inputRef.current?.click();
}
```

Dropzone は `tabIndex={0}` を持つ（フォーカス可能）ため、キーボード操作でもファイル選択できる。

### CSS状態属性

```
data-disabled=""   → pointer-events: none（クリック不可）
data-dragging=""   → border-color: primary（青いボーダー）
data-invalid=""    → border-color: destructive + ring（赤いボーダー+光輪）
```

---

## 3. `FileUploadTrigger`（L.764〜L.803）

### 責務

クリックでファイル選択ダイアログを開くボタン。Dropzone内部で使うことが多い。

### 核心ロジック

```ts
const onClick = (event) => {
  propsRef.current?.onClick?.(event);
  if (event.defaultPrevented) return;
  context.inputRef.current?.click();  // 非表示inputをクリック
};
```

非常にシンプル。本質的には「非表示 input の代理クリックボタン」。

```tsx
<TriggerPrimitive
  data-slot="file-upload-trigger"  // ← Dropzoneのクリックと区別するためのマーカー
  aria-controls={context.inputId}  // 「このボタンはinputを制御する」
  disabled={context.disabled}      // Rootがdisabledなら自動的に無効化
/>
```

`data-slot="file-upload-trigger"` は **Dropzone の onClick でのフィルタリングに使われる**
識別子。UIとしての役割よりも、コンポーネント間の通信に使われている。

---

## 4. `FileUploadList`（L.805〜L.850）

### 責務

選択済みファイルの一覧コンテナ。ファイルが0件のときは自動的に非表示になる。

### 核心ロジック

```ts
const shouldRender = forceMount || useStore((state) => state.files.size > 0);

if (!shouldRender) return null;
```

**`forceMount`**: `true` にすると常にレンダリングする。
アニメーションライブラリ（Framer Motion等）を使って表示/非表示をアニメーションしたい場合、
`return null` では困る（DOMから消えてしまうとアニメーションが中断される）。
`forceMount` で DOM に残したまま CSS でアニメーションを制御できる。

**CSS アニメーション**:
```
data-state="active"   → animate-in fade-in-0 slide-in-from-top-2
data-state="inactive" → animate-out fade-out-0 slide-out-to-top-2
```
Tailwind CSS の `tw-animate-css` による出現・消去アニメーション。

**`orientation`**:
```
"vertical"   → flex-col gap-2（デフォルト: 縦並び）
"horizontal" → flex-row overflow-x-auto p-1.5（横並び + 横スクロール）
```

---

## 5. `FileUploadItem`（L.852〜L.948）

### 責務

個別ファイルの行コンポーネント。自身が `FileUploadItemContext` を作り、
子コンポーネント（Preview/Metadata/Delete）に情報を提供する。

### Props

```ts
interface FileUploadItemProps {
  value: File;    // 表示するFileオブジェクト（キー）
  asChild?: boolean;
}
```

`value` に `File` オブジェクトを渡すことで、Storeから対応する `FileState` を取得する。
`File` がMapのキーなので、**参照が一致するオブジェクト**を渡す必要がある（同名でも別オブジェクトはNG）。

### 内部変数

```ts
const id        = React.useId();       // このアイテムのid（アイテム全体のARIA用）
const statusId  = `${id}-status`;      // "ステータス読み上げ" span の id
const nameId    = `${id}-name`;        // ファイル名 span の id
const sizeId    = `${id}-size`;        // ファイルサイズ span の id
const messageId = `${id}-message`;     // エラーメッセージ span の id
```

これらはすべて `aria-describedby` / `aria-labelledby` で参照するためのID群。
`FileUploadItemContext` に入れて子コンポーネントに渡す。

```ts
const fileState  = useStore((state) => state.files.get(value));
// ↑ Storeからこのファイルの状態を取得。削除されるとundefinedになり→ null return

const fileCount  = useStore((state) => state.files.size);
// ↑ 全ファイル数（aria-setsize用：スクリーンリーダーが「X件中Y件目」と読み上げる）

const fileIndex  = useStore((state) => {
  const files = Array.from(state.files.keys());
  return files.indexOf(value) + 1;  // 1始まり
});
// ↑ このファイルが何番目か（aria-posinset用）
```

### 核心ロジック

```ts
if (!fileState) return null;
```
削除されたファイル（`REMOVE_FILE` dispatchされた後）は `files.get(value)` が `undefined` を返す。
このガードにより**自動的に DOM から消える**。

```ts
const statusText = fileState.error
  ? `Error: ${fileState.error}`
  : fileState.status === "uploading"
    ? `Uploading: ${fileState.progress}% complete`
    : fileState.status === "success"
      ? "Upload complete"
      : "Ready to upload";
```
スクリーンリーダー向けのステータステキスト。視覚的な進捗バーを読めないユーザー向け。

### CSS の特殊ロジック

```
has-[_[data-slot=file-upload-progress]]:flex-col
has-[_[data-slot=file-upload-progress]]:items-start
```
子孫に `FileUploadItemProgress`（`data-slot="file-upload-progress"`）があるとき、
**自動的にレイアウトを縦並びに切り替える**。
通常（横並び）: `[Preview] [Metadata] [Delete]`
進捗バーあり（縦並び）: `[Preview][Metadata][Delete]` → `─── Progress ───`

CSS の `:has()` セレクタを Tailwind で表現している。

---

## 6. `FileUploadItemPreview`（L.1012〜L.1072）

### 責務

ファイルのサムネイルまたはアイコンを表示する。

### ロジック

```ts
const isImage = itemContext.fileState?.file.type.startsWith("image/");

const onPreviewRender = (file: File) => {
  // 優先度1: render prop（カスタム）
  if (render) return render(file);

  // 優先度2: 画像ならサムネイル
  if (isImage) {
    return (
      <img
        src={URL.createObjectURL(file)}   // ローカルファイルのBlob URLを生成
        onLoad={(event) => {
          URL.revokeObjectURL(event.target.src);  // ← メモリリーク対策
        }}
      />
    );
  }

  // 優先度3: ファイル種別アイコン
  return getFileIcon(file);
};
```

**`URL.createObjectURL(file)`**:
ブラウザメモリ上にFile/Blobオブジェクトを参照するURLを生成する（`blob:http://...`形式）。
サーバーにアップロードしなくてもローカルで画像を表示できる。

**`URL.revokeObjectURL(url)`**:
`createObjectURL` で生成したURLは、ブラウザが参照カウントを管理するが
手動で `revokeObjectURL` することで**確実にメモリを解放**できる。
`onLoad` で発火するので、画像が表示された直後に解放している。

#### `getFileIcon`（L.957〜L.1010）

```ts
function getFileIcon(file: File): JSX.Element {
  const type = file.type;              // MIME type（例: "image/png"）
  const extension = file.name.split(".").pop()?.toLowerCase(); // 拡張子（例: "png"）

  // MIMEタイプでの判定（より確実）
  if (type.startsWith("video/")) return <FileVideoIcon />;
  if (type.startsWith("audio/")) return <FileAudioIcon />;

  // テキスト系はMIMEタイプ + 拡張子の両方でチェック
  if (type.startsWith("text/") || ["txt", "md", "rtf", "pdf"].includes(extension)) {
    return <FileTextIcon />;
  }

  // コード系は拡張子で判定（MIMEタイプが不定なため）
  if (["html", "css", "js", "jsx", "ts", "tsx", ...].includes(extension)) {
    return <FileCodeIcon />;
  }

  // ...
  return <FileIcon />; // フォールバック
}
```

**拡張子 vs MIMEタイプ**:
MIMEタイプは信頼性が高いが、すべてのファイルに設定されているわけではない（特にコード系）。
拡張子はユーザーが変更できるが、実用上は十分。両方を組み合わせて判定している。

---

## 7. `FileUploadItemMetadata`（L.1074〜L.1127）

### 責務

ファイル名・サイズ・エラーメッセージを表示する。デフォルトの表示を `children` で上書き可能。

### ロジック

```ts
{children ?? (
  // children がなければデフォルトのメタデータ表示
  <>
    <span id={itemContext.nameId}>       {/* ARIA: aria-labelledby のターゲット */}
      {itemContext.fileState.file.name}
    </span>
    <span id={itemContext.sizeId}>       {/* ARIA: aria-describedby のターゲット */}
      {formatBytes(itemContext.fileState.file.size)}
    </span>
    {itemContext.fileState.error && (
      <span id={itemContext.messageId}>  {/* ARIA: エラー時のみ aria-describedby に含まれる */}
        {itemContext.fileState.error}
      </span>
    )}
  </>
)}
```

**`??`（Nullish Coalescing）**: `children` が `undefined` または `null` のときだけデフォルトを使う。
空文字や `false` の場合はデフォルトにフォールバックしない（`||` との違い）。

**`formatBytes`（L.950〜L.955）**:
```ts
function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  // i=0: B, i=1: KB, i=2: MB, ...
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${sizes[i]}`;
  //                                  ↑ Bのときは小数点なし（"512 B"）
  //                                    それ以外は小数点1桁（"1.5 MB"）
}
```

---

## 8. `FileUploadItemDelete`（L.1228〜L.1273）

### 責務

個別ファイルを削除するボタン。クリックすると `REMOVE_FILE` を dispatch する。

### ロジック

```ts
const onClick = (event) => {
  propsRef.current?.onClick?.(event);    // 利用者のクリックハンドラを先に呼ぶ
  if (!itemContext.fileState || event.defaultPrevented) return;
  // ↑ event.preventDefault() で削除をキャンセルできる

  store.dispatch({
    variant: "REMOVE_FILE",
    file: itemContext.fileState.file,
  });
};
```

**`event.defaultPrevented` チェック**:
利用者が `onClick` ハンドラ内で `event.preventDefault()` を呼ぶことで、
**削除処理をキャンセルできる**設計になっている（例: 確認ダイアログを挟む場合）。

```tsx
<ItemDeletePrimitive
  aria-controls={itemContext.id}       // 「このボタンはアイテムを制御する」
  aria-describedby={itemContext.nameId} // 「どのファイルの削除ボタンか」
/>
```

---

## 補足: 共通パターン `asChild`

ほぼすべてのコンポーネントが持つ `asChild` prop。

```ts
const ComponentPrimitive = asChild ? Slot : "button"; // or "div"

return <ComponentPrimitive ... />;
```

**`Slot`（Radix UI）の動作**:
```tsx
// asChild=false（デフォルト）
<FileUploadTrigger>クリック</FileUploadTrigger>
// → <button data-slot="file-upload-trigger" onClick={...}>クリック</button>

// asChild=true
<FileUploadTrigger asChild>
  <MyButton variant="outline">クリック</MyButton>
</FileUploadTrigger>
// → <MyButton data-slot="file-upload-trigger" onClick={...} variant="outline">クリック</MyButton>
// ↑ FileUploadTrigger のprops（onClick等）が MyButton にマージされる
```

これにより任意のコンポーネントや要素にファイルアップロードのロジックを付与できる。

---

## 共通パターン: `event.defaultPrevented` チェック

すべてのイベントハンドラが同じ構造を持つ:

```ts
const onSomeEvent = (event) => {
  propsRef.current?.onSomeEvent?.(event);  // 1. 利用者のハンドラを先に呼ぶ
  if (event.defaultPrevented) return;       // 2. preventDefault() されたなら何もしない
  // 3. 本来の処理
};
```

このパターンにより **利用者が任意のイベントをキャンセルできる**。
Radix UI のコンポーネント設計のベストプラクティスに従っている。

---

## ARIAの全体像

コンポーネント間のARIA関連付けを図示する。

```
<FileUploadRoot>
  <span id={labelId} class="sr-only">File upload</span>   ← ラベル
  <input
    id={inputId}
    aria-labelledby={labelId}     ← labelId のspanがラベル
    aria-describedby={dropzoneId} ← Dropzoneで操作する
  />

  <FileUploadDropzone
    id={dropzoneId}
    role="region"
    aria-controls="{inputId} {listId}"  ← inputとlistを制御
    aria-disabled={disabled}
    aria-invalid={invalid}
  >
    <FileUploadTrigger aria-controls={inputId} />
  </FileUploadDropzone>

  <FileUploadList id={listId} role="list">
    <FileUploadItem
      role="listitem"
      id={itemId}
      aria-setsize={fileCount}    ← 全件数
      aria-posinset={fileIndex}   ← 何番目か
      aria-labelledby={nameId}    ← ファイル名がラベル
      aria-describedby="{nameId} {sizeId} {statusId} [{messageId}]"
    >
      <span id={nameId}>file.png</span>
      <span id={sizeId}>1.2 MB</span>
      <span id={statusId} class="sr-only">Uploading: 45% complete</span>
      <span id={messageId}>File too large</span>  ← エラー時のみ

      <FileUploadItemDelete
        aria-controls={itemId}   ← このアイテムを制御
        aria-describedby={nameId}← どのファイルか説明
      />
    </FileUploadItem>
  </FileUploadList>
</FileUploadRoot>
```
