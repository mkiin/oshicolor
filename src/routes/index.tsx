import { createFileRoute } from "@tanstack/react-router";
import { getColor, getPalette, getSwatches } from "colorthief";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";
import { Dropzone, ImagePreview } from "@/components/ui/dropzone";
import { ColorResults } from "@/features/color-extractor/components/color-results";
import { deriveColorAxes } from "@/features/color-extractor/utils/color-axes.utils";

export const Route = createFileRoute("/")({
    component: RouteComponent,
});

const fileAtom = atom<File | null>(null);

const previewUrlAtom = atom((get) => {
    const file = get(fileAtom);
    return file ? URL.createObjectURL(file) : null;
});

const OPTIONS_BASE = {
    quality: 10,
    colorSpace: "rgb" as const,
    ignoreWhite: true,
    minSaturation: 0.05,
} satisfies Parameters<typeof getPalette>[1];

const OPTIONS = { ...OPTIONS_BASE, colorCount: 16 } satisfies Parameters<
    typeof getPalette
>[1];

const colorPaletteAtom = atom(async (get) => {
    const file = get(fileAtom);
    if (!file) return null;
    const bitmap = await createImageBitmap(file);
    return getPalette(bitmap, OPTIONS);
});

const colorAtom = atom(async (get) => {
    const file = get(fileAtom);
    if (!file) return null;
    const bitmap = await createImageBitmap(file);
    return getColor(bitmap, OPTIONS_BASE);
});

const colorSwatchesAtom = atom(async (get) => {
    const file = get(fileAtom);
    if (!file) return null;
    const bitmap = await createImageBitmap(file);
    return getSwatches(bitmap, OPTIONS);
});

const colorAxesAtom = atom(async (get) => {
    const colors = await get(colorPaletteAtom);
    if (!colors) return null;
    return deriveColorAxes(colors);
});

// Suspense 境界の内側で atom を読んで ColorResults に渡すローダー
const ColorResultsLoader: React.FC = () => {
    const dominantColor = useAtomValue(colorAtom);
    const palette = useAtomValue(colorPaletteAtom);
    const swatches = useAtomValue(colorSwatchesAtom);
    const colorAxes = useAtomValue(colorAxesAtom);
    return (
        <ColorResults
            dominantColor={dominantColor}
            palette={palette}
            swatches={swatches}
            colorAxes={colorAxes}
        />
    );
};

// --- ルート ---

function RouteComponent() {
    const setFile = useSetAtom(fileAtom);
    const previewUrl = useAtomValue(previewUrlAtom);
    const file = useAtomValue(fileAtom);

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-6">
            <h1 className="text-xl font-bold">画像アップロード</h1>
            <Dropzone
                accept={{ "image/*": [] }}
                onFilesAccepted={(files) => setFile(files[0] ?? null)}
            />
            {file && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    <div className="w-full aspect-3/4 bg-gray-100 rounded-lg overflow-hidden">
                        <ImagePreview
                            url={previewUrl}
                            className="w-full h-full object-contain"
                        />
                    </div>
                    <Suspense
                        fallback={<Skeleton className="w-full aspect-3/4" />}
                    >
                        <ColorResultsLoader />
                    </Suspense>
                </div>
            )}
        </div>
    );
}
