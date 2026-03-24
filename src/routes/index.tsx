import { createFileRoute } from "@tanstack/react-router";
import { useAtomValue, useSetAtom } from "jotai";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense, startTransition } from "react";
import { Dropzone, ImagePreview } from "@/components/ui/dropzone";
import { ColorResults } from "@/features/color-extractor/components/color-results";
import {
  colorPaletteAtom,
  colorSwatchesAtom,
  fileAtom,
  previewUrlAtom,
  seedColorsAtom,
} from "@/features/color-extractor/color-extractor.atoms";
import {
  NEUTRAL_ROLES,
  activeNeutralRoleAtom,
  previewTokensAtom,
} from "@/features/highlight-mapper/highlight-mapper.atoms";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const ThemePreview: React.FC = () => {
  const swatches = useAtomValue(colorSwatchesAtom);
  const setActiveRole = useSetAtom(activeNeutralRoleAtom);
  const colorTokens = useAtomValue(previewTokensAtom);

  if (!swatches || !colorTokens) return null;

  const tabs = NEUTRAL_ROLES.filter((role) => swatches[role] != null).map(
    (role) => ({
      role,
      hex: swatches[role]!.color.hex(),
    }),
  );

  if (tabs.length === 0) return null;

  const defaultTab = tabs[0].role;

  const handleTabChange = (value: string) => {
    startTransition(() => {
      setActiveRole(value as typeof defaultTab);
    });
  };

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Neovim Preview</h2>
      <Tabs
        defaultValue={defaultTab}
        onValueChange={handleTabChange}
        className="flex flex-col gap-2"
      >
        <TabsList variant="line">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.role} value={tab.role}>
              <div
                className="w-3 h-3 rounded-sm border border-white/20"
                style={{ backgroundColor: tab.hex }}
              />
              {tab.role}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab) => (
          <TabsContent key={tab.role} value={tab.role}>
            <div className="space-y-4">
              <NeovimPreview
                colors={colorTokens}
                code={SAMPLE_TYPESCRIPT}
                language="typescript"
                fileName="theme-editor.tsx"
                className="max-w-3xl"
              />
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
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
          <ThemePreview />
        </Suspense>
      )}
    </div>
  );
}
