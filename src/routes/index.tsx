import { createFileRoute } from "@tanstack/react-router";
import type { Color, Swatch, SwatchMap, SwatchRole } from "colorthief";
import { getPalette, getSwatches } from "colorthief";
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

const colorPalette = atom(async (get) => {
    const file = get(fileAtom);
    if (!file) return null;
    const bitmap = await createImageBitmap(file);
    const colorPalette = await getPalette(bitmap);
    return colorPalette;
});

const colorSwatches = atom(async (get) => {
    const file = get(fileAtom);
    if (!file) return null;
    const bitmap = await createImageBitmap(file);
    const swatchs = await getSwatches(bitmap);
    return swatchs;
});

// --- コンポーネント ---

type PaletteViewProps = { colors: Color[] };

const PaletteView: React.FC<PaletteViewProps> = ({ colors }) => (
    <div className="space-y-2">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Palette
        </h2>
        <div className="flex flex-wrap gap-2">
            {colors.map((color) => (
                <div key={color.hex()} className="group relative">
                    <div
                        className="w-11 h-11 rounded-lg shadow-sm ring-1 ring-black/10 transition-transform group-hover:scale-110"
                        style={{ backgroundColor: color.hex() }}
                    >
                        <span
                            className="absolute inset-0 flex items-center justify-center text-[8px] font-mono opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ color: color.textColor }}
                        >
                            {color.hex()}
                        </span>
                    </div>
                    <div className="mt-1 w-11 h-0.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                            className="h-full rounded-full"
                            style={{
                                width: `${Math.max(color.proportion * 100, 4)}%`,
                                backgroundColor: color.hex(),
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const SWATCH_ROLES: SwatchRole[] = [
    "Vibrant",
    "Muted",
    "DarkVibrant",
    "DarkMuted",
    "LightVibrant",
    "LightMuted",
];

const SWATCH_ROLE_LABELS: Record<SwatchRole, string> = {
    Vibrant: "Vibrant",
    Muted: "Muted",
    DarkVibrant: "Dark Vibrant",
    DarkMuted: "Dark Muted",
    LightVibrant: "Light Vibrant",
    LightMuted: "Light Muted",
};

type SwatchCardProps = { role: SwatchRole; swatch: Swatch | null };

const SwatchCard: React.FC<SwatchCardProps> = ({ role, swatch }) => (
    <div
        className="rounded-lg overflow-hidden ring-1 ring-black/10 min-h-[72px] flex flex-col justify-between p-3"
        style={{ backgroundColor: swatch?.color.hex() ?? "#f3f4f6" }}
    >
        <p
            className="text-[11px] font-semibold"
            style={{ color: swatch?.titleTextColor.hex() ?? "#9ca3af" }}
        >
            {SWATCH_ROLE_LABELS[role]}
        </p>
        {swatch ? (
            <p
                className="text-[10px] font-mono mt-1"
                style={{ color: swatch.bodyTextColor.hex() }}
            >
                {swatch.color.hex()}
            </p>
        ) : (
            <p className="text-[10px] text-gray-300">—</p>
        )}
    </div>
);

type SwatchesViewProps = { swatches: SwatchMap };

const SwatchesView: React.FC<SwatchesViewProps> = ({ swatches }) => (
    <div className="space-y-2">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Swatches
        </h2>
        <div className="grid grid-cols-3 gap-2">
            {SWATCH_ROLES.map((role) => (
                <SwatchCard key={role} role={role} swatch={swatches[role]} />
            ))}
        </div>
    </div>
);

const ColorResults: React.FC = () => {
    const palette = useAtomValue(colorPalette);
    const swatches = useAtomValue(colorSwatches);

    return (
        <div className="space-y-6">
            {palette && <PaletteView colors={palette} />}
            {swatches && <SwatchesView swatches={swatches} />}
        </div>
    );
};

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
                    <ColorResults />
                </Suspense>
            )}
        </div>
    );
}
