# drag-overlay

`isDragGlobal` を使って、ページ全体へのドラッグを検知し全画面オーバーレイを表示する。

## 基本的な使い方

```jsx
import { useDropzone } from 'react-dropzone';

function DropzoneWithOverlay() {
  const { getRootProps, getInputProps, isDragGlobal } = useDropzone();

  return (
    <div>
      <div {...getRootProps({ className: 'dropzone' })}>
        <input {...getInputProps()} />
        <p>ここにドロップ</p>
      </div>

      {/* Dropzone のすぐ隣にオーバーレイを配置する場合 */}
      {isDragGlobal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 255, 0.1)',
            zIndex: 9999,
          }}
        >
          Drop anywhere!
        </div>
      )}
    </div>
  );
}
```

`isDragGlobal` はページ全体へのドラッグ開始で `true` になる。
Dropzone 直下にオーバーレイを書くだけなら atom は不要。

## Jotai との組み合わせ

**パターン**: Write atom で橋渡しをカプセル化し、別コンポーネントのオーバーレイを制御する

```jsx
import { useEffect } from 'react';
import { atom, useAtomValue, useSetAtom } from 'jotai';
import { useDropzone } from 'react-dropzone';

// --- atom 定義 ---

const isDraggingGloballyAtom = atom(false);

// Write atom: 外部ライブラリの状態を Jotai に橋渡しするロジックをカプセル化する
// コンポーネントに useEffect + setAtom の組み合わせを直書きしない
const setDragStateAtom = atom(null, (_get, set, isDragging) => {
  set(isDraggingGloballyAtom, isDragging);
});

// --- コンポーネント ---

function DropzoneWithOverlaySignal() {
  const setDragState = useSetAtom(setDragStateAtom);
  const { getRootProps, getInputProps, isDragGlobal } = useDropzone();

  // useEffect は「外部ライブラリの状態 → Jotai atom への橋渡し」として唯一正当なパターン。
  // react-dropzone の isDragGlobal は Jotai の外にある React ローカル状態なので、
  // useEffect でしか同期できない。これは Jotai の設計を壊す例外ではなく、
  // 外部システムとの境界での正当な同期処理である。
  useEffect(() => {
    setDragState(isDragGlobal);
  }, [isDragGlobal, setDragState]);

  return (
    <div {...getRootProps({ className: 'dropzone' })}>
      <input {...getInputProps()} />
      <p>ここにドロップ</p>
    </div>
  );
}

// Dropzone と完全に別のコンポーネントツリーでオーバーレイを表示できる
// <body> 直下などポータルで描画する構成に適している
function GlobalDragOverlay() {
  const isDragging = useAtomValue(isDraggingGloballyAtom);
  if (!isDragging) return null;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 255, 0.1)',
        zIndex: 9999,
      }}
    >
      Drop anywhere!
    </div>
  );
}
```

**解説**:

- **`setDragStateAtom`** は Write-Only atom。`isDragGlobal` を atom に同期する責任をこの atom に閉じ込める。コンポーネントは「何を同期するか」ではなく「同期する」という行為だけを知っていればよい。
- **`useEffect` + atom の組み合わせは、外部ライブラリ状態を Jotai に取り込む唯一の正当な手段**。`react-dropzone` の `isDragGlobal` は Jotai の管理外にある React のローカル状態なので、`useEffect` による同期は避けられない。これは Jotai の原則に反する「アンチパターン」ではなく、外部システムとの境界での正当な処理である。
- `isDragActive` / `isDragAccept` / `isDragReject` はドロップゾーン自身のスタイル変化に閉じるため atom 不要。
