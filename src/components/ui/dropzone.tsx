import { useDropzone } from "react-dropzone";

type DropzoneProps = {
    onFilesAccepted: (files: File[]) => void;
    accept?: Record<string, string[]>;
    multiple?: boolean;
    maxSize?: number;
};

// このコンポーネントが持つ責任
// 1. ドラッグ状態、エラー表示
// 2. 親から渡されたfileの管理

const Dropzone: React.FC<DropzoneProps> = (_props) => {
    // TODO(human): useDropzone を使って実装する
    useDropzone();
    return <div />;
};

export { Dropzone };
