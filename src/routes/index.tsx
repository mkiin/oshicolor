import { createFileRoute } from "@tanstack/react-router";
import { useAtomValue, useSetAtom } from "jotai";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";
import { Dropzone, ImagePreview } from "@/components/ui/dropzone";
import { ColorResults } from "@/features/color-extractor/components/color-results";
import {
  colorAtom,
  colorAxesAtom,
  colorPaletteAtom,
  colorSwatchesAtom,
  fileAtom,
  previewUrlAtom,
} from "@/features/color-extractor/color-extractor.atoms";
import { NeovimPreview } from "@/features/neovim-preview/components";
import { SAMPLE_TYPESCRIPT } from "@/features/neovim-preview/sample-code";

export const Route = createFileRoute("/")({
  component: RouteComponent,
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
          <div className="aspect-3/4 overflow-y-auto">
            <Suspense fallback={<Skeleton className="w-full aspect-3/4" />}>
              <ColorResultsLoader />
            </Suspense>
          </div>
        </div>
      )}
      <NeovimPreview
        colors={{
          bg: "#1e1e2e",
          bgPopup: "#181825",
          bgSurface: "#313244",
          bgCursorLine: "#45475a",
          bgVisual: "#585b70",
          fg: "#cdd6f4",
          comment: "#6c7086",
          lineNr: "#45475a",
          cursorLineNr: "#cba6f7",
          border: "#585b70",
          delimiter: "#6c7086",
          keyword: "#cba6f7",
          fn: "#89b4fa",
          operator: "#89dceb",
          string: "#a6e3a1",
          type: "#f9e2af",
          constant: "#fab387",
          number: "#fab387",
          accent: "#cba6f7",
          searchBg: "#45475a",
          pmenuSelBg: "#45475a",
        }}
        code={SAMPLE_TYPESCRIPT}
        language="typescript"
        fileName="theme-editor.tsx"
        className="max-w-3xl"
      />
    </div>
  );
}
