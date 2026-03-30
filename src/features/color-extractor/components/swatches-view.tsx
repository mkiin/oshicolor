import type { Swatch, SwatchMap, SwatchRole } from "colorthief";

const SWATCH_ROLES: SwatchRole[] = [
  "Vibrant",
  "Muted",
  "DarkVibrant",
  "DarkMuted",
  "LightVibrant",
  "LightMuted",
];

const SWATCH_ROLE_LABELS: Record<SwatchRole, string> = {
  Vibrant: "Vibrant",
  Muted: "Muted",
  DarkVibrant: "Dark Vibrant",
  DarkMuted: "Dark Muted",
  LightVibrant: "Light Vibrant",
  LightMuted: "Light Muted",
};

type SwatchCardProps = {
  role: SwatchRole;
  swatch: Swatch | null;
};

const SwatchCard: React.FC<SwatchCardProps> = ({ role, swatch }) => (
  <div
    className="min-h-72px flex flex-col justify-between overflow-hidden rounded-lg p-3 ring-1 ring-black/10"
    style={{ backgroundColor: swatch?.color.hex() ?? "#f3f4f6" }}
  >
    <p
      className="text-[11px] font-semibold"
      style={{ color: swatch?.titleTextColor.hex() ?? "#9ca3af" }}
    >
      {SWATCH_ROLE_LABELS[role]}
    </p>
    {swatch ? (
      <p
        className="mt-1 font-mono text-[10px]"
        style={{ color: swatch.bodyTextColor.hex() }}
      >
        {swatch.color.hex()}
      </p>
    ) : (
      <p className="text-[10px] text-gray-300">—</p>
    )}
  </div>
);

export type SwatchesViewProps = {
  swatches: SwatchMap;
};

export const SwatchesView: React.FC<SwatchesViewProps> = ({ swatches }) => (
  <div className="space-y-2">
    <h2 className="text-xs font-semibold tracking-widest text-gray-400 uppercase">
      Swatches
    </h2>
    <div className="grid grid-cols-3 gap-2">
      {SWATCH_ROLES.map((role) => (
        <SwatchCard key={role} role={role} swatch={swatches[role]} />
      ))}
    </div>
  </div>
);
