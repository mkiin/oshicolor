import { createFileRoute } from "@tanstack/react-router";
import { useAtomValue, useSetAtom } from "jotai";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";
import { Dropzone, ImagePreview } from "@/components/ui/dropzone";
import { ColorResults } from "@/features/color-extractor/components/color-results";
import {
  colorPaletteAtom,
  colorSwatchesAtom,
  fileAtom,
  previewUrlAtom,
  seedColorsAtom,
} from "@/features/color-extractor/color-extractor.atoms";
import { neovimColorTokensAtom } from "@/features/highlight-mapper/highlight-mapper.atoms";
import { NeovimPreview } from "@/features/neovim-preview/components";
import { SAMPLE_TYPESCRIPT } from "@/features/neovim-preview/sample-code";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

const ColorResultsLoader: React.FC = () => {
  const dominantColors = useAtomValue(seedColorsAtom);
  const palette = useAtomValue(colorPaletteAtom);
  const swatches = useAtomValue(colorSwatchesAtom);
  return (
    <ColorResults
      dominantColors={dominantColors}
      palette={palette}
      swatches={swatches}
    />
  );
};

const NeovimPreviewLoader: React.FC = () => {
  const colorTokens = useAtomValue(neovimColorTokensAtom);
  if (!colorTokens) return null;
  return (
    <NeovimPreview
      colors={colorTokens}
      code={SAMPLE_TYPESCRIPT}
      language="typescript"
      fileName="theme-editor.tsx"
      className="max-w-3xl"
    />
  );
};

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
      {file && (
        <Suspense fallback={<Skeleton className="max-w-3xl h-96" />}>
          <NeovimPreviewLoader />
        </Suspense>
      )}
    </div>
  );
}
