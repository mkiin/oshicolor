// wallust v4 の ansi pipeline (library/wallust/src/histogram/ansi.rs) で扱う型。

import type { Rgb } from "./rgb.ts";

export type HueName = "red" | "yellow" | "green" | "cyan" | "blue" | "magenta";

/** dark テーマか light テーマかを示す。wallust の ColorOrder に対応する。 */
export type AnsiStyle = "dark" | "light";

/** ansi pipeline の中間出力。後段の Colors 組み立てが使う。 */
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
