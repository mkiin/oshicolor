import { useAtomValue } from "jotai";
import { themeColorsAtom } from "../highlight-mapper.atoms";
import type {
  NeutralPalette,
  DiagnosticColors,
} from "../highlight-mapper.types";

const ColorSwatch: React.FC<{ hex: string; label: string }> = ({
  hex,
  label,
}) => (
  <div className="flex items-center gap-2">
    <div
      className="w-6 h-6 rounded border border-white/10 shrink-0"
      style={{ backgroundColor: hex }}
    />
    <div className="text-xs">
      <span className="text-gray-400">{label}</span>
      <span className="ml-2 font-mono text-gray-500">{hex}</span>
    </div>
  </div>
);

const NeutralSection: React.FC<{ neutral: NeutralPalette }> = ({ neutral }) => (
  <div className="space-y-1">
    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
      Neutral
    </h3>
    {Object.entries(neutral).map(([key, hex]) => (
      <ColorSwatch key={key} hex={hex} label={key} />
    ))}
  </div>
);

const DiagnosticSection: React.FC<{ diagnostic: DiagnosticColors }> = ({
  diagnostic,
}) => (
  <div className="space-y-1">
    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
      Diagnostic
    </h3>
    {Object.entries(diagnostic).map(([key, hex]) => (
      <ColorSwatch key={key} hex={hex} label={key} />
    ))}
  </div>
);

export const HighlightPalette: React.FC = () => {
  const bundle = useAtomValue(themeColorsAtom);

  if (!bundle) return null;

  return (
    <div className="space-y-4">
      <NeutralSection neutral={bundle.neutral} />
      <DiagnosticSection diagnostic={bundle.diagnostic} />
    </div>
  );
};
