import type React from "react";

import { useAtomValue } from "jotai";

import { seedsAtom } from "../stores/seeds.atom";
import { visionResultAtom } from "../stores/vision-result.atom";

const Swatch: React.FC<{ hex: string; label: string }> = ({ hex, label }) => (
  <div className="flex flex-col items-center gap-1">
    <div
      className="h-10 w-10 rounded border border-white/10"
      style={{ backgroundColor: hex }}
    />
    <span className="text-xs text-neutral-400">{label}</span>
    <span className="text-xs text-neutral-500">{hex}</span>
  </div>
);

export const SeedView: React.FC = () => {
  const vr = useAtomValue(visionResultAtom);
  const seeds = useAtomValue(seedsAtom);

  if (!vr || !seeds) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-neutral-300">
        AI Impression / Seeds
      </h3>
      <div className="flex flex-wrap gap-4">
        <Swatch hex={vr.impression.primary.hex} label="primary" />
        <Swatch hex={vr.impression.secondary.hex} label="secondary" />
        <Swatch hex={vr.impression.tertiary.hex} label="tertiary" />
        <div className="mx-2 w-px bg-neutral-700" />
        <Swatch hex={seeds.primaryHex} label="seed1" />
        <Swatch hex={seeds.secondaryHex} label="seed2" />
      </div>
    </div>
  );
};
