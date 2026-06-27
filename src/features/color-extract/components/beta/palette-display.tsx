import type { Colors } from "../../types/colors";

import { cn } from "@/shared/lib/utils";
import { useState } from "react";

type PaletteDisplayProps = {
  colors: Colors | undefined;
  isPending: boolean;
  error: Error | null;
};

const Swatch: React.FC<{ hex: string; label: string; size?: "sm" | "lg" }> = ({
  hex,
  label,
  size = "sm",
}) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleClick = () => {
    void navigator.clipboard.writeText(hex);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 900);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`${label} ${hex}`}
      className="group flex flex-col items-stretch gap-1 outline-none"
    >
      <span
        className={cn(
          "ring-border/50 group-focus-visible:ring-ring w-full rounded-md ring-1 transition-transform ring-inset group-hover:scale-[1.03] group-focus-visible:ring-2",
          size === "lg" ? "h-16" : "h-10",
        )}
        style={{ backgroundColor: hex }}
      />
      <span className="text-muted-foreground text-center font-mono text-[10px] leading-tight">
        {isCopied ? "copied" : hex}
      </span>
    </button>
  );
};

const FIRST_ROW = [
  "color0",
  "color1",
  "color2",
  "color3",
  "color4",
  "color5",
  "color6",
  "color7",
] as const;
const SECOND_ROW = [
  "color8",
  "color9",
  "color10",
  "color11",
  "color12",
  "color13",
  "color14",
  "color15",
] as const;

const TerminalPreview: React.FC<{ colors: Colors }> = ({ colors }) => (
  <div
    className="ring-border/60 overflow-hidden rounded-lg font-mono text-xs leading-relaxed ring-1"
    style={{ backgroundColor: colors.background, color: colors.foreground }}
  >
    <div
      className="flex items-center gap-1.5 px-3 py-2"
      style={{ backgroundColor: colors.color0 }}
    >
      <span
        className="size-2 rounded-full"
        style={{ backgroundColor: colors.color1 }}
      />
      <span
        className="size-2 rounded-full"
        style={{ backgroundColor: colors.color3 }}
      />
      <span
        className="size-2 rounded-full"
        style={{ backgroundColor: colors.color2 }}
      />
    </div>
    <div className="space-y-1 px-4 py-3">
      <div>
        <span style={{ color: colors.color5 }}>const</span>{" "}
        <span style={{ color: colors.color4 }}>oshi</span> ={" "}
        <span style={{ color: colors.color2 }}>"{colors.color5}"</span>
      </div>
      <div>
        <span style={{ color: colors.color6 }}>function</span>{" "}
        <span style={{ color: colors.color3 }}>palette</span>() {"{"}
      </div>
      <div className="pl-4">
        <span style={{ color: colors.color1 }}>return</span>{" "}
        <span style={{ color: colors.color4 }}>colors</span>.
        <span style={{ color: colors.color6 }}>map</span>()
      </div>
      <div>{"}"}</div>
      <div className="flex items-center gap-1 pt-1">
        <span style={{ color: colors.color2 }}>➜</span>
        <span>~/oshicolor</span>
        <span
          className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse"
          style={{ backgroundColor: colors.cursor }}
        />
      </div>
    </div>
  </div>
);

export const PaletteDisplay: React.FC<PaletteDisplayProps> = ({
  colors,
  isPending,
  error,
}) => {
  if (error) {
    return (
      <div className="text-destructive border-destructive/40 rounded-lg border border-dashed p-6 text-sm">
        抽出に失敗しました: {error.message}
      </div>
    );
  }

  if (isPending || !colors) {
    return (
      <div className="grid grid-cols-8 gap-2">
        {Array.from({ length: 16 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: スケルトンは index で十分
          <div key={i} className="bg-muted h-10 animate-pulse rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-3">
        <Swatch hex={colors.background} label="background" size="lg" />
        <Swatch hex={colors.foreground} label="foreground" size="lg" />
        <Swatch hex={colors.cursor} label="cursor" size="lg" />
      </div>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-8 gap-2">
          {FIRST_ROW.map((key) => (
            <Swatch key={key} hex={colors[key]} label={key} />
          ))}
        </div>
        <div className="grid grid-cols-8 gap-2">
          {SECOND_ROW.map((key) => (
            <Swatch key={key} hex={colors[key]} label={key} />
          ))}
        </div>
      </div>

      <TerminalPreview colors={colors} />
    </div>
  );
};
