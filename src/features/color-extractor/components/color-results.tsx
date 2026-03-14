import type { Color, SwatchMap } from "colorthief";
import { DominantColorView } from "./dominant-color-view";
import { PaletteView } from "./palette-view";
import { SwatchesView } from "./swatches-view";

export type ColorResultsProps = {
    dominantColor: Color | null;
    palette: Color[] | null;
    swatches: SwatchMap | null;
};

export const ColorResults: React.FC<ColorResultsProps> = ({
    dominantColor,
    palette,
    swatches,
}) => (
    <div className="space-y-6">
        {dominantColor && <DominantColorView color={dominantColor} />}
        {palette && <PaletteView colors={palette} />}
        {swatches && <SwatchesView swatches={swatches} />}
    </div>
);
