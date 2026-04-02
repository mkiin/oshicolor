import type { Color } from "colorthief";

export type PaletteViewProps = {
  colors: Color[];
};

export const PaletteView: React.FC<PaletteViewProps> = ({ colors }) => (
  <div className="space-y-2">
    <h2 className="text-xs font-semibold tracking-widest text-gray-400 uppercase">
      Palette
    </h2>
    <div className="flex flex-wrap gap-2">
      {colors.map((color) => (
        <div key={color.hex()} className="group relative">
          <div
            className="h-11 w-11 rounded-lg shadow-sm ring-1 ring-black/10 transition-transform group-hover:scale-110"
            style={{ backgroundColor: color.hex() }}
          >
            <span
              className="absolute inset-0 flex items-center justify-center font-mono text-[8px] opacity-0 transition-opacity group-hover:opacity-100"
              style={{ color: color.textColor }}
            >
              {color.hex()}
            </span>
          </div>
          <div className="mt-1 h-0.5 w-11 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(color.proportion * 100, 4)}%`,
                backgroundColor: color.hex(),
              }}
            />
          </div>
        </div>
      ))}
    </div>
  </div>
);
