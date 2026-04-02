import type { ColorAxis } from "../color-extractor.types";

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
      <h3 className="text-xs font-semibold tracking-widest text-gray-400 uppercase">
        {colorAxis.role}
      </h3>
      <div className="mt-1 flex flex-wrap gap-2">
        {colorAxis.colors.map((color) => (
          <div key={color.hex()} className="group relative">
            <div
              className="h-11 w-11 rounded-lg shadow-sm ring-1 ring-black/10 transition-transform group-hover:scale-110"
              style={{
                backgroundColor: color.hex(),
              }}
            >
              <span
                className="absolute inset-0 flex items-center justify-center font-mono text-[8px] opacity-0 transition-opacity group-hover:opacity-100"
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
    <div className="space-y-0">
      <h2 className="text-xs font-semibold tracking-widest text-gray-400 uppercase">
        Axes
      </h2>
      {colorAxes.map((axis) => (
        <ColorAxisCard key={axis.role} colorAxis={axis} />
      ))}
    </div>
  );
};
