import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
    buildDebugText,
    extractColorsVibrant,
    type HueGroup,
    type SlotRanking,
    type VibrantColor,
    type VibrantResult,
    type VibrantSlot,
} from "@/features/color-extractor/vibrant-extractor";

export const Route = createFileRoute("/")({ component: App });

/** Vibrant スロットごとの表示設定 */
const SLOT_META: Record<
    VibrantSlot,
    { label: string; bg: string; text: string }
> = {
    Vibrant: { label: "Vibrant", bg: "bg-violet-500", text: "text-white" },
    DarkVibrant: {
        label: "Dark Vibrant",
        bg: "bg-indigo-800",
        text: "text-white",
    },
    LightVibrant: {
        label: "Light Vibrant",
        bg: "bg-violet-300",
        text: "text-gray-900",
    },
    Muted: { label: "Muted", bg: "bg-slate-500", text: "text-white" },
    DarkMuted: { label: "Dark Muted", bg: "bg-slate-700", text: "text-white" },
    LightMuted: {
        label: "Light Muted",
        bg: "bg-slate-300",
        text: "text-gray-900",
    },
};

/** Vibrant が選んだ6色を表示するパレット */
function VibrantPalette({ colors }: { colors: VibrantColor[] }) {
    return (
        <div className="grid grid-cols-3 gap-3">
            {colors.map(({ hex, slot }) => (
                <div
                    key={slot}
                    className="rounded-lg overflow-hidden bg-gray-900"
                >
                    <div
                        className="h-16 w-full"
                        style={{ backgroundColor: hex }}
                    />
                    <div className="p-2 space-y-0.5">
                        <p className="text-gray-400 text-xs">
                            {SLOT_META[slot].label}
                        </p>
                        <p className="text-white text-xs font-mono">{hex}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}

/**
 * スロット別スコアランキングを表形式で表示する
 *
 * 各行がスロット名、列方向に1位・2位・3位... とスコア降順で並ぶ。
 * 最終パレットに選ばれた色はリングでハイライトする。
 */
function SlotRankingTable({ rankings }: { rankings: SlotRanking[] }) {
    return (
        <div className="space-y-1.5">
            {rankings.map(({ slot, candidates }) => (
                <div key={slot} className="flex items-center gap-2">
                    <span className="text-gray-500 text-xs w-24 shrink-0">
                        {SLOT_META[slot].label}
                    </span>
                    <span className="text-gray-600 text-xs w-12 shrink-0">
                        {candidates.length}色
                    </span>
                    <div className="flex gap-1 overflow-x-auto pb-0.5">
                        {candidates.map(({ hex, isSelected }, i) => (
                            <div
                                key={hex}
                                className={`shrink-0 w-7 h-7 rounded ${isSelected ? "ring-2 ring-violet-400" : ""}`}
                                style={{ backgroundColor: hex }}
                                title={`${i + 1}位 ${hex}${isSelected ? " ★選択" : ""}`}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

/**
 * Hue 別カラーグループを表示する
 *
 * 各行が色相帯名、右に population 降順で色スウォッチが並ぶ。
 */
function HueGroupDisplay({ hueGroups }: { hueGroups: HueGroup[] }) {
    return (
        <div className="space-y-1.5">
            {hueGroups.map(({ label, swatches }) => (
                <div key={label} className="flex items-center gap-2">
                    <span className="text-gray-500 text-xs w-16 shrink-0">
                        {label}
                    </span>
                    <span className="text-gray-600 text-xs w-12 shrink-0">
                        {swatches.length}色
                    </span>
                    <div className="flex gap-1 flex-wrap">
                        {swatches.map(({ hex }) => (
                            <div
                                key={hex}
                                className="w-7 h-7 rounded shrink-0"
                                style={{ backgroundColor: hex }}
                                title={hex}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

export function App() {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [vibrantResult, setVibrantResult] = useState<VibrantResult | null>(
        null,
    );
    const [isExtracting, setIsExtracting] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = (file: File) => {
        if (!file.type.startsWith("image/")) return;
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        setVibrantResult(null);
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
        setVibrantResult(null);
        if (inputRef.current) inputRef.current.value = "";
    };

    const handleCopy = () => {
        if (!vibrantResult) return;
        navigator.clipboard
            .writeText(buildDebugText(vibrantResult))
            .then(() => {
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
            });
    };

    const handleExtract = () => {
        if (!previewUrl) return;

        setIsExtracting(true);
        extractColorsVibrant(previewUrl).then((result) => {
            setVibrantResult(result);
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

                {/* プレビューと操作ボタン */}
                {previewUrl && (
                    <div className="space-y-4">
                        <img
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

                {/* Vibrant パレット（6色） */}
                {vibrantResult && vibrantResult.colors.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <p className="text-gray-400 text-sm">
                                    パレット: {vibrantResult.colors.length}色
                                </p>
                                <p className="text-gray-400 text-sm">
                                    抽出: {vibrantResult.swatchCount}色
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleCopy}
                                className="px-3 py-1 rounded bg-gray-800 text-gray-300 text-xs hover:bg-gray-700 transition-colors"
                            >
                                {isCopied ? "コピー済み ✓" : "デバッグコピー"}
                            </button>
                        </div>
                        <VibrantPalette colors={vibrantResult.colors} />
                    </div>
                )}

                {/* スロット別スコアランキング */}
                {vibrantResult && vibrantResult.rankings.length > 0 && (
                    <div className="space-y-3">
                        <p className="text-gray-400 text-sm">
                            スロット別スコアランキング
                        </p>
                        <SlotRankingTable rankings={vibrantResult.rankings} />
                    </div>
                )}

                {/* Hue 別カラーグループ */}
                {vibrantResult && vibrantResult.hueGroups.length > 0 && (
                    <div className="space-y-3">
                        <p className="text-gray-400 text-sm">
                            Hue 別カラーグループ
                        </p>
                        <HueGroupDisplay hueGroups={vibrantResult.hueGroups} />
                    </div>
                )}
            </div>
        </div>
    );
}
