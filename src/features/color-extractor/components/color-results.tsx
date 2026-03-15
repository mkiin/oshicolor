import type { Color, SwatchMap } from "colorthief";
import { DominantColorView } from "./dominant-color-view";
import { PaletteView } from "./palette-view";
import { SwatchesView } from "./swatches-view";
import type { ColorAxis } from "../utils/color-axes.utils";
import { ColorAxesView } from "./color-axes-view";

export type ColorResultsProps = {
    dominantColor: Color | null;
    palette: Color[] | null;
    swatches: SwatchMap | null;
    colorAxes: ColorAxis[] | null;
};

export const ColorResults: React.FC<ColorResultsProps> = ({
    dominantColor,
    palette,
    swatches,
    colorAxes,
}) => (
    <div className="space-y-6">
        {dominantColor && <DominantColorView color={dominantColor} />}
        {palette && <PaletteView colors={palette} />}
        {swatches && <SwatchesView swatches={swatches} />}
        {colorAxes && <ColorAxesView colorAxes={colorAxes} />}
    </div>
);
