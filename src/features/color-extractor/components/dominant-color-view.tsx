import type { Color } from "colorthief";

export type DominantColorViewProps = {
  colors: Color[];
};

export const DominantColorView: React.FC<DominantColorViewProps> = ({
  colors,
}) => (
  <div className="space-y-2">
    <h2 className="text-xs font-semibold tracking-widest text-gray-400 uppercase">
      Dominant Colors
    </h2>
    <div className="flex overflow-hidden rounded-lg ring-1 ring-black/10">
      {colors.map((color) => (
        <div
          key={color.hex()}
          className="flex h-16 flex-1 items-end justify-center pb-2"
          style={{ backgroundColor: color.hex() }}
        >
          <span
            className="font-mono text-[10px]"
            style={{ color: color.textColor }}
          >
            {color.hex()}
          </span>
        </div>
      ))}
    </div>
  </div>
);
