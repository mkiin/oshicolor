import type { DiagnosticSlot } from "../types/palette";
import type React from "react";

import { useAtomValue } from "jotai";

import { diagnosticAtom } from "../stores/diagnostic.atom";

const DIAGNOSTIC_ORDER: readonly DiagnosticSlot[] = [
  "error",
  "warn",
  "info",
  "hint",
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

export const DiagnosticPaletteView: React.FC = () => {
  const diagnostic = useAtomValue(diagnosticAtom);

  if (!diagnostic) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-neutral-300">Diagnostic</h3>
      <div className="flex flex-wrap gap-3">
        {DIAGNOSTIC_ORDER.map((slot) => (
          <Swatch key={slot} hex={diagnostic[slot]} label={slot} />
        ))}
      </div>
    </div>
  );
};
