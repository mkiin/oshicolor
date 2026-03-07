import type { Swatch } from "@oshicolor/color";
import { oklch } from "culori";

export const HUE_BANDS = [
    { key: "red", label: "Red", color: "#ef4444" },
    { key: "orange", label: "Orange", color: "#f97316" },
    { key: "yellow", label: "Yellow", color: "#eab308" },
    { key: "green", label: "Green", color: "#22c55e" },
    { key: "cyan", label: "Cyan", color: "#06b6d4" },
    { key: "blue", label: "Blue", color: "#3b82f6" },
    { key: "purple", label: "Purple", color: "#a855f7" },
    { key: "pink", label: "Pink", color: "#ec4899" },
    { key: "gray", label: "Gray", color: "#6b7280" },
] as const;

export type HueBand = (typeof HUE_BANDS)[number]["key"];

/** OKLCHのchroma閾値：これ未満はグレー扱い */
const OKLCH_GRAY_CHROMA_THRESHOLD = 0.04;

/** OKLCH hue角度（0–360°）で知覚色帯に分類する */
const classifyHueOklch = (h: number): HueBand => {
    if (h < 30 || h >= 345) return "red";
    if (h < 70) return "orange";
    if (h < 115) return "yellow";
    if (h < 170) return "green";
    if (h < 215) return "cyan";
    if (h < 270) return "blue";
    if (h < 315) return "purple";
    return "pink";
};

/**
 * Swatch配列をOKLCH hueで色帯ごとにグループ化する
 *
 * @param swatches - 分類対象のSwatchリスト
 * @returns 色帯キーをキーとするSwatchのMap
 */
export const groupByHue = (swatches: Swatch[]): Map<HueBand, Swatch[]> => {
    const map = new Map<HueBand, Swatch[]>(HUE_BANDS.map((b) => [b.key, []]));
    for (const s of swatches) {
        const c = oklch({ mode: "rgb", r: s.r / 255, g: s.g / 255, b: s.b / 255 });
        const band =
            !c || c.c < OKLCH_GRAY_CHROMA_THRESHOLD || c.h === undefined
                ? "gray"
                : classifyHueOklch(c.h);
        map.get(band)?.push(s);
    }
    return map;
};
