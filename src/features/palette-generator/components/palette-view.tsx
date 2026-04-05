import type { PaletteResult } from "../types/palette-result";

import { cn } from "@/shared/lib/utils";

type PaletteViewProps = {
  palette: PaletteResult;
  className?: string;
};

const textColor = (hex: string): string => {
  const h = hex.replace("#", "");
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 128 ? "#000000" : "#ffffff";
};

type SwatchProps = {
  hex: string;
  label: string;
};

const Swatch: React.FC<SwatchProps> = ({ hex, label }) => (
  <div
    className="flex flex-col items-center justify-end rounded px-1 py-2"
    style={{ backgroundColor: hex, color: textColor(hex), minHeight: "3.5rem" }}
  >
    <span className="text-[10px] font-medium opacity-80">{label}</span>
    <span className="text-[9px] opacity-60">{hex}</span>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="space-y-1.5">
    <h3 className="text-xs font-medium text-neutral-400">{title}</h3>
    <div className="grid auto-cols-fr grid-flow-col gap-1">{children}</div>
  </div>
);

const PaletteView: React.FC<PaletteViewProps> = ({ palette, className }) => {
  const { accent, neutral, ui } = palette;

  return (
    <div className={cn("space-y-4", className)}>
      <Section title="accent">
        <Swatch hex={accent.color1} label="keyword" />
        <Swatch hex={accent.color2} label="func" />
        <Swatch hex={accent.color3} label="const" />
        <Swatch hex={accent.color4} label="string" />
        <Swatch hex={accent.color5} label="type" />
        <Swatch hex={accent.color6} label="special" />
        <Swatch hex={accent.color7} label="preproc" />
        <Swatch hex={accent.color8} label="error" />
      </Section>

      <Section title="neutral">
        <Swatch hex={neutral.bg} label="bg" />
        <Swatch hex={neutral.bg_surface} label="surface" />
        <Swatch hex={neutral.bg_cursor_line} label="cursor" />
        <Swatch hex={neutral.bg_popup} label="popup" />
        <Swatch hex={neutral.bg_visual} label="visual" />
        <Swatch hex={neutral.fg} label="fg" />
        <Swatch hex={neutral.comment} label="comment" />
        <Swatch hex={neutral.delimiter} label="delim" />
      </Section>

      <Section title="ui">
        <Swatch hex={ui.navigation} label="nav" />
        <Swatch hex={ui.attention} label="att" />
        <Swatch hex={ui.frame} label="frame" />
        <Swatch hex={ui.search_bg} label="search" />
        <Swatch hex={ui.pmenu_sel_bg} label="pmenu" />
      </Section>
    </div>
  );
};

export { PaletteView };
