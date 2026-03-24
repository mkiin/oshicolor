import type { Color } from "colorthief";
import type { Vibrant } from "node-vibrant/browser";

type Palette = Awaited<ReturnType<Vibrant["getPalette"]>>;
import { DominantColorView } from "./dominant-color-view";
import { PaletteView } from "./palette-view";
import { SwatchesView } from "./swatches-view";

export type ColorResultsProps = {
  dominantColors: Color[] | null;
  palette: Color[] | null;
  swatches: Palette | null;
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
