import type { Color, SwatchMap } from "colorthief";
import { PaletteView } from "./palette-view";
import { SwatchesView } from "./swatches-view";

export type ColorResultsProps = {
    palette: Color[] | null;
    swatches: SwatchMap | null;
};

export const ColorResults: React.FC<ColorResultsProps> = ({ palette, swatches }) => (
    <div className="space-y-6">
        {palette && <PaletteView colors={palette} />}
        {swatches && <SwatchesView swatches={swatches} />}
    </div>
);
