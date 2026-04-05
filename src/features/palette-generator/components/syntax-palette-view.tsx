import type { SyntaxSlot } from "../types/palette";
import type React from "react";

import { useAtomValue } from "jotai";

import { syntaxAtom } from "../stores/syntax.atom";

const SYNTAX_ORDER: readonly SyntaxSlot[] = [
  "accent",
  "keyword",
  "func",
  "string",
  "type",
  "number",
  "operator",
  "preproc",
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

export const SyntaxPaletteView: React.FC = () => {
  const syntax = useAtomValue(syntaxAtom);

  if (!syntax) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-neutral-300">Syntax</h3>
      <div className="flex flex-wrap gap-3">
        {SYNTAX_ORDER.map((slot) => (
          <Swatch key={slot} hex={syntax[slot]} label={slot} />
        ))}
      </div>
    </div>
  );
};
