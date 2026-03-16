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
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                {colorAxis.role}
            </h3>
            <div className="flex flex-wrap gap-2 mt-1">
                {colorAxis.colors.map((color) => (
                    <div key={color.hex()} className="group relative">
                        <div
                            className="w-11 h-11 rounded-lg shadow-sm ring-1 ring-black/10 transition-transform group-hover:scale-110"
                            style={{
                                backgroundColor: color.hex(),
                            }}
                        >
                            <span
                                className="absolute inset-0 flex items-center justify-center text-[8px] font-mono opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ color: color.textColor }}
                            >
                                {color.hex()}
                            </span>
                        </div>
                    </div>
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
                <ColorAxisCard key={axis.role} colorAxis={axis} />
            ))}
        </div>
    );
};
