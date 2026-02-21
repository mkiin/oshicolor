import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";

export const Route = createFileRoute("/")({ component: App });

export function App() {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = (file: File) => {
        if (!file.type.startsWith("image/")) return;
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleReset = () => {
        setPreviewUrl(null);
        if (inputRef.current) inputRef.current.value = "";
    };

    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
            <div className="w-full max-w-lg space-y-6">
                <h1 className="text-2xl font-bold text-white text-center">
                    oshicolor
                </h1>

                {/* ドロップゾーン */}
                <button
                    type="button"
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => inputRef.current?.click()}
                    className={`w-full border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                        isDragging
                            ? "border-violet-400 bg-violet-950"
                            : "border-gray-700 bg-gray-900 hover:border-gray-500"
                    }`}
                >
                    <p className="text-gray-400 text-sm">
                        画像をドラッグ&ドロップ、またはクリックして選択
                    </p>
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleChange}
                    />
                </button>

                {/* プレビュー */}
                {previewUrl && (
                    <div className="space-y-3">
                        <img
                            src={previewUrl}
                            alt="preview"
                            className="w-full rounded-xl object-contain max-h-80"
                        />
                        <button
                            type="button"
                            onClick={handleReset}
                            className="w-full py-2 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 transition-colors"
                        >
                            リセット
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
