import { extractColors } from "@oshicolor/core";
import { createFileRoute } from "@tanstack/react-router";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { Suspense } from "react";
import { Dropzone, ImagePreview } from "@/components/ui/dropzone";
import { groupByHue, HUE_BANDS } from "@/features/color-extractor/hue-band";

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
