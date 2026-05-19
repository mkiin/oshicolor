// wallust v4 の ansi pipeline (library/wallust/src/histogram/ansi.rs) を TS に移植する。
//
// 設計:
//   - HSV ベース (CAM16 は使わない、hue 6 分類しか必要としないため)
//   - 6 つの hue バケットに pixel を drain しながら平均を取り、defaults と信頼率 T=0.5 で内分
//   - black と gray は最暗・最明画素から合成、見つからなければ平均から疑似生成する
//   - style="light" のときは val_def を個別に下げた別の Range セットを使う

import type { AnsiOutput, AnsiStyle, HueName, HueRange } from "../types/ansi.ts";
import type { Rgb } from "../types/rgb.ts";
import { hsvToRgb, rgbaToHsvTuples } from "./hsv.ts";

const RED: HueRange = { name: "red", hueStart: 0.0, hueEnd: 60.0, satDef: 0.9, valDef: 0.65 };
const YELLOW: HueRange = { name: "yellow", hueStart: 60.0, hueEnd: 120.0, satDef: 0.9, valDef: 0.75 };
const GREEN: HueRange = { name: "green", hueStart: 120.0, hueEnd: 180.0, satDef: 0.8, valDef: 0.65 };
const CYAN: HueRange = { name: "cyan", hueStart: 180.0, hueEnd: 210.0, satDef: 0.8, valDef: 0.75 };
const BLUE: HueRange = { name: "blue", hueStart: 210.0, hueEnd: 280.0, satDef: 0.9, valDef: 0.55 };
const MAGENTA: HueRange = { name: "magenta", hueStart: 280.0, hueEnd: 360.0, satDef: 0.8, valDef: 0.7 };

const DARK_RANGES: HueRange[] = [RED, YELLOW, GREEN, CYAN, BLUE, MAGENTA];
const LIGHT_RANGES: HueRange[] = [
    { ...RED, valDef: 0.45 },
    { ...YELLOW, valDef: 0.55 },
    { ...GREEN, valDef: 0.45 },
    { ...CYAN, valDef: 0.55 },
    { ...BLUE, valDef: 0.35 },
    { ...MAGENTA, valDef: 0.5 },
];

// ansi defaults と画像由来色の信頼率 (0.0 = 画像 100%, 1.0 = defaults 100%)
const TRUST = 0.5;
const DARK_THRESHOLD = 0.05;
const LIGHT_THRESHOLD = 0.95;

const avg = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;

type Spec = [number, number, number]; // [hue, sat, val]

const drainBucket = (specs: Spec[], range: HueRange): { hues: number[]; sats: number[]; vals: number[] } => {
    const hues: number[] = [];
    const sats: number[] = [];
    const vals: number[] = [];
    // wallust の `specs.retain` 相当: range に入る要素を取り出して specs から消す
    let writeIdx = 0;
    for (let i = 0; i < specs.length; i++) {
        const spec = specs[i];
        if (spec[0] >= range.hueStart && spec[0] <= range.hueEnd) {
            hues.push(spec[0]);
            sats.push(spec[1]);
            vals.push(spec[2]);
        } else {
            specs[writeIdx++] = spec;
        }
    }
    specs.length = writeIdx;
    return { hues, sats, vals };
};

const getColor = (specs: Spec[], range: HueRange): Rgb => {
    const drained = drainBucket(specs, range);
    const hue = drained.hues.length === 0
        ? (range.hueStart + range.hueEnd) / 2
        : TRUST * (range.hueStart + range.hueEnd) / 2 + (1 - TRUST) * avg(drained.hues);
    const sat = drained.sats.length === 0
        ? range.satDef
        : TRUST * range.satDef + (1 - TRUST) * avg(drained.sats);
    const val = drained.vals.length === 0
        ? range.valDef
        : TRUST * range.valDef + (1 - TRUST) * avg(drained.vals);
    return hsvToRgb({ h: hue, s: sat, v: val });
};

const synthBlack = (specs: Spec[]): Rgb => {
    const found = specs.find(([, , v]) => v < DARK_THRESHOLD);
    if (found !== undefined) {
        return hsvToRgb({ h: found[0], s: found[1] * 0.3, v: found[2] });
    }
    const hues = specs.map(([h]) => h);
    const sats = specs.map(([, s]) => s);
    const vals = specs.map(([, , v]) => v);
    const v = (7 * DARK_THRESHOLD + avg(vals)) / 8;
    const s = (2 * 0 + avg(sats)) / 3;
    return hsvToRgb({ h: avg(hues), s, v });
};

const synthGray = (specs: Spec[]): Rgb => {
    const found = specs.find(([, , v]) => v > LIGHT_THRESHOLD);
    if (found !== undefined) {
        return hsvToRgb({ h: found[0], s: found[1] * 0.3, v: found[2] });
    }
    const hues = specs.map(([h]) => h);
    const sats = specs.map(([, s]) => s);
    const vals = specs.map(([, , v]) => v);
    const v = (4 * LIGHT_THRESHOLD + avg(vals)) / 5;
    const s = (2 * 0 + avg(sats)) / 3;
    return hsvToRgb({ h: avg(hues), s, v });
};

/**
 * RGBA バイト列から ANSI 6 hue バケットの代表色と black / gray を抽出する。
 *
 * 戻り値の構造体は `AnsiOutput` で、後段の Colors 組み立て (`#043` / palette-design)
 * が背景・前景・cursor などにこの値を割り当てる。
 */
export const extractAnsi = (rgba: ArrayLike<number>, style: AnsiStyle): AnsiOutput => {
    const specs = rgbaToHsvTuples(rgba);
    const black = synthBlack(specs);
    const gray = synthGray(specs);
    const ranges = style === "light" ? LIGHT_RANGES : DARK_RANGES;
    const hueBuckets: Record<HueName, Rgb> = {} as Record<HueName, Rgb>;
    for (const range of ranges) {
        hueBuckets[range.name] = getColor(specs, range);
    }
    return { hueBuckets, black, gray };
};
