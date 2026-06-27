import type { ExtractConfig } from "../../types/colors";

import { ImagePreview } from "@/shared/components/ui/dropzone";
import { Spinner } from "@/shared/components/ui/spinner";
import { useEffect, useMemo, useState } from "react";

import { useDebouncedValue } from "../../hooks/use-debounced-value";
import { useExtractColors } from "../../hooks/use-extract-colors";
import { ExtractOptions } from "./extract-options";
import { PaletteDisplay } from "./palette-display";

type ColorExtractPanelProps = {
  image: File;
};

const DEFAULT_CONFIG: ExtractConfig = {
  palette: "salience",
  style: "dark",
  dynamic: true,
};

const DEBOUNCE_MS = 350;

export const ColorExtractPanel: React.FC<ColorExtractPanelProps> = ({
  image,
}) => {
  const [config, setConfig] = useState<ExtractConfig>(DEFAULT_CONFIG);
  const debouncedConfig = useDebouncedValue(config, DEBOUNCE_MS);
  const { data, error, isFetching } = useExtractColors(image, debouncedConfig);

  const previewUrl = useMemo(() => URL.createObjectURL(image), [image]);
  useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl]);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[18rem_1fr]">
      <div className="flex flex-col gap-6">
        <div className="bg-muted ring-border/50 overflow-hidden rounded-lg ring-1">
          <ImagePreview
            url={previewUrl}
            className="h-auto w-full object-contain"
          />
        </div>
        <ExtractOptions config={config} onChange={setConfig} />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex h-5 items-center gap-2">
          <span className="text-sm font-medium">パレット</span>
          {isFetching && (
            <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Spinner className="size-3" />
              抽出中
            </span>
          )}
        </div>
        <PaletteDisplay
          colors={data}
          isPending={isFetching && data === undefined}
          error={error}
        />
      </div>
    </div>
  );
};
