import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { extractColors } from "@/features/color-extractor/color-extractor";
import type { ColorPoint } from "@/features/color-extractor/types";

export const Route = createFileRoute("/")({ component: App });

export function App() {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [palette, setPalette] = useState<ColorPoint[]>([]);
    const [isExtracting, setIsExtracting] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const handleFile = (file: File) => {
        if (!file.type.startsWith("image/")) return;
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        setPalette([]);
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
        setPalette([]);
        if (inputRef.current) inputRef.current.value = "";
    };

    const handleExtract = () => {
        const img = imgRef.current;
        const canvas = canvasRef.current;
        if (!img || !canvas) return;

        setIsExtracting(true);

        // 次のフレームに処理を遅延させてローディング表示を確実に反映する
        requestAnimationFrame(() => {
            const { naturalWidth, naturalHeight } = img;
            canvas.width = naturalWidth;
            canvas.height = naturalHeight;

            const ctx = canvas.getContext("2d");
            if (!ctx) {
                setIsExtracting(false);
                return;
            }

            ctx.drawImage(img, 0, 0, naturalWidth, naturalHeight);
            const imageData = ctx.getImageData(
                0,
                0,
                naturalWidth,
                naturalHeight,
            );

            const result = extractColors(
                imageData,
                naturalWidth,
                naturalHeight,
                20,
            );
            setPalette(result);
            setIsExtracting(false);
        });
    };

    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
            <div className="w-full max-w-2xl space-y-6">
                <h1 className="text-2xl font-bold text-white text-center">
                    oshicolor
                </h1>

                {/* ドロップゾーン: 画像未選択時のみ表示 */}
                {!previewUrl && (
                    <button
                        type="button"
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onClick={() => inputRef.current?.click()}
                        className={`w-full border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors ${
                            isDragging
                                ? "border-violet-400 bg-violet-950"
                                : "border-gray-700 bg-gray-900 hover:border-gray-500"
                        }`}
                    >
                        <p className="text-gray-400 text-sm">
                            画像をドラッグ&ドロップ、またはクリックして選択
                        </p>
                        <p className="text-gray-600 text-xs mt-1">
                            JPG / PNG / WebP
                        </p>
                    </button>
                )}

                <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleChange}
                />

                {/* 処理用の非表示キャンバス */}
                <canvas ref={canvasRef} className="hidden" />

                {/* プレビューと操作ボタン */}
                {previewUrl && (
                    <div className="space-y-4">
                        <img
                            ref={imgRef}
                            src={previewUrl}
                            alt="preview"
                            className="w-full rounded-xl object-contain max-h-72"
                        />

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={handleExtract}
                                disabled={isExtracting}
                                className="flex-1 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isExtracting ? "抽出中..." : "色を抽出する"}
                            </button>
                            <button
                                type="button"
                                onClick={handleReset}
                                className="px-4 py-2.5 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 transition-colors"
                            >
                                リセット
                            </button>
                        </div>
                    </div>
                )}

                {/* カラーパレット */}
                {palette.length > 0 && (
                    <div className="space-y-3">
                        <p className="text-gray-400 text-sm">
                            抽出された色: {palette.length}色
                        </p>
                        <div className="grid grid-cols-4 gap-3">
                            {palette.map((point) => (
                                <div
                                    key={point.id}
                                    className="rounded-lg overflow-hidden bg-gray-900"
                                >
                                    <div
                                        className="h-14 w-full"
                                        style={{
                                            backgroundColor: point.color,
                                        }}
                                    />
                                    <div className="p-2 space-y-0.5">
                                        <p className="text-white text-xs font-mono">
                                            {point.color}
                                        </p>
                                        {point.name && (
                                            <p className="text-gray-500 text-xs truncate">
                                                {point.name}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
