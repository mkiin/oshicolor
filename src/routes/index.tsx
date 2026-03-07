import type { Swatch } from "@oshicolor/color";
import { extractColors } from "@oshicolor/core";
import { createFileRoute } from "@tanstack/react-router";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { Suspense } from "react";
import { Dropzone, ImagePreview } from "@/components/ui/dropzone";

export const Route = createFileRoute("/")({
    component: RouteComponent,
});

const fileAtom = atom<File | null>(null);

const previewUrlAtom = atom((get) => {
    const file = get(fileAtom);
    return file ? URL.createObjectURL(file) : null;
});

const paletteAtom = atom(async (get) => {
    const file = get(fileAtom);
    if (!file) return null;
    const { colors } = await extractColors(file, { colorCount: 48 });
    const sortedColors = [...colors].sort(
        (a, b) => b.proportion - a.proportion,
    );
    return sortedColors;
});

const HUE_BANDS = [
    { key: "red", label: "Red", color: "#ef4444" },
    { key: "orange", label: "Orange", color: "#f97316" },
    { key: "yellow", label: "Yellow", color: "#eab308" },
    { key: "green", label: "Green", color: "#22c55e" },
    { key: "cyan", label: "Cyan", color: "#06b6d4" },
    { key: "blue", label: "Blue", color: "#3b82f6" },
    { key: "purple", label: "Purple", color: "#a855f7" },
    { key: "pink", label: "Pink", color: "#ec4899" },
    { key: "gray", label: "Gray", color: "#6b7280" },
] as const;

type HueBand = (typeof HUE_BANDS)[number]["key"];

/** 彩度の閾値：これ未満はグレー扱い */
const GRAY_SATURATION_THRESHOLD = 0.15;

const classifyHue = (h: number, _s: number): HueBand => {
    if (h < 0.05 || h >= 0.95) return "red";
    if (h < 0.11) return "orange";
    if (h < 0.19) return "yellow";
    if (h < 0.42) return "green";
    if (h < 0.52) return "cyan";
    if (h < 0.67) return "blue";
    if (h < 0.75) return "purple";
    return "pink";
};

const groupByHue = (swatches: Swatch[]): Map<HueBand, Swatch[]> => {
    const map = new Map<HueBand, Swatch[]>(HUE_BANDS.map((b) => [b.key, []]));
    for (const s of swatches) {
        const [h, sat] = s.hsl;
        const band =
            sat < GRAY_SATURATION_THRESHOLD ? "gray" : classifyHue(h, sat);
        map.get(band)?.push(s);
    }
    return map;
};

function PaletteDisplay() {
    const swatches = useAtomValue(paletteAtom);
    if (!swatches) return null;

    const groups = groupByHue(swatches);

    return (
        <div className="space-y-2">
            {HUE_BANDS.map(({ key, label, color }) => {
                const band = groups.get(key) ?? [];
                if (band.length === 0) return null;
                return (
                    <div key={key} className="flex items-center gap-2">
                        <span
                            className="text-xs w-14 text-right shrink-0 font-medium"
                            style={{ color }}
                        >
                            {label}
                        </span>
                        <div className="flex gap-1 flex-wrap">
                            {band.map((swatch, i) => (
                                <div
                                    // biome-ignore lint/suspicious/noArrayIndexKey: バンド内の順序は安定している
                                    key={i}
                                    className="w-8 h-8 rounded shadow"
                                    style={{ background: swatch.hex }}
                                    title={`${swatch.hex} ${(swatch.proportion * 100).toFixed(1)}%`}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function RouteComponent() {
    const setFile = useSetAtom(fileAtom);
    const previewUrl = useAtomValue(previewUrlAtom);

    return (
        <div className="p-8 max-w-lg mx-auto space-y-4">
            <h1 className="text-xl font-bold">画像アップロード</h1>
            <Dropzone
                accept={{ "image/*": [] }}
                onFilesAccepted={(files) => setFile(files[0] ?? null)}
            />
            <ImagePreview url={previewUrl} />
            <Suspense
                fallback={<p className="text-sm text-gray-500">解析中...</p>}
            >
                <PaletteDisplay />
            </Suspense>
        </div>
    );
}
