import type { Lab } from "../types/lab.ts";

const D65_X = 0.95047;
const D65_Y = 1.0;
const D65_Z = 1.08883;

const LAB_EPSILON = 216 / 24389;
const LAB_KAPPA = 24389 / 27;

const srgbChannelToLinear = (c: number): number => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const linearRgbToXyz = (r: number, g: number, b: number): [number, number, number] => [
    0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
    0.2126729 * r + 0.7151522 * g + 0.072175 * b,
    0.0193339 * r + 0.119192 * g + 0.9503041 * b,
];

const labComponent = (t: number): number =>
    t > LAB_EPSILON ? Math.cbrt(t) : (LAB_KAPPA * t + 16) / 116;

export const srgbToLab = (rgb: [number, number, number]): Lab => {
    const lr = srgbChannelToLinear(rgb[0]);
    const lg = srgbChannelToLinear(rgb[1]);
    const lb = srgbChannelToLinear(rgb[2]);
    const [x, y, z] = linearRgbToXyz(lr, lg, lb);
    const fx = labComponent(x / D65_X);
    const fy = labComponent(y / D65_Y);
    const fz = labComponent(z / D65_Z);
    return {
        l: 116 * fy - 16,
        a: 500 * (fx - fy),
        b: 200 * (fy - fz),
    };
};

export const rgbaToLabArray = (rgba: ArrayLike<number>): Lab[] => {
    const pixels = rgba.length >>> 2;
    return Array.from({ length: pixels }, (_, i) => {
        const offset = i * 4;
        return srgbToLab([rgba[offset], rgba[offset + 1], rgba[offset + 2]]);
    });
};

export const deltaE76 = (a: Lab, b: Lab): number => {
    const dl = a.l - b.l;
    const da = a.a - b.a;
    const db = a.b - b.b;
    return Math.sqrt(dl * dl + da * da + db * db);
};
