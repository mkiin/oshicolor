import { useDropzone } from "react-dropzone";

function ImageDropze() {
    const { getRootProps, getInputProps, isDragGlobal, acceptedFiles } =
        useDropzone();
    const files = acceptedFiles.map((file) => (
        <li key={file.path}>
            {file.path} - {file.size}
        </li>
    ));

    return (
        <div>
            <div {...getRootProps()}>
                <input type="" {...getInputProps()} />
                <p>ここにドロップ</p>
            </div>
            {isDragGlobal && (
                <div className="fixed inset-0 bg-[rgba(0,0,255,0.1)] z-9999">
                    Drop anywhre
                </div>
            )}
            <div>
                <h4>Files</h4>
                <ul>{files}</ul>
            </div>
        </div>
    );
}

export { ImageDropze };
