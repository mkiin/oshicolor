import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { runExtraction } from "@/features/color-extractor";
import type {
    ColorPoint,
    ExtractionResult,
} from "@/features/color-extractor/types";
import { CodePreview } from "@/features/theme-generator/code-preview";
import { mapColorsToTheme } from "@/features/theme-generator/color-mapper";
import type { ConceptName } from "@/features/theme-generator/hue-rules";
import type { HighlightMap } from "@/features/theme-generator/types";

export const Route = createFileRoute("/")({ component: App });

/** カラーパレットのグリッド表示 */
function PaletteGrid({ colors }: { colors: ColorPoint[] }) {
    return (
        <div className="grid grid-cols-4 gap-3">
            {colors.map((point) => (
                <div
                    key={point.id}
                    className="rounded-lg overflow-hidden bg-gray-900"
                >
                    <div
                        className="h-14 w-full"
                        style={{ backgroundColor: point.color }}
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
                        {point.percent !== undefined && (
                            <p className="text-gray-600 text-xs">
                                {point.percent}%
                            </p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

export function App() {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [palette, setPalette] = useState<ColorPoint[]>([]);
    const [isExtracting, setIsExtracting] = useState(false);
    const [theme, setTheme] = useState<HighlightMap | null>(null);
    const [isCopied, setIsCopied] = useState(false);
    const [concept, setConcept] = useState<ConceptName>("darkClassic");
    const [extractionResults, setExtractionResults] = useState<{
        extractColors: ExtractionResult;
        kmeans: ExtractionResult;
    } | null>(null);

    const inputRef = useRef<HTMLInputElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const handleFile = (file: File) => {
        if (!file.type.startsWith("image/")) return;
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        setPalette([]);
        setTheme(null);
        setExtractionResults(null);
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
        setTheme(null);
        setExtractionResults(null);
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

            const results = runExtraction(
                imageData,
                naturalWidth,
                naturalHeight,
                12,
            );
            setExtractionResults(results);
            setPalette(results.extractColors.colors);
            setTheme(mapColorsToTheme(results.extractColors.colors, concept));
            setIsExtracting(false);
        });
    };

    const handleCopyPalette = () => {
        const text = palette
            .map(
                (p) =>
                    `${p.color}${p.name ? `  ${p.name}` : ""}${p.percent !== undefined ? `  ${p.percent}%` : ""}`,
            )
            .join("\n");
        navigator.clipboard.writeText(text).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
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

                        {/* コンセプト選択 */}
                        <div className="flex gap-2">
                            {(
                                [
                                    ["darkClassic", "Dark Classic"],
                                    ["lightPastel", "Light Pastel"],
                                ] as const
                            ).map(([key, label]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setConcept(key)}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                        concept === key
                                            ? "bg-violet-600 text-white"
                                            : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={handleExtract}
                                disabled={isExtracting}
                                className="flex-1 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isExtracting ? "抽出中..." : "カラーを抽出"}
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

                {/* 計算時間バッジ */}
                {extractionResults && (
                    <div className="flex gap-3">
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-800 text-xs">
                            <span className="text-gray-400">
                                extract-colors
                            </span>
                            <span className="text-violet-400 font-mono">
                                {extractionResults.extractColors.elapsedMs}ms
                            </span>
                        </span>
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-800 text-xs">
                            <span className="text-gray-400">k-means++</span>
                            <span className="text-violet-400 font-mono">
                                {extractionResults.kmeans.elapsedMs}ms
                            </span>
                        </span>
                    </div>
                )}

                {/* extract-colors パレット */}
                {extractionResults &&
                    extractionResults.extractColors.colors.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-gray-400 text-sm">
                                    extract-colors:{" "}
                                    {
                                        extractionResults.extractColors.colors
                                            .length
                                    }
                                    色
                                </p>
                                <button
                                    type="button"
                                    onClick={handleCopyPalette}
                                    className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 text-xs hover:bg-gray-700 transition-colors"
                                >
                                    {isCopied ? "コピーしました" : "コピー"}
                                </button>
                            </div>
                            <PaletteGrid
                                colors={extractionResults.extractColors.colors}
                            />
                        </div>
                    )}

                {/* k-means++ パレット */}
                {extractionResults &&
                    extractionResults.kmeans.colors.length > 0 && (
                        <div className="space-y-3">
                            <p className="text-gray-400 text-sm">
                                k-means++:{" "}
                                {extractionResults.kmeans.colors.length}色
                            </p>
                            <PaletteGrid
                                colors={extractionResults.kmeans.colors}
                            />
                        </div>
                    )}

                {/* テーマプレビュー（エディタ風コードハイライト） */}
                {theme && (
                    <div className="space-y-3">
                        <p className="text-gray-400 text-sm">
                            テーマプレビュー
                        </p>
                        <CodePreview highlightMap={theme} />
                    </div>
                )}
            </div>
        </div>
    );
}
