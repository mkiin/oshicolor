import type { Color } from "colorthief";

export type DominantColorViewProps = {
  colors: Color[];
};

export const DominantColorView: React.FC<DominantColorViewProps> = ({
  colors,
}) => (
  <div className="space-y-2">
    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
      Dominant Colors
    </h2>
    <div className="flex rounded-lg ring-1 ring-black/10 overflow-hidden">
      {colors.map((color) => (
        <div
          key={color.hex()}
          className="flex-1 h-16 flex items-end justify-center pb-2"
          style={{ backgroundColor: color.hex() }}
        >
          <span
            className="text-[10px] font-mono"
            style={{ color: color.textColor }}
          >
            {color.hex()}
          </span>
        </div>
      ))}
    </div>
  </div>
);
