import type { NeutralSlot } from "../types/palette";
import type React from "react";

import { useAtomValue } from "jotai";

import { neutralAtom } from "../stores/neutral.atom";
import { uiAtom } from "../stores/ui.atom";

const NEUTRAL_LABELS: Record<NeutralSlot, string> = {
  bg: "bg",
  surface: "surface",
  overlay: "overlay",
  highlight: "highlight",
  subtle: "subtle",
  dim: "dim",
  text: "text",
  bright: "bright",
};

const NEUTRAL_ORDER: readonly NeutralSlot[] = [
  "bg",
  "surface",
  "overlay",
  "highlight",
  "subtle",
  "dim",
  "text",
  "bright",
];

const Swatch: React.FC<{ hex: string; label: string }> = ({ hex, label }) => (
  <div className="flex flex-col items-center gap-1">
    <div
      className="h-8 w-14 rounded border border-white/10"
      style={{ backgroundColor: hex }}
    />
    <span className="text-xs text-neutral-400">{label}</span>
    <span className="text-xs text-neutral-500">{hex}</span>
  </div>
);

export const EditorPaletteView: React.FC = () => {
  const neutral = useAtomValue(neutralAtom);
  const ui = useAtomValue(uiAtom);

  if (!neutral || !ui) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-neutral-300">
        Editor (Neutral + UI)
      </h3>
      <div className="flex flex-wrap gap-3">
        {NEUTRAL_ORDER.map((slot) => (
          <Swatch key={slot} hex={neutral[slot]} label={NEUTRAL_LABELS[slot]} />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <Swatch hex={ui.primary} label="U0 primary" />
        <Swatch hex={ui.secondary} label="U1 secondary" />
      </div>
    </div>
  );
};
