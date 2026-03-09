import type { Color } from "colorthief";

export type DominantColorViewProps = {
    color: Color;
};

export const DominantColorView: React.FC<DominantColorViewProps> = ({ color }) => (
    <div className="space-y-2">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Dominant Color
        </h2>
        <div
            className="w-full h-16 rounded-lg ring-1 ring-black/10 flex items-center justify-end px-4"
            style={{ backgroundColor: color.hex() }}
        >
            <span
                className="text-xs font-mono"
                style={{ color: color.textColor }}
            >
                {color.hex()}
            </span>
        </div>
    </div>
);
