type ThemeTone = "dark" | "light";

type ThemeMood = "dark" | "light-pastel" | "light";

type Oklch = {
  l: number;
  c: number;
  h: number;
};

type NeutralSlot =
  | "bg"
  | "surface"
  | "overlay"
  | "highlight"
  | "subtle"
  | "dim"
  | "text"
  | "bright";

type SyntaxSlot =
  | "accent"
  | "keyword"
  | "func"
  | "string"
  | "type"
  | "number"
  | "operator"
  | "preproc";

type UiSlot = "primary" | "secondary";

type DiagnosticSlot = "error" | "warn" | "info" | "hint";

type Palette = {
  mood: ThemeMood;
  tone: ThemeTone;
  seeds: { primary: string; secondary: string };
  neutral: Record<NeutralSlot, string>;
  syntax: Record<SyntaxSlot, string>;
  ui: Record<UiSlot, string>;
  diagnostic: Record<DiagnosticSlot, string>;
};

export type {
  DiagnosticSlot,
  NeutralSlot,
  Oklch,
  Palette,
  SyntaxSlot,
  ThemeMood,
  ThemeTone,
  UiSlot,
};
