import type { ColorAxis } from "../utils/color-axes.utils";

type ColorAxisCardProps = {
    colorAxis: ColorAxis;
};

type ColorAxesViewProps = {
    colorAxes: ColorAxis[];
};

const ColorAxisCard: React.FC<ColorAxisCardProps> = ({ colorAxis }) => {
    return (
        <div>
            {/* ロール名(軸名) */}
            <h3 className="text-xs text-gray-400 uppercase ">
                {colorAxis.role}
            </h3>
            <div className="flex flex-wrap gap-2">
                {colorAxis.colors.map((color) => (
                    <div
                        key={color.hex()}
                        className="w-11 h-11 rounded-lg "
                        style={{
                            backgroundColor: color.hex(),
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

export const ColorAxesView: React.FC<ColorAxesViewProps> = ({ colorAxes }) => {
    return (
        <div className="space-y-2">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                Axes
            </h2>
            {colorAxes.map((axis) => (
                <ColorAxisCard colorAxis={axis} />
            ))}
        </div>
    );
};
