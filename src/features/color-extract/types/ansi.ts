import type { Rgb } from "./rgb.ts";

export type HueName = "red" | "yellow" | "green" | "cyan" | "blue" | "magenta";

export type AnsiStyle = "dark" | "light";

export type AnsiOutput = {
    hueBuckets: Record<HueName, Rgb>;
    black: Rgb;
    gray: Rgb;
};

export type HueRange = {
    name: HueName;
    hueStart: number;
    hueEnd: number;
    satDef: number;
    valDef: number;
};
