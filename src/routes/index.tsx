import {
  colorPaletteAtom,
  colorSwatchesAtom,
  fileAtom,
  previewUrlAtom,
  seedColorsAtom,
} from "@/features/color-extractor/color-extractor.atoms";
import { ColorResults } from "@/features/color-extractor/components/color-results";
import {
  activeNeutralRoleAtom,
  luaColorschemeAtom,
  neovimColorTokensAtom,
  neutralSourceTabsAtom,
} from "@/features/highlight-mapper/highlight-mapper.atoms";
import { NeovimPreview } from "@/features/neovim-preview/components";
import { SAMPLE_TYPESCRIPT } from "@/features/neovim-preview/sample-code";
import { Dropzone, ImagePreview } from "@/shared/components/ui/dropzone";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import { createFileRoute } from "@tanstack/react-router";
import { useAtomValue, useSetAtom } from "jotai";
import { Suspense } from "react";

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

const NeutralSourceSwitcher: React.FC = () => {
  const tabs = useAtomValue(neutralSourceTabsAtom);
  const setActiveRole = useSetAtom(activeNeutralRoleAtom);
  const colorTokens = useAtomValue(neovimColorTokensAtom);
  const luaCode = useAtomValue(luaColorschemeAtom);

  if (!tabs || !colorTokens) return null;

  const defaultTab = tabs[0].role;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Neovim Preview</h2>
      <Tabs
        defaultValue={defaultTab}
        onValueChange={(value) => setActiveRole(value as typeof defaultTab)}
        className="flex flex-col gap-2"
      >
        <TabsList variant="line">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.role} value={tab.role}>
              <div
                className="h-3 w-3 rounded-sm border border-white/20"
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
              {luaCode && (
                <NeovimPreview
                  colors={colorTokens}
                  code={luaCode}
                  language="lua"
                  fileName="oshicolor.lua"
                  className="max-w-3xl"
                />
              )}
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
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <h1 className="text-xl font-bold">画像アップロード</h1>
      <Dropzone
        accept={{ "image/*": [] }}
        onFilesAccepted={(files) => setFile(files[0] ?? null)}
      />
      {file && (
        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
          <div className="aspect-3/4 w-full overflow-hidden rounded-lg bg-gray-100">
            <ImagePreview
              url={previewUrl}
              className="h-full w-full object-contain"
            />
          </div>
          <div className="aspect-3/4 overflow-y-auto">
            <Suspense fallback={<Skeleton className="aspect-3/4 w-full" />}>
              <ColorResultsLoader />
            </Suspense>
          </div>
        </div>
      )}
      {file && (
        <Suspense fallback={<Skeleton className="h-96 max-w-3xl" />}>
          <NeutralSourceSwitcher />
        </Suspense>
      )}
    </div>
  );
}
