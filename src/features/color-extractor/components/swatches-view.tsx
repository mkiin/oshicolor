import type { VibrantPalette, VibrantSwatch } from "@/types/color";

const SWATCH_ROLES = [
  "Vibrant",
  "Muted",
  "DarkVibrant",
  "DarkMuted",
  "LightVibrant",
  "LightMuted",
] as const;

const SWATCH_ROLE_LABELS: Record<(typeof SWATCH_ROLES)[number], string> = {
  Vibrant: "Vibrant",
  Muted: "Muted",
  DarkVibrant: "Dark Vibrant",
  DarkMuted: "Dark Muted",
  LightVibrant: "Light Vibrant",
  LightMuted: "Light Muted",
};

type SwatchCardProps = {
  role: (typeof SWATCH_ROLES)[number];
  swatch: VibrantSwatch | null;
};

const SwatchCard: React.FC<SwatchCardProps> = ({ role, swatch }) => (
  <div
    className="rounded-lg overflow-hidden ring-1 ring-black/10 min-h-72px flex flex-col justify-between p-3"
    style={{ backgroundColor: swatch?.hex ?? "#f3f4f6" }}
  >
    <p
      className="text-[11px] font-semibold"
      style={{ color: swatch?.titleTextColor ?? "#9ca3af" }}
    >
      {SWATCH_ROLE_LABELS[role]}
    </p>
    {swatch ? (
      <p
        className="text-[10px] font-mono mt-1"
        style={{ color: swatch.bodyTextColor }}
      >
        {swatch.hex}
      </p>
    ) : (
      <p className="text-[10px] text-gray-300">—</p>
    )}
  </div>
);

export type SwatchesViewProps = {
  swatches: VibrantPalette;
};

export const SwatchesView: React.FC<SwatchesViewProps> = ({ swatches }) => (
  <div className="space-y-2">
    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
      Swatches
    </h2>
    <div className="grid grid-cols-3 gap-2">
      {SWATCH_ROLES.map((role) => (
        <SwatchCard key={role} role={role} swatch={swatches[role]} />
      ))}
    </div>
  </div>
);
