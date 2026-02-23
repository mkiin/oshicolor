import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
    buildDebugText,
    extractColorsVibrant,
    type HueCoverage,
    type HueGroup,
    type HueZoneColor,
    type NamedPalette,
    type SignatureColor,
    type ToneProfile,
    type VibrantColor,
    type VibrantResult,
    type VibrantSlot,
} from "@/features/color-extractor/vibrant-extractor";

export const Route = createFileRoute("/")({ component: App });

/** Hue Zone の各スロットに対応する表示用メタデータ */
const ZONE_META: Record<string, { desc: string; hueHint: string }> = {
    Function: { desc: "関数名", hueHint: "Blue (220°)" },
    Keyword: { desc: "予約語", hueHint: "Purple (275°)" },
    String: { desc: "文字列", hueHint: "Green (115°)" },
    Type: { desc: "型名", hueHint: "Cyan (172°)" },
    Constant: { desc: "定数", hueHint: "Orange (28°)" },
    Identifier: { desc: "変数名", hueHint: "Yellow (68°)" },
};

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

/**
 * HueZoneGenerator が選んだ syntax 6色を表示するパレット
 *
 * hex が null のスロットは「フォールバック必要」として amber で強調表示する。
 */
function HueZonePalette({ hueZone }: { hueZone: HueZoneColor[] }) {
    return (
        <div className="grid grid-cols-3 gap-3">
            {hueZone.map(({ slot, hex }) => {
                const meta = ZONE_META[slot];
                return (
                    <div
                        key={slot}
                        className="rounded-lg overflow-hidden bg-gray-900"
                    >
                        {hex ? (
                            <div
                                className="h-16 w-full"
                                style={{ backgroundColor: hex }}
                            />
                        ) : (
                            // フォールバック必要: ストライプで「色なし」を示す
                            <div
                                className="h-16 w-full"
                                style={{
                                    background:
                                        "repeating-linear-gradient(-45deg, #1f2937 0px, #1f2937 6px, #111827 6px, #111827 12px)",
                                }}
                            />
                        )}
                        <div className="p-2 space-y-0.5">
                            <p className="text-white text-xs font-medium">
                                {slot}
                            </p>
                            <p className="text-gray-500 text-xs">
                                {meta?.desc} · {meta?.hueHint}
                            </p>
                            {hex ? (
                                <p className="text-gray-300 text-xs font-mono">
                                    {hex}
                                </p>
                            ) : (
                                <p className="text-amber-400 text-xs">
                                    フォールバック必要
                                </p>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── NamedPalette 表示 ─────────────────────────────────────────────────────────

type NamedPaletteProps = {
    namedPalette: NamedPalette;
    signatureColor: SignatureColor | null;
    toneProfile: ToneProfile;
    hueCoverage: HueCoverage;
};

/** NamedPalette の1色スウォッチ */
function PaletteChip({
    hex,
    label,
    dark,
}: {
    hex: string;
    label: string;
    dark?: boolean;
}) {
    return (
        <div className="flex flex-col items-center gap-0.5">
            <div
                className="w-10 h-10 rounded-md border border-gray-700"
                style={{ backgroundColor: hex }}
                title={hex}
            />
            <span
                className={`text-xs font-mono ${dark ? "text-gray-500" : "text-gray-400"}`}
            >
                {label}
            </span>
        </div>
    );
}

/**
 * 役割ベース17色パレットを表示する
 *
 * bg / fg / accent / syntax / diag の5グループに分けてレイアウトする。
 */
function NamedPaletteDisplay({
    namedPalette,
    signatureColor,
    toneProfile,
    hueCoverage,
}: NamedPaletteProps) {
    const sat = toneProfile.characterSaturation;
    const satLabel = sat >= 0.14 ? "鮮やか" : sat >= 0.08 ? "普通" : "くすみ";

    return (
        <div className="space-y-4">
            {/* 診断サマリ */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                {signatureColor && (
                    <span className="flex items-center gap-1.5">
                        <span
                            className="inline-block w-3 h-3 rounded-sm"
                            style={{ backgroundColor: signatureColor.hex }}
                        />
                        signature {signatureColor.hex}
                    </span>
                )}
                <span>
                    tone: {satLabel} (C={sat.toFixed(3)})
                </span>
                <span>coverage: {hueCoverage.coveredCount}/6 zones</span>
                <span>temp: {toneProfile.temperatureSign}</span>
            </div>

            {/* bg / fg */}
            <div className="space-y-2">
                <p className="text-gray-500 text-xs">Background / Foreground</p>
                <div className="flex gap-3 flex-wrap">
                    <PaletteChip hex={namedPalette.bg} label="bg" dark />
                    <PaletteChip
                        hex={namedPalette.bgSubtle}
                        label="subtle"
                        dark
                    />
                    <PaletteChip
                        hex={namedPalette.bgHighlight}
                        label="highlight"
                        dark
                    />
                    <div className="w-px bg-gray-800 self-stretch mx-1" />
                    <PaletteChip hex={namedPalette.fg} label="fg" />
                    <PaletteChip hex={namedPalette.fgDim} label="dim" />
                    <PaletteChip hex={namedPalette.fgFaint} label="faint" />
                    <div className="w-px bg-gray-800 self-stretch mx-1" />
                    <PaletteChip hex={namedPalette.accent} label="accent" />
                </div>
            </div>

            {/* syntax */}
            <div className="space-y-2">
                <p className="text-gray-500 text-xs">
                    Syntax
                    {hueCoverage.coveredCount < 4 && (
                        <span className="ml-2 text-amber-400">
                            ▲ 合成モード（coverage {hueCoverage.coveredCount}
                            /6）
                        </span>
                    )}
                </p>
                <div className="flex gap-3 flex-wrap">
                    <PaletteChip hex={namedPalette.synFunction} label="func" />
                    <PaletteChip hex={namedPalette.synKeyword} label="kw" />
                    <PaletteChip hex={namedPalette.synString} label="str" />
                    <PaletteChip hex={namedPalette.synType} label="type" />
                    <PaletteChip hex={namedPalette.synConstant} label="const" />
                    <PaletteChip hex={namedPalette.synIdentifier} label="id" />
                </div>
            </div>

            {/* diag */}
            <div className="space-y-2">
                <p className="text-gray-500 text-xs">Diagnostics（固定値）</p>
                <div className="flex gap-3 flex-wrap">
                    <PaletteChip hex={namedPalette.diagError} label="error" />
                    <PaletteChip hex={namedPalette.diagWarn} label="warn" />
                    <PaletteChip hex={namedPalette.diagInfo} label="info" />
                    <PaletteChip hex={namedPalette.diagHint} label="hint" />
                </div>
            </div>
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

                {/* NamedPalette: 役割ベース17色 */}
                {vibrantResult && (
                    <div className="space-y-3">
                        <p className="text-white text-sm font-medium">
                            NamedPalette
                        </p>
                        <NamedPaletteDisplay
                            namedPalette={vibrantResult.namedPalette}
                            signatureColor={vibrantResult.signatureColor}
                            toneProfile={vibrantResult.toneProfile}
                            hueCoverage={vibrantResult.hueCoverage}
                        />
                    </div>
                )}

                {/* Syntax カラー（Hue Zone） */}
                {vibrantResult && vibrantResult.hueZone.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <p className="text-white text-sm font-medium">
                                    Syntax カラー
                                </p>
                                <p className="text-gray-500 text-xs">
                                    抽出: {vibrantResult.swatchCount}色
                                </p>
                                {vibrantResult.hueZone.some(
                                    (c) => c.hex === null,
                                ) && (
                                    <p className="text-amber-400 text-xs">
                                        ▲ フォールバック必要あり
                                    </p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={handleCopy}
                                className="px-3 py-1 rounded bg-gray-800 text-gray-300 text-xs hover:bg-gray-700 transition-colors"
                            >
                                {isCopied ? "コピー済み ✓" : "デバッグコピー"}
                            </button>
                        </div>
                        <HueZonePalette hueZone={vibrantResult.hueZone} />
                    </div>
                )}

                {/* Vibrant パレット（6色）: DefaultGenerator の参考出力 */}
                {vibrantResult && vibrantResult.colors.length > 0 && (
                    <div className="space-y-3">
                        <p className="text-gray-500 text-xs">
                            DefaultGenerator（参考）
                        </p>
                        <VibrantPalette colors={vibrantResult.colors} />
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
