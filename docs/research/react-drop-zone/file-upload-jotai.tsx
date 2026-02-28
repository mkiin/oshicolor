"use client";

/**
 * file-upload-jotai.tsx
 *
 * jotaiを使ってカスタムstoreを置き換えたファイルアップロードコンポーネント。
 * 元の file-upload.tsx との差分は以下の通り。
 *
 * 削除したもの:
 *   - createStore() 関数 (~170行)
 *   - StoreState / StoreAction 型
 *   - StoreContext / useStoreContext
 *   - useStore(selector) フック
 *   - useLazyRef (不要になった)
 *
 * 追加したもの:
 *   - filesAtom / dragOverAtom / invalidAtom
 *   - 各操作に対応するwrite atom
 *   - createUploadAtom ファクトリー
 *   - FileUploadSync コンポーネント（Controlledモード同期用）
 *
 * 必要な依存パッケージ:
 *   npm install jotai @radix-ui/react-slot lucide-react
 */

import { Slot } from "@radix-ui/react-slot";
import {
  type Atom,
  atom,
  createStore,
  Provider,
  useAtomValue,
  useSetAtom,
} from "jotai";
import { selectAtom } from "jotai/utils";
import {
  FileArchiveIcon,
  FileAudioIcon,
  FileCodeIcon,
  FileCogIcon,
  FileIcon,
  FileTextIcon,
  FileVideoIcon,
} from "lucide-react";
import * as React from "react";

// ─── ユーティリティ ────────────────────────────────────────────────────────

/** @/lib/utils の cn を inline で代替。本番では import { cn } from "@/lib/utils" を使う */
function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(" ");
}

// ─── コンポーネント名 / エラーメッセージ ──────────────────────────────────

const ROOT_NAME = "FileUpload";
const DROPZONE_NAME = "FileUploadDropzone";
const TRIGGER_NAME = "FileUploadTrigger";
const LIST_NAME = "FileUploadList";
const ITEM_NAME = "FileUploadItem";
const ITEM_PREVIEW_NAME = "FileUploadItemPreview";
const ITEM_METADATA_NAME = "FileUploadItemMetadata";
const ITEM_PROGRESS_NAME = "FileUploadItemProgress";
const ITEM_DELETE_NAME = "FileUploadItemDelete";
const CLEAR_NAME = "FileUploadClear";

const FILE_UPLOAD_ERRORS = {
  [ROOT_NAME]: `\`${ROOT_NAME}\` must be used as root component`,
  [DROPZONE_NAME]: `\`${DROPZONE_NAME}\` must be within \`${ROOT_NAME}\``,
  [TRIGGER_NAME]: `\`${TRIGGER_NAME}\` must be within \`${ROOT_NAME}\``,
  [LIST_NAME]: `\`${LIST_NAME}\` must be within \`${ROOT_NAME}\``,
  [ITEM_NAME]: `\`${ITEM_NAME}\` must be within \`${ROOT_NAME}\``,
  [ITEM_PREVIEW_NAME]: `\`${ITEM_PREVIEW_NAME}\` must be within \`${ITEM_NAME}\``,
  [ITEM_METADATA_NAME]: `\`${ITEM_METADATA_NAME}\` must be within \`${ITEM_NAME}\``,
  [ITEM_PROGRESS_NAME]: `\`${ITEM_PROGRESS_NAME}\` must be within \`${ITEM_NAME}\``,
  [ITEM_DELETE_NAME]: `\`${ITEM_DELETE_NAME}\` must be within \`${ITEM_NAME}\``,
  [CLEAR_NAME]: `\`${CLEAR_NAME}\` must be within \`${ROOT_NAME}\``,
} as const;

// ─── ユーティリティフック ─────────────────────────────────────────────────

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

/**
 * 最新の値を常にRefに保持するフック。stale closure を防ぐために使う。
 * useCallback / write atom の中から最新のコールバックを参照するためのパターン。
 */
function useAsRef<T>(data: T) {
  const ref = React.useRef<T>(data);
  useIsomorphicLayoutEffect(() => {
    ref.current = data;
  });
  return ref;
}

// ─── 型定義 ───────────────────────────────────────────────────────────────

type Direction = "ltr" | "rtl";

const DirectionContext = React.createContext<Direction | undefined>(undefined);

function useDirection(dirProp?: Direction): Direction {
  const contextDir = React.useContext(DirectionContext);
  return dirProp ?? contextDir ?? "ltr";
}

type FileState = {
  file: File;
  /** アップロード進捗 0〜100 */
  progress: number;
  error?: string;
  status: "idle" | "uploading" | "error" | "success";
};

// ─── atoms ────────────────────────────────────────────────────────────────
//
// これら3つが FileUpload コンポーネントの持つ状態の全体。
// デフォルトはグローバルstoreに紐付くが、FileUploadRoot が
// createStore() + Provider でインスタンスごとに分離する。

/** 選択済みファイルとそれぞれの状態。Mapのキーは File オブジェクト自体。 */
const filesAtom = atom<Map<File, FileState>>(new Map());

/** ドラッグ中かどうか */
const dragOverAtom = atom(false);

/** バリデーションエラーが発生し、2秒間 true になるフラグ */
const invalidAtom = atom(false);

// ─── write atoms（アクション） ────────────────────────────────────────────
//
// 重要: Map は参照型なので、必ず new Map(get(filesAtom)) でコピーを作ってから
// 変更し、set に渡すこと。参照が変わらないと jotai が変化を検知できない。

/** ファイルを追加する。既存のファイルはそのまま維持される */
const addFilesAtom = atom(null, (get, set, newFiles: File[]) => {
  const next = new Map(get(filesAtom));
  for (const file of newFiles) {
    if (!next.has(file)) {
      next.set(file, { file, progress: 0, status: "idle" });
    }
  }
  set(filesAtom, next);
});

/**
 * ファイル一覧を置き換える（Controlledモード用）。
 * 既存ファイルの progress / status は保持される（差分更新）。
 */
const setFilesAtom = atom(null, (get, set, newFiles: File[]) => {
  const current = get(filesAtom);
  const next = new Map<File, FileState>();
  for (const file of newFiles) {
    next.set(file, current.get(file) ?? { file, progress: 0, status: "idle" });
  }
  set(filesAtom, next);
});

/** 個別ファイルを削除する */
const removeFileAtom = atom(null, (get, set, file: File) => {
  const next = new Map(get(filesAtom));
  next.delete(file);
  set(filesAtom, next);
});

/** 全ファイルをクリアする */
const clearFilesAtom = atom(null, (_get, set) => {
  set(filesAtom, new Map());
  set(invalidAtom, false);
});

/** 指定ファイルの進捗を更新する */
const setProgressAtom = atom(
  null,
  (get, set, { file, progress }: { file: File; progress: number }) => {
    const next = new Map(get(filesAtom));
    const fileState = next.get(file);
    if (fileState) {
      next.set(file, {
        ...fileState,
        progress: Math.min(Math.max(0, progress), 100), // 0〜100 にクランプ
        status: "uploading",
      });
    }
    set(filesAtom, next);
  },
);

/** 指定ファイルを成功状態にする */
const setSuccessAtom = atom(null, (get, set, file: File) => {
  const next = new Map(get(filesAtom));
  const fileState = next.get(file);
  if (fileState) {
    next.set(file, { ...fileState, progress: 100, status: "success" });
  }
  set(filesAtom, next);
});

/** 指定ファイルをエラー状態にする */
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

// ─── 非同期 write atom ファクトリー ──────────────────────────────────────
//
// onUpload コールバックは props から渡されるため、stale closure を防ぐために
// Ref 経由で受け取る。atomFactory を使うことで、Ref をキャプチャできる。

type UploadOptions = {
  onProgress: (file: File, progress: number) => void;
  onSuccess: (file: File) => void;
  onError: (file: File, error: Error) => void;
};

type OnUploadFn =
  | ((files: File[], options: UploadOptions) => Promise<void> | void)
  | undefined;

/**
 * アップロード処理を行う write atom のファクトリー。
 * FileUploadRoot の useMemo 内で一度だけ作られ、onUploadRef を閉じ込める。
 */
const createUploadAtom = (onUploadRef: React.RefObject<OnUploadFn>) =>
  atom(null, async (get, set, files: File[]) => {
    if (!onUploadRef.current) {
      // onUpload が指定されていない場合は即座に成功扱い
      for (const file of files) {
        set(setSuccessAtom, file);
      }
      return;
    }

    // まず全ファイルを uploading 状態に
    const startMap = new Map(get(filesAtom));
    for (const file of files) {
      const s = startMap.get(file);
      if (s) startMap.set(file, { ...s, progress: 0, status: "uploading" });
    }
    set(filesAtom, startMap);

    try {
      await onUploadRef.current(files, {
        onProgress: (file, progress) => {
          set(setProgressAtom, { file, progress });
        },
        onSuccess: (file) => {
          set(setSuccessAtom, file);
        },
        onError: (file, error) => {
          set(setErrorAtom, { file, error: error.message ?? "Upload failed" });
        },
      });
    } catch (error) {
      // onUpload 全体で例外が起きた場合は全ファイルをエラーにする
      const message = error instanceof Error ? error.message : "Upload failed";
      const errorMap = new Map(get(filesAtom));
      for (const file of files) {
        const s = errorMap.get(file);
        if (s) errorMap.set(file, { ...s, error: message, status: "error" });
      }
      set(filesAtom, errorMap);
    }
  });

// ─── Context ──────────────────────────────────────────────────────────────

/** FileUploadRoot が子コンポーネントに渡す文脈 */
type FileUploadContextValue = {
  inputId: string;
  dropzoneId: string;
  listId: string;
  labelId: string;
  disabled: boolean;
  dir: Direction;
  inputRef: React.RefObject<HTMLInputElement | null>;
  /** このインスタンス専用の jotai store。子コンポーネントから atomに書き込む際に使う */
  jotaiStore: ReturnType<typeof createStore>;
  /** ファイルのアップロードを開始する関数。FileUploadRoot が提供する */
  uploadFiles: (files: File[]) => void;
};

const FileUploadContext = React.createContext<FileUploadContextValue | null>(
  null,
);

function useFileUploadContext(name: keyof typeof FILE_UPLOAD_ERRORS) {
  const context = React.useContext(FileUploadContext);
  if (!context) {
    throw new Error(FILE_UPLOAD_ERRORS[name]);
  }
  return context;
}

/** FileUploadItem が子コンポーネントに渡す文脈 */
type FileUploadItemContextValue = {
  id: string;
  file: File;
  nameId: string;
  sizeId: string;
  statusId: string;
  messageId: string;
};

const FileUploadItemContext =
  React.createContext<FileUploadItemContextValue | null>(null);

function useFileUploadItemContext(name: keyof typeof FILE_UPLOAD_ERRORS) {
  const context = React.useContext(FileUploadItemContext);
  if (!context) {
    throw new Error(FILE_UPLOAD_ERRORS[name]);
  }
  return context;
}

// ─── FileUploadRoot ───────────────────────────────────────────────────────

type FileUploadRootProps = Omit<
  React.ComponentPropsWithoutRef<"div">,
  "defaultValue" | "onChange"
> & {
  value?: File[];
  defaultValue?: File[];
  onValueChange?: (files: File[]) => void;
  onAccept?: (files: File[]) => void;
  onFileAccept?: (file: File) => void;
  onFileReject?: (file: File, message: string) => void;
  onFileValidate?: (file: File) => string | null | undefined;
  onUpload?: (
    files: File[],
    options: UploadOptions,
  ) => Promise<void> | void;
  accept?: string;
  maxFiles?: number;
  maxSize?: number;
  dir?: Direction;
  label?: string;
  name?: string;
  asChild?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  multiple?: boolean;
  required?: boolean;
};

const FileUploadRoot = React.forwardRef<HTMLDivElement, FileUploadRootProps>(
  (props, forwardedRef) => {
    const {
      value,
      defaultValue,
      onValueChange,
      onAccept,
      onFileAccept,
      onFileReject,
      onFileValidate,
      onUpload,
      accept,
      maxFiles,
      maxSize,
      dir: dirProp,
      label,
      name,
      asChild,
      disabled = false,
      invalid = false,
      multiple = false,
      required = false,
      children,
      className,
      ...rootProps
    } = props;

    const inputId = React.useId();
    const dropzoneId = React.useId();
    const listId = React.useId();
    const labelId = React.useId();

    const dir = useDirection(dirProp);
    const propsRef = useAsRef(props);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const isControlled = value !== undefined;

    // コンポーネントごとに独立した store を作成する。
    // useMemo で安定させ、再レンダリングのたびに store が作り直されるのを防ぐ。
    const jotaiStore = React.useMemo(() => {
      const store = createStore();

      // 初期ファイルを store に設定する
      const initialFiles = value ?? defaultValue ?? [];
      if (initialFiles.length > 0) {
        const map = new Map<File, FileState>();
        for (const file of initialFiles) {
          map.set(file, { file, progress: 0, status: "idle" });
        }
        store.set(filesAtom, map);
      }

      return store;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // 初回のみ: 以降の value 同期は FileUploadSync が担う

    // onUpload の stale closure を防ぐために Ref に保持する
    const onUploadRef = useAsRef(onUpload);

    // アップロード atom を一度だけ作成する（onUploadRef を閉じ込める）
    const uploadAtom = React.useMemo(
      () => createUploadAtom(onUploadRef),
      // onUploadRef は Ref なので deps に入れなくてよい
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [],
    );

    // ─── ファイル変化時に onValueChange を呼ぶ ──────────────────────────
    // jotaiStore の filesAtom を購読し、変化するたびに onValueChange を呼ぶ。
    // Ref 経由で最新の onValueChange を参照し、stale closure を防ぐ。
    const onValueChangeRef = useAsRef(onValueChange);
    React.useEffect(() => {
      return jotaiStore.sub(filesAtom, () => {
        const files = jotaiStore.get(filesAtom);
        const fileList = Array.from(files.values()).map((s) => s.file);
        onValueChangeRef.current?.(fileList);
      });
    }, [jotaiStore, onValueChangeRef]);

    // ─── バリデーション + ファイル追加 ───────────────────────────────────
    const onFilesChange = React.useCallback(
      (originalFiles: File[]) => {
        if (propsRef.current.disabled) return;

        let filesToProcess = [...originalFiles];
        let hasInvalid = false;

        // maxFiles チェック
        if (propsRef.current.maxFiles) {
          const currentCount = jotaiStore.get(filesAtom).size;
          const remainingSlotCount = Math.max(
            0,
            propsRef.current.maxFiles - currentCount,
          );

          if (remainingSlotCount < filesToProcess.length) {
            hasInvalid = true;
            const rejectedFiles = filesToProcess.slice(remainingSlotCount);
            filesToProcess = filesToProcess.slice(0, remainingSlotCount);

            for (const file of rejectedFiles) {
              const message = propsRef.current.onFileValidate?.(file)
                ?? `Maximum ${propsRef.current.maxFiles} files allowed`;
              propsRef.current.onFileReject?.(file, message);
            }
          }
        }

        const acceptedFiles: File[] = [];

        for (const file of filesToProcess) {
          let rejected = false;
          let rejectionMessage = "";

          // カスタムバリデーション
          if (propsRef.current.onFileValidate) {
            const msg = propsRef.current.onFileValidate(file);
            if (msg) {
              rejectionMessage = msg;
              rejected = true;
              hasInvalid = true;
            }
          }

          // MIMEタイプ / 拡張子チェック
          if (!rejected && propsRef.current.accept) {
            const acceptTypes = propsRef.current.accept
              .split(",")
              .map((t) => t.trim());
            const fileType = file.type;
            const fileExtension = `.${file.name.split(".").pop()}`;

            const isAccepted = acceptTypes.some(
              (type) =>
                type === fileType ||
                type === fileExtension ||
                (type.includes("/*") &&
                  fileType.startsWith(type.replace("/*", "/"))),
            );

            if (!isAccepted) {
              rejectionMessage = "File type not accepted";
              rejected = true;
              hasInvalid = true;
            }
          }

          // maxSize チェック
          if (!rejected && propsRef.current.maxSize && file.size > propsRef.current.maxSize) {
            rejectionMessage = "File too large";
            rejected = true;
            hasInvalid = true;
          }

          if (rejected) {
            propsRef.current.onFileReject?.(file, rejectionMessage);
          } else {
            acceptedFiles.push(file);
          }
        }

        // バリデーションエラー表示（2秒間）
        if (hasInvalid) {
          jotaiStore.set(invalidAtom, true);
          setTimeout(() => {
            jotaiStore.set(invalidAtom, false);
          }, 2000);
        }

        if (acceptedFiles.length > 0) {
          jotaiStore.set(addFilesAtom, acceptedFiles);

          propsRef.current.onAccept?.(acceptedFiles);
          for (const file of acceptedFiles) {
            propsRef.current.onFileAccept?.(file);
          }

          // アップロードを次フレームで開始（DOM更新を先に反映させる）
          if (propsRef.current.onUpload) {
            requestAnimationFrame(() => {
              jotaiStore.set(uploadAtom, acceptedFiles);
            });
          }
        }
      },
      [jotaiStore, uploadAtom, propsRef],
    );

    const onInputChange = React.useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);
        onFilesChange(files);
        event.target.value = ""; // 同じファイルを再選択できるようにリセット
      },
      [onFilesChange],
    );

    const contextValue = React.useMemo<FileUploadContextValue>(
      () => ({
        dropzoneId,
        inputId,
        listId,
        labelId,
        dir,
        disabled,
        inputRef,
        jotaiStore,
        uploadFiles: (files) => jotaiStore.set(uploadAtom, files),
      }),
      [dropzoneId, inputId, listId, labelId, dir, disabled, jotaiStore, uploadAtom],
    );

    const RootPrimitive = asChild ? Slot : "div";

    return (
      <DirectionContext.Provider value={dir}>
        {/* Provider でこのツリー内の atom 操作を jotaiStore に向ける */}
        <Provider store={jotaiStore}>
          <FileUploadContext.Provider value={contextValue}>
            {/* Controlled モードの同期コンポーネント */}
            <FileUploadSync value={value} />
            <RootPrimitive
              data-disabled={disabled ? "" : undefined}
              data-slot="file-upload"
              dir={dir}
              {...rootProps}
              ref={forwardedRef}
              className={cn("relative flex flex-col gap-2", className)}
            >
              {children}
              <input
                type="file"
                id={inputId}
                aria-labelledby={labelId}
                aria-describedby={dropzoneId}
                ref={inputRef}
                tabIndex={-1}
                accept={accept}
                name={name}
                disabled={disabled}
                multiple={multiple}
                required={required}
                className="sr-only"
                onChange={onInputChange}
              />
              <span id={labelId} className="sr-only">
                {label ?? "File upload"}
              </span>
            </RootPrimitive>
          </FileUploadContext.Provider>
        </Provider>
      </DirectionContext.Provider>
    );
  },
);
FileUploadRoot.displayName = ROOT_NAME;

// ─── FileUploadSync（内部コンポーネント） ────────────────────────────────
//
// Controlled モード（value prop が渡された場合）で、
// value が変化するたびに filesAtom を同期する。
// Provider の内側に置くことで jotaiStore に自動的に書き込まれる。

type FileUploadSyncProps = {
  value: File[] | undefined;
};

const FileUploadSync: React.FC<FileUploadSyncProps> = ({ value }) => {
  const setFiles = useSetAtom(setFilesAtom);

  React.useEffect(() => {
    if (value !== undefined) {
      setFiles(value);
    }
  }, [value, setFiles]);

  return null; // UI を持たない
};

// ─── FileUploadDropzone ───────────────────────────────────────────────────

type FileUploadDropzoneProps = React.ComponentPropsWithoutRef<"div"> & {
  asChild?: boolean;
};

const FileUploadDropzone = React.forwardRef<
  HTMLDivElement,
  FileUploadDropzoneProps
>((props, forwardedRef) => {
  const { asChild, className, ...dropzoneProps } = props;

  const context = useFileUploadContext(DROPZONE_NAME);
  const { jotaiStore } = context;

  // このコンポーネントが必要な状態だけを購読する
  const dragOver = useAtomValue(dragOverAtom);
  const invalid = useAtomValue(invalidAtom);

  const propsRef = useAsRef(dropzoneProps);

  const onClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      propsRef.current?.onClick?.(event);
      if (event.defaultPrevented) return;

      // FileUploadTrigger からのクリックは無視する（二重発火を防ぐ）
      const isFromTrigger =
        event.target instanceof HTMLElement &&
        event.target.closest('[data-slot="file-upload-trigger"]');
      if (!isFromTrigger) {
        context.inputRef.current?.click();
      }
    },
    [context.inputRef, propsRef],
  );

  const onDragOver = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      propsRef.current?.onDragOver?.(event);
      if (event.defaultPrevented) return;
      event.preventDefault(); // onDrop が発火するために必須
      jotaiStore.set(dragOverAtom, true);
    },
    [jotaiStore, propsRef],
  );

  const onDragEnter = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      propsRef.current?.onDragEnter?.(event);
      if (event.defaultPrevented) return;
      event.preventDefault();
      jotaiStore.set(dragOverAtom, true);
    },
    [jotaiStore, propsRef],
  );

  const onDragLeave = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      propsRef.current?.onDragLeave?.(event);
      if (event.defaultPrevented) return;
      event.preventDefault();
      jotaiStore.set(dragOverAtom, false);
    },
    [jotaiStore, propsRef],
  );

  const onDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      propsRef.current?.onDrop?.(event);
      if (event.defaultPrevented) return;

      event.preventDefault();
      jotaiStore.set(dragOverAtom, false);

      // DataTransfer API でドロップされたファイルを hidden input に渡し、
      // change イベントを発火させることで onInputChange を呼ぶ
      const files = Array.from(event.dataTransfer.files);
      const inputElement = context.inputRef.current;
      if (!inputElement) return;

      const dataTransfer = new DataTransfer();
      for (const file of files) {
        dataTransfer.items.add(file);
      }
      inputElement.files = dataTransfer.files;
      inputElement.dispatchEvent(new Event("change", { bubbles: true }));
    },
    [jotaiStore, context.inputRef, propsRef],
  );

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      propsRef.current?.onKeyDown?.(event);
      if (!event.defaultPrevented && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        context.inputRef.current?.click();
      }
    },
    [context.inputRef, propsRef],
  );

  const DropzonePrimitive = asChild ? Slot : "div";

  return (
    <DropzonePrimitive
      role="region"
      id={context.dropzoneId}
      aria-controls={`${context.inputId} ${context.listId}`}
      aria-disabled={context.disabled}
      aria-invalid={invalid}
      data-disabled={context.disabled ? "" : undefined}
      data-dragging={dragOver ? "" : undefined}
      data-invalid={invalid ? "" : undefined}
      data-slot="file-upload-dropzone"
      dir={context.dir}
      {...dropzoneProps}
      ref={forwardedRef}
      tabIndex={context.disabled ? undefined : 0}
      className={cn(
        "relative flex select-none flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 outline-none transition-colors hover:bg-accent/30 focus-visible:border-ring/50 data-[disabled]:pointer-events-none data-[dragging]:border-primary data-[invalid]:border-destructive data-[invalid]:ring-destructive/20",
        className,
      )}
      onClick={onClick}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onKeyDown={onKeyDown}
    />
  );
});
FileUploadDropzone.displayName = DROPZONE_NAME;

// ─── FileUploadTrigger ────────────────────────────────────────────────────

type FileUploadTriggerProps = React.ComponentPropsWithoutRef<"button"> & {
  asChild?: boolean;
};

const FileUploadTrigger = React.forwardRef<
  HTMLButtonElement,
  FileUploadTriggerProps
>((props, forwardedRef) => {
  const { asChild, ...triggerProps } = props;
  const context = useFileUploadContext(TRIGGER_NAME);
  const propsRef = useAsRef(triggerProps);

  const onClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      propsRef.current?.onClick?.(event);
      if (event.defaultPrevented) return;
      context.inputRef.current?.click();
    },
    [context.inputRef, propsRef],
  );

  const TriggerPrimitive = asChild ? Slot : "button";

  return (
    <TriggerPrimitive
      type="button"
      aria-controls={context.inputId}
      data-disabled={context.disabled ? "" : undefined}
      data-slot="file-upload-trigger"
      {...triggerProps}
      ref={forwardedRef}
      disabled={context.disabled}
      onClick={onClick}
    />
  );
});
FileUploadTrigger.displayName = TRIGGER_NAME;

// ─── FileUploadList ───────────────────────────────────────────────────────

type FileUploadListProps = React.ComponentPropsWithoutRef<"div"> & {
  orientation?: "horizontal" | "vertical";
  asChild?: boolean;
  forceMount?: boolean;
};

const FileUploadList = React.forwardRef<HTMLDivElement, FileUploadListProps>(
  (props, forwardedRef) => {
    const {
      className,
      orientation = "vertical",
      asChild,
      forceMount,
      ...listProps
    } = props;

    const context = useFileUploadContext(LIST_NAME);

    // files.size > 0 の部分だけを購読する。
    // ファイルが増減したときだけ再レンダリングが起きる。
    const hasFiles = useAtomValue(
      React.useMemo(() => selectAtom(filesAtom, (files) => files.size > 0), []),
    );

    const shouldRender = forceMount || hasFiles;
    if (!shouldRender) return null;

    const ListPrimitive = asChild ? Slot : "div";

    return (
      <ListPrimitive
        role="list"
        id={context.listId}
        aria-orientation={orientation}
        data-orientation={orientation}
        data-slot="file-upload-list"
        data-state={shouldRender ? "active" : "inactive"}
        dir={context.dir}
        {...listProps}
        ref={forwardedRef}
        className={cn(
          "data-[state=inactive]:fade-out-0 data-[state=active]:fade-in-0 data-[state=inactive]:slide-out-to-top-2 data-[state=active]:slide-in-from-top-2 flex flex-col gap-2 data-[state=active]:animate-in data-[state=inactive]:animate-out",
          orientation === "horizontal" && "flex-row overflow-x-auto p-1.5",
          className,
        )}
      />
    );
  },
);
FileUploadList.displayName = LIST_NAME;

// ─── FileUploadItem ───────────────────────────────────────────────────────

type FileUploadItemProps = React.ComponentPropsWithoutRef<"div"> & {
  value: File;
  asChild?: boolean;
};

const FileUploadItem = React.forwardRef<HTMLDivElement, FileUploadItemProps>(
  (props, forwardedRef) => {
    const { value: file, asChild, className, ...itemProps } = props;

    const id = React.useId();
    const statusId = `${id}-status`;
    const nameId = `${id}-name`;
    const sizeId = `${id}-size`;
    const messageId = `${id}-message`;

    const context = useFileUploadContext(ITEM_NAME);

    // このファイルの状態だけを購読する（他のファイルの更新で再レンダリングしない）
    const fileStateAtom = React.useMemo(
      () => selectAtom(filesAtom, (files) => files.get(file)),
      [file],
    );
    const fileState = useAtomValue(fileStateAtom);

    // ファイル一覧の中でのインデックス（ARIA用）
    const fileCountAtom = React.useMemo(
      () => selectAtom(filesAtom, (files) => files.size),
      [],
    );
    const fileIndexAtom = React.useMemo(
      () =>
        selectAtom(filesAtom, (files) => {
          const keys = Array.from(files.keys());
          return keys.indexOf(file) + 1;
        }),
      [file],
    );

    const fileCount = useAtomValue(fileCountAtom);
    const fileIndex = useAtomValue(fileIndexAtom);

    // ファイルが削除された場合は表示しない
    if (!fileState) return null;

    const statusText = fileState.error
      ? `Error: ${fileState.error}`
      : fileState.status === "uploading"
        ? `Uploading: ${fileState.progress}% complete`
        : fileState.status === "success"
          ? "Upload complete"
          : "Ready to upload";

    const itemContext: FileUploadItemContextValue = {
      id,
      file,
      nameId,
      sizeId,
      statusId,
      messageId,
    };

    const ItemPrimitive = asChild ? Slot : "div";

    return (
      <FileUploadItemContext.Provider value={itemContext}>
        <ItemPrimitive
          role="listitem"
          id={id}
          aria-setsize={fileCount}
          aria-posinset={fileIndex}
          aria-describedby={`${nameId} ${sizeId} ${statusId} ${fileState.error ? messageId : ""}`}
          aria-labelledby={nameId}
          data-slot="file-upload-item"
          dir={context.dir}
          {...itemProps}
          ref={forwardedRef}
          className={cn(
            "relative flex items-center gap-2.5 rounded-md border p-3 has-[_[data-slot=file-upload-progress]]:flex-col has-[_[data-slot=file-upload-progress]]:items-start",
            className,
          )}
        >
          {props.children}
          <span id={statusId} className="sr-only">
            {statusText}
          </span>
        </ItemPrimitive>
      </FileUploadItemContext.Provider>
    );
  },
);
FileUploadItem.displayName = ITEM_NAME;

// ─── FileUploadItemPreview ────────────────────────────────────────────────

// FileUploadItem の fileState は Context から取得するため、
// ItemPreview / ItemMetadata / ItemProgress / ItemDelete は
// useAtomValue を使わず useFileUploadItemContext を使う。
// （FileUploadItem が fileState を Context に入れているため）

type FileUploadItemPreviewProps = React.ComponentPropsWithoutRef<"div"> & {
  render?: (file: File) => React.ReactNode;
  asChild?: boolean;
};

function getFileIcon(file: File) {
  const type = file.type;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (type.startsWith("video/")) return <FileVideoIcon />;
  if (type.startsWith("audio/")) return <FileAudioIcon />;
  if (type.startsWith("text/") || ["txt", "md", "rtf", "pdf"].includes(extension))
    return <FileTextIcon />;
  if (
    ["html", "css", "js", "jsx", "ts", "tsx", "json", "xml", "php", "py", "rb", "java", "c", "cpp", "cs"].includes(
      extension,
    )
  )
    return <FileCodeIcon />;
  if (["zip", "rar", "7z", "tar", "gz", "bz2"].includes(extension))
    return <FileArchiveIcon />;
  if (["exe", "msi", "app", "apk", "deb", "rpm"].includes(extension) || type.startsWith("application/"))
    return <FileCogIcon />;
  return <FileIcon />;
}

const FileUploadItemPreview = React.forwardRef<
  HTMLDivElement,
  FileUploadItemPreviewProps
>((props, forwardedRef) => {
  const { render, asChild, children, className, ...previewProps } = props;
  const { file } = useFileUploadItemContext(ITEM_PREVIEW_NAME);

  const isImage = file.type.startsWith("image/");

  const previewContent = React.useMemo(() => {
    if (render) return render(file);
    if (isImage) {
      return (
        <img
          src={URL.createObjectURL(file)}
          alt={file.name}
          className="size-full rounded object-cover"
          onLoad={(event) => {
            if (!(event.target instanceof HTMLImageElement)) return;
            URL.revokeObjectURL(event.target.src); // メモリリークを防ぐ
          }}
        />
      );
    }
    return getFileIcon(file);
  }, [file, isImage, render]);

  const ItemPreviewPrimitive = asChild ? Slot : "div";

  return (
    <ItemPreviewPrimitive
      data-slot="file-upload-preview"
      {...previewProps}
      ref={forwardedRef}
      className={cn(
        "relative flex size-10 shrink-0 items-center justify-center rounded-md",
        isImage ? "object-cover" : "bg-accent/50 [&>svg]:size-7",
        className,
      )}
    >
      {previewContent}
      {children}
    </ItemPreviewPrimitive>
  );
});
FileUploadItemPreview.displayName = ITEM_PREVIEW_NAME;

// ─── FileUploadItemMetadata ───────────────────────────────────────────────

type FileUploadItemMetadataProps = React.ComponentPropsWithoutRef<"div"> & {
  asChild?: boolean;
};

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${sizes[i]}`;
}

const FileUploadItemMetadata = React.forwardRef<
  HTMLDivElement,
  FileUploadItemMetadataProps
>((props, forwardedRef) => {
  const { asChild, children, className, ...metadataProps } = props;
  const context = useFileUploadContext(ITEM_METADATA_NAME);
  const itemContext = useFileUploadItemContext(ITEM_METADATA_NAME);

  // fileState を直接 atom から取得する（ItemPreview同様）
  const fileStateAtom = React.useMemo(
    () => selectAtom(filesAtom, (files) => files.get(itemContext.file)),
    [itemContext.file],
  );
  const fileState = useAtomValue(fileStateAtom);

  if (!fileState) return null;

  const ItemMetadataPrimitive = asChild ? Slot : "div";

  return (
    <ItemMetadataPrimitive
      data-slot="file-upload-metadata"
      dir={context.dir}
      {...metadataProps}
      ref={forwardedRef}
      className={cn("flex min-w-0 flex-1 flex-col", className)}
    >
      {children ?? (
        <>
          <span id={itemContext.nameId} className="truncate font-medium text-sm">
            {fileState.file.name}
          </span>
          <span id={itemContext.sizeId} className="text-muted-foreground text-xs">
            {formatBytes(fileState.file.size)}
          </span>
          {fileState.error && (
            <span id={itemContext.messageId} className="text-destructive text-xs">
              {fileState.error}
            </span>
          )}
        </>
      )}
    </ItemMetadataPrimitive>
  );
});
FileUploadItemMetadata.displayName = ITEM_METADATA_NAME;

// ─── FileUploadItemProgress ───────────────────────────────────────────────

type FileUploadItemProgressProps = React.ComponentPropsWithoutRef<"div"> & {
  asChild?: boolean;
  circular?: boolean;
  size?: number;
};

const FileUploadItemProgress = React.forwardRef<
  HTMLDivElement,
  FileUploadItemProgressProps
>((props, forwardedRef) => {
  const { circular, size = 40, asChild, className, ...progressProps } = props;
  const itemContext = useFileUploadItemContext(ITEM_PROGRESS_NAME);

  // progress と status だけを購読する（ファイル名変化で再レンダリングしない）
  const progressAtom = React.useMemo(
    () =>
      selectAtom(filesAtom, (files) => {
        const s = files.get(itemContext.file);
        return s ? { progress: s.progress, status: s.status } : null;
      }),
    [itemContext.file],
  );
  const progressState = useAtomValue(progressAtom);

  if (!progressState) return null;

  const ItemProgressPrimitive = asChild ? Slot : "div";

  if (circular) {
    if (progressState.status === "success") return null;

    const circumference = 2 * Math.PI * ((size - 4) / 2);
    const strokeDashoffset =
      circumference - (progressState.progress / 100) * circumference;

    return (
      <ItemProgressPrimitive
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressState.progress}
        aria-valuetext={`${progressState.progress}%`}
        aria-labelledby={itemContext.nameId}
        data-slot="file-upload-progress"
        {...progressProps}
        ref={forwardedRef}
        className={cn(
          "-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2",
          className,
        )}
      >
        <svg
          className="rotate-[-90deg] transform"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          fill="none"
          stroke="currentColor"
        >
          <circle
            className="text-primary/20"
            strokeWidth="2"
            cx={size / 2}
            cy={size / 2}
            r={(size - 4) / 2}
          />
          <circle
            className="text-primary transition-all"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            cx={size / 2}
            cy={size / 2}
            r={(size - 4) / 2}
          />
        </svg>
      </ItemProgressPrimitive>
    );
  }

  return (
    <ItemProgressPrimitive
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progressState.progress}
      aria-valuetext={`${progressState.progress}%`}
      aria-labelledby={itemContext.nameId}
      data-slot="file-upload-progress"
      {...progressProps}
      ref={forwardedRef}
      className={cn(
        "relative h-1.5 w-full overflow-hidden rounded-full bg-primary/20",
        className,
      )}
    >
      <div
        className="h-full w-full flex-1 bg-primary transition-all"
        style={{
          transform: `translateX(-${100 - progressState.progress}%)`,
        }}
      />
    </ItemProgressPrimitive>
  );
});
FileUploadItemProgress.displayName = ITEM_PROGRESS_NAME;

// ─── FileUploadItemDelete ─────────────────────────────────────────────────

type FileUploadItemDeleteProps = React.ComponentPropsWithoutRef<"button"> & {
  asChild?: boolean;
};

const FileUploadItemDelete = React.forwardRef<
  HTMLButtonElement,
  FileUploadItemDeleteProps
>((props, forwardedRef) => {
  const { asChild, ...deleteProps } = props;
  const { jotaiStore } = useFileUploadContext(ITEM_DELETE_NAME);
  const itemContext = useFileUploadItemContext(ITEM_DELETE_NAME);
  const propsRef = useAsRef(deleteProps);

  const onClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      propsRef.current?.onClick?.(event);
      if (event.defaultPrevented) return;
      jotaiStore.set(removeFileAtom, itemContext.file);
    },
    [jotaiStore, itemContext.file, propsRef],
  );

  const ItemDeletePrimitive = asChild ? Slot : "button";

  return (
    <ItemDeletePrimitive
      type="button"
      aria-controls={itemContext.id}
      aria-describedby={itemContext.nameId}
      data-slot="file-upload-item-delete"
      {...deleteProps}
      ref={forwardedRef}
      onClick={onClick}
    />
  );
});
FileUploadItemDelete.displayName = ITEM_DELETE_NAME;

// ─── FileUploadClear ──────────────────────────────────────────────────────

type FileUploadClearProps = React.ComponentPropsWithoutRef<"button"> & {
  forceMount?: boolean;
  asChild?: boolean;
};

const FileUploadClear = React.forwardRef<
  HTMLButtonElement,
  FileUploadClearProps
>((props, forwardedRef) => {
  const { asChild, forceMount, disabled, ...clearProps } = props;
  const context = useFileUploadContext(CLEAR_NAME);
  const { jotaiStore } = context;
  const propsRef = useAsRef(clearProps);

  // ファイル数だけを購読する（個々のファイルのプログレスでは再レンダリングしない）
  const filesSize = useAtomValue(
    React.useMemo(() => selectAtom(filesAtom, (files) => files.size), []),
  );

  const isDisabled = disabled || context.disabled;
  const shouldRender = forceMount || filesSize > 0;
  if (!shouldRender) return null;

  const onClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    propsRef.current?.onClick?.(event);
    if (event.defaultPrevented) return;
    jotaiStore.set(clearFilesAtom, undefined);
  };

  const ClearPrimitive = asChild ? Slot : "button";

  return (
    <ClearPrimitive
      type="button"
      aria-controls={context.listId}
      data-slot="file-upload-clear"
      data-disabled={isDisabled ? "" : undefined}
      {...clearProps}
      ref={forwardedRef}
      disabled={isDisabled}
      onClick={onClick}
    />
  );
});
FileUploadClear.displayName = CLEAR_NAME;

// ─── エクスポート ─────────────────────────────────────────────────────────

const FileUpload = FileUploadRoot;
const Root = FileUploadRoot;
const Trigger = FileUploadTrigger;
const Dropzone = FileUploadDropzone;
const List = FileUploadList;
const Item = FileUploadItem;
const ItemPreview = FileUploadItemPreview;
const ItemMetadata = FileUploadItemMetadata;
const ItemProgress = FileUploadItemProgress;
const ItemDelete = FileUploadItemDelete;
const Clear = FileUploadClear;

export {
  FileUpload,
  FileUploadDropzone,
  FileUploadTrigger,
  FileUploadList,
  FileUploadItem,
  FileUploadItemPreview,
  FileUploadItemMetadata,
  FileUploadItemProgress,
  FileUploadItemDelete,
  FileUploadClear,
  //
  Root,
  Dropzone,
  Trigger,
  List,
  Item,
  ItemPreview,
  ItemMetadata,
  ItemProgress,
  ItemDelete,
  Clear,
};
