import type { Palette, Swatch } from "@oshicolor/color";
import type { ProcessResult } from "@oshicolor/core";
import { Extractor } from "@oshicolor/core";

/** Vibrant パレットの6スロット名 */
export type VibrantSlot =
    | "Vibrant"
    | "DarkVibrant"
    | "LightVibrant"
    | "Muted"
    | "DarkMuted"
    | "LightMuted";

/** Vibrant が選んだ1スロット分の色データ */
export type VibrantColor = {
    /** HEX文字列 "#rrggbb" */
    hex: string;
    /** スロット名 */
    slot: VibrantSlot;
};

/** Hue グループ内の1色 */
export type HueSwatch = {
    /** HEX文字列 "#rrggbb" */
    hex: string;
    /** 画像中のこの色のピクセル数 */
    population: number;
    /** HSL 明度（0–1）。明度昇順（暗い順）で並べるために使用 */
    l: number;
};

/** 色相帯ごとにまとめた色グループ */
export type HueGroup = {
    /** 色相帯名 */
    label: string;
    /** 明度昇順で並べた色 */
    swatches: HueSwatch[];
};

/** 色抽出の結果 */
export type VibrantResult = {
    /** DefaultGenerator が選んだ最大6色 */
    colors: VibrantColor[];
    /** 量子化全色を色相帯別にまとめたグループ */
    hueGroups: HueGroup[];
    /** 量子化で抽出された色の総数 */
    swatchCount: number;
    /** 計算時間 (ms) */
    elapsedMs: number;
};

const SLOTS: VibrantSlot[] = [
    "Vibrant",
    "LightVibrant",
    "DarkVibrant",
    "Muted",
    "LightMuted",
    "DarkMuted",
];

// ── Hue グループ ─────────────────────────────────────────────────────────────

/** 彩度がこの値未満のピクセルは Neutral グループに振り分ける */
const SAT_THRESHOLD = 0.1;

const HUE_BANDS: { label: string; min: number; max: number }[] = [
    { label: "Red", min: 345, max: 375 },
    { label: "Orange", min: 15, max: 45 },
    { label: "Yellow", min: 45, max: 70 },
    { label: "Green", min: 70, max: 150 },
    { label: "Cyan", min: 150, max: 200 },
    { label: "Blue", min: 200, max: 255 },
    { label: "Purple", min: 255, max: 315 },
    { label: "Magenta", min: 315, max: 345 },
];

const HUE_ORDER = [
    "Red",
    "Orange",
    "Yellow",
    "Green",
    "Cyan",
    "Blue",
    "Purple",
    "Magenta",
    "Neutral",
] as const;

type HueLabel = (typeof HUE_ORDER)[number];

const getHueBandLabel = (h: number): HueLabel => {
    const deg = h * 360;
    // Red のラップアラウンド: 0–15° は 360–375° として扱う
    const d = deg < 15 ? deg + 360 : deg;
    for (const band of HUE_BANDS) {
        if (d >= band.min && d < band.max) return band.label as HueLabel;
    }
    return "Red";
};

const buildHueGroups = (swatches: Swatch[]): HueGroup[] => {
    const buckets = new Map<HueLabel, HueSwatch[]>(
        HUE_ORDER.map((label) => [label, []]),
    );

    for (const {
        hsl: [h, s, l],
        hex,
        population,
    } of swatches) {
        const label = s < SAT_THRESHOLD ? "Neutral" : getHueBandLabel(h);
        // biome-ignore lint/style/noNonNullAssertion: HUE_ORDER で初期化済みのキー
        buckets.get(label)!.push({ hex: hex.toLowerCase(), population, l });
    }

    const result: HueGroup[] = [];
    for (const label of HUE_ORDER) {
        // biome-ignore lint/style/noNonNullAssertion: HUE_ORDER で初期化済みのキー
        const list = buckets.get(label)!;
        if (list.length === 0) continue;
        list.sort((a, b) => a.l - b.l);
        result.push({ label, swatches: list });
    }
    return result;
};

/**
 * Palette と Swatch[] から VibrantResult の本体部分を構築する
 *
 * @param palette - DefaultGenerator が生成した6スロットパレット
 * @param swatches - 量子化器が返した全 Swatch
 */
export const buildResultFromSwatches = (
    palette: Palette,
    swatches: Swatch[],
): Omit<VibrantResult, "elapsedMs"> => {
    const colors: VibrantColor[] = SLOTS.flatMap((slot) => {
        const swatch = palette[slot];
        if (!swatch) return [];
        return [{ hex: swatch.hex.toLowerCase(), slot }];
    });

    return {
        colors,
        hueGroups: buildHueGroups(swatches),
        swatchCount: swatches.length,
    };
};

/**
 * 画像 URL からカラーパレットを抽出する
 *
 * @param url - 画像の URL（objectURL 可）
 */
export const extractColorsVibrant = async (
    url: string,
): Promise<VibrantResult> => {
    const t0 = performance.now();

    const extractor = Extractor.from(url).build();
    const palette = await extractor.getPalette();

    const result = extractor.result as ProcessResult;
    const swatches: Swatch[] = result.colors;

    const t1 = performance.now();

    return {
        ...buildResultFromSwatches(palette, swatches),
        elapsedMs: Math.round(t1 - t0),
    };
};

// ── デバッグ出力 ──────────────────────────────────────────────────────────────

const SLOT_LABELS: Record<VibrantSlot, string> = {
    Vibrant: "Vibrant",
    DarkVibrant: "Dark Vibrant",
    LightVibrant: "Light Vibrant",
    Muted: "Muted",
    DarkMuted: "Dark Muted",
    LightMuted: "Light Muted",
};

/**
 * VibrantResult をデバッグ用のテキストフォーマットに変換する
 *
 * @param result - extractColorsVibrant の返り値
 */
export const buildDebugText = (result: VibrantResult): string => {
    const lines: string[] = [];

    lines.push("=== oshicolor debug ===");
    lines.push(`抽出: ${result.swatchCount}色`);
    lines.push("");

    lines.push("--- パレット6色 ---");
    const maxLabelLen = Math.max(
        ...result.colors.map(({ slot }) => SLOT_LABELS[slot].length),
    );
    for (const { slot, hex } of result.colors) {
        lines.push(`${SLOT_LABELS[slot].padEnd(maxLabelLen)}  ${hex}`);
    }
    lines.push("");

    lines.push("--- Hue別カラーグループ ---");
    for (const { label, swatches } of result.hueGroups) {
        lines.push(`${label} (${swatches.length}色)`);
        lines.push(`  ${swatches.map(({ hex }) => hex).join("  ")}`);
    }

    return lines.join("\n");
};
