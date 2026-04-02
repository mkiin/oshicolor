import { cn } from "@/shared/lib/utils";
import { useDropzone } from "react-dropzone";

type DropzoneProps = {
  onFilesAccepted: (files: File[]) => void;
  accept?: Record<string, string[]>;
  multiple?: boolean;
  maxSize?: number;
  className?: string;
};

const Dropzone: React.FC<DropzoneProps> = ({
  onFilesAccepted,
  accept,
  multiple = false,
  maxSize,
  className,
}) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    multiple,
    maxSize,
    // onDrop ではなく onDropAccepted を使う。
    // onDrop は拒否ファイルも含めて全イベントで発火するが、
    // onDropAccepted はバリデーション通過後のみ発火する。
    // accept や maxSize の制約が確実に適用された後の値だけを受け取れる。
    onDropAccepted: onFilesAccepted,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        // ベーススタイル: 破線ボーダー + 角丸 + 余白 + カーソル + トランジション
        "rounded-lg border-2 border-dashed p-12",
        "cursor-pointer text-center",
        "transition-colors duration-150",
        // ドラッグ中 / 通常時でボーダーと背景を切り替える
        isDragActive
          ? "border-blue-500 bg-blue-50"
          : "border-gray-300 hover:border-gray-400",
        className,
      )}
    >
      <input {...getInputProps()} />
      <p className="text-sm text-gray-500">
        {isDragActive
          ? "ここで離してください"
          : "ドロップ または クリックして選択"}
      </p>
    </div>
  );
};

type ImagePreviewProps = {
  url: string | null;
  className?: string;
};

const ImagePreview: React.FC<ImagePreviewProps> = ({ url, className }) => {
  // url が null（ファイル未選択）のときは何もレンダリングしない。
  // undefined ではなく null を型に使うのは「意図的に空」を表現するため。
  if (!url) return null;

  return (
    <img
      src={url}
      // alt は空文字列ではなく意味のある文字列を渡す（アクセシビリティ）
      alt="プレビュー"
      className={cn(
        // max-w-full: 親コンテナを超えて広がらない
        // h-auto: 幅に比例して高さを自動計算し縦横比を維持する
        // object-contain: 呼び出し側が height を上書きした場合でも
        //   画像が歪まないための保険（h-auto だけでは上書きに対応できない）
        // rounded-lg: 汎用コンポーネントとして自然な見た目のデフォルト
        // block: img はインライン要素のため余分な下余白が生じることがある。
        //   block にすることで回避する。
        "block h-auto max-w-full rounded-lg object-contain",
        className,
      )}
    />
  );
};

export { Dropzone, ImagePreview };
