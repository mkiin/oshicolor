import { createFileRoute } from "@tanstack/react-router";
import { getPalette, getSwatches } from "colorthief";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { Suspense } from "react";
import { Dropzone, ImagePreview } from "@/components/ui/dropzone";
import { ColorResults } from "@/features/color-extractor/components/color-results";

export const Route = createFileRoute("/")({
    component: RouteComponent,
});

const fileAtom = atom<File | null>(null);

const previewUrlAtom = atom((get) => {
    const file = get(fileAtom);
    return file ? URL.createObjectURL(file) : null;
});

const OPTIONS = {
    colorCount: 16,
    quality: 10, // 品質を上げたい場合
    colorSpace: "rgb" as const,
    ignoreWhite: true,
    minSaturation: 0.05, // ほぼグレーなピクセルを除外
} satisfies Parameters<typeof getPalette>[1];

const colorPaletteAtom = atom(async (get) => {
    const file = get(fileAtom);
    if (!file) return null;
    const bitmap = await createImageBitmap(file);
    return getPalette(bitmap, OPTIONS);
});

const colorSwatchesAtom = atom(async (get) => {
    const file = get(fileAtom);
    if (!file) return null;
    const bitmap = await createImageBitmap(file);
    return getSwatches(bitmap, OPTIONS);
});

// Suspense 境界の内側で atom を読んで ColorResults に渡すローダー
const ColorResultsLoader: React.FC = () => {
    const palette = useAtomValue(colorPaletteAtom);
    const swatches = useAtomValue(colorSwatchesAtom);
    return <ColorResults palette={palette} swatches={swatches} />;
};

// --- ルート ---

function RouteComponent() {
    const setFile = useSetAtom(fileAtom);
    const previewUrl = useAtomValue(previewUrlAtom);
    const file = useAtomValue(fileAtom);

    return (
        <div className="p-8 max-w-lg mx-auto space-y-6">
            <h1 className="text-xl font-bold">画像アップロード</h1>
            <Dropzone
                accept={{ "image/*": [] }}
                onFilesAccepted={(files) => setFile(files[0] ?? null)}
            />
            <ImagePreview url={previewUrl} />
            {file && (
                <Suspense
                    fallback={
                        <p className="text-sm text-gray-400">抽出中...</p>
                    }
                >
                    <ColorResultsLoader />
                </Suspense>
            )}
        </div>
    );
}
