import type { Color } from "colorthief";
import type { VibrantPalette } from "@/types/color";
import { DominantColorView } from "./dominant-color-view";
import { PaletteView } from "./palette-view";
import { SwatchesView } from "./swatches-view";

export type ColorResultsProps = {
  dominantColors: Color[] | null;
  palette: Color[] | null;
  swatches: VibrantPalette | null;
};

export const ColorResults: React.FC<ColorResultsProps> = ({
  dominantColors,
  palette,
  swatches,
}) => (
  <div className="space-y-3">
    {dominantColors && <DominantColorView colors={dominantColors} />}
    {palette && <PaletteView colors={palette} />}
    {swatches && <SwatchesView swatches={swatches} />}
  </div>
);
