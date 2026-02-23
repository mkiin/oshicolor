import type { Swatch } from "@oshicolor/color";
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
};

/** 色相帯ごとにまとめた色グループ */
export type HueGroup = {
    /** 色相帯名（"Red" | "Orange" | "Yellow" | "Green" | "Cyan" | "Blue" | "Purple" | "Magenta" | "Neutral"） */
    label: string;
    /** population 降順で並べた色 */
    swatches: HueSwatch[];
};

/** スロットのランキング候補1色 */
export type RankedSwatch = {
    /** HEX文字列 "#rrggbb" */
    hex: string;
    /** DefaultGenerator と同じ加重平均スコア */
    score: number;
    /** 最終パレットでこのスロットに選ばれた色かどうか */
    isSelected: boolean;
};

/** スロット別スコアランキング */
export type SlotRanking = {
    slot: VibrantSlot;
    /** HSL 範囲内の全候補をスコア降順で並べたもの */
    candidates: RankedSwatch[];
};

/** 色抽出の結果 */
export type VibrantResult = {
    /** スコアリングで選ばれた最大6色 */
    colors: VibrantColor[];
    /** 各スロットの全候補をスコア降順で並べたランキング */
    rankings: SlotRanking[];
    /** 量子化全色を色相帯別にまとめたグループ（population 降順） */
    hueGroups: HueGroup[];
    /** 量子化で抽出された色の総数 */
    swatchCount: number;
    /** 計算時間 (ms) */
    elapsedMs: number;
};

// ── DefaultGenerator 準拠のスコアリング定数 ──────────────────────────────────
// 出典: @oshicolor/generator-default DEFAULT_OPTS
const WEIGHT_SATURATION = 3;
const WEIGHT_LUMA = 6.5;
const WEIGHT_POPULATION = 0.5;

type SlotTarget = {
    lMin: number;
    lMax: number;
    lTarget: number;
    sMin: number;
    sMax: number;
    sTarget: number;
};

// 出典: @oshicolor/generator-default の findColorVariation 呼び出し引数
const SLOT_TARGETS: Record<VibrantSlot, SlotTarget> = {
    Vibrant: {
        lMin: 0.3,
        lMax: 0.7,
        lTarget: 0.5,
        sMin: 0.35,
        sMax: 1.0,
        sTarget: 1.0,
    },
    LightVibrant: {
        lMin: 0.55,
        lMax: 1.0,
        lTarget: 0.74,
        sMin: 0.35,
        sMax: 1.0,
        sTarget: 1.0,
    },
    DarkVibrant: {
        lMin: 0,
        lMax: 0.45,
        lTarget: 0.26,
        sMin: 0.35,
        sMax: 1.0,
        sTarget: 1.0,
    },
    Muted: {
        lMin: 0.3,
        lMax: 0.7,
        lTarget: 0.5,
        sMin: 0,
        sMax: 0.4,
        sTarget: 0.3,
    },
    LightMuted: {
        lMin: 0.55,
        lMax: 1.0,
        lTarget: 0.74,
        sMin: 0,
        sMax: 0.4,
        sTarget: 0.3,
    },
    DarkMuted: {
        lMin: 0,
        lMax: 0.45,
        lTarget: 0.26,
        sMin: 0,
        sMax: 0.4,
        sTarget: 0.3,
    },
};

const SLOTS: VibrantSlot[] = [
    "Vibrant",
    "LightVibrant",
    "DarkVibrant",
    "Muted",
    "LightMuted",
    "DarkMuted",
];

// value=0 または weight=0 のペアをスキップする加重平均
const weightedMean = (...pairs: [number, number][]): number => {
    let sum = 0;
    let weightSum = 0;
    for (const [value, weight] of pairs) {
        if (!value || !weight) continue;
        sum += value * weight;
        weightSum += weight;
    }
    return weightSum === 0 ? 0 : sum / weightSum;
};

const calcScore = (
    s: number,
    l: number,
    population: number,
    maxPopulation: number,
    target: SlotTarget,
): number => {
    return weightedMean(
        [1 - Math.abs(s - target.sTarget), WEIGHT_SATURATION],
        [1 - Math.abs(l - target.lTarget), WEIGHT_LUMA],
        [population / maxPopulation, WEIGHT_POPULATION],
    );
};

const buildRankings = (
    swatches: Swatch[],
    selectedHexBySlot: Map<VibrantSlot, string>,
    maxPopulation: number,
): SlotRanking[] => {
    return SLOTS.map((slot) => {
        const target = SLOT_TARGETS[slot];
        const candidates: RankedSwatch[] = swatches
            .filter(({ hsl: [, s, l] }) => {
                return (
                    s >= target.sMin &&
                    s <= target.sMax &&
                    l >= target.lMin &&
                    l <= target.lMax
                );
            })
            .map(({ hex, hsl: [, s, l], population }) => ({
                hex: hex.toLowerCase(),
                score: calcScore(s, l, population, maxPopulation, target),
                isSelected: hex.toLowerCase() === selectedHexBySlot.get(slot),
            }))
            .sort((a, b) => b.score - a.score);

        return { slot, candidates };
    });
};

// ── Hue グループ ─────────────────────────────────────────────────────────────

/** 彩度がこの値未満のピクセルは Neutral グループに振り分ける */
const SAT_THRESHOLD = 0.1;

/**
 * 色相帯の定義
 * h を 0–360° に変換後、Red のラップアラウンド（0–15°）を 360–375° に読み替えて判定する
 */
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
        hsl: [h, s],
        hex,
        population,
    } of swatches) {
        const label = s < SAT_THRESHOLD ? "Neutral" : getHueBandLabel(h);
        // HUE_ORDER で全キーを初期化済みのため undefined にならない
        // biome-ignore lint/style/noNonNullAssertion: HUE_ORDER で初期化済みのキー
        buckets.get(label)!.push({ hex: hex.toLowerCase(), population });
    }

    const result: HueGroup[] = [];
    for (const label of HUE_ORDER) {
        // biome-ignore lint/style/noNonNullAssertion: HUE_ORDER で初期化済みのキー
        const list = buckets.get(label)!;
        if (list.length === 0) continue;
        list.sort((a, b) => b.population - a.population);
        result.push({ label, swatches: list });
    }
    return result;
};

/**
 * 画像 URL からカラーパレットを抽出する
 *
 * @oshicolor/core の Extractor（自前 MMCQ + DefaultGenerator）を使い、
 * 6色パレットと各スロットのスコアランキングを返す。
 *
 * @param url - 画像の URL（objectURL 可）
 * @returns 最終6色・スロット別スコアランキング・Hue 別グループ・計算時間
 */
export const extractColorsVibrant = async (
    url: string,
): Promise<VibrantResult> => {
    const t0 = performance.now();

    const extractor = Extractor.from(url).build();
    const palette = await extractor.getPalette();

    // ProcessResult.colors は量子化後の全 Swatch（フィルタ適用済み）
    const swatches: Swatch[] = (extractor.result as ProcessResult).colors;

    const t1 = performance.now();

    const colors: VibrantColor[] = SLOTS.flatMap((slot) => {
        const swatch = palette[slot];
        if (!swatch) return [];
        return [{ hex: swatch.hex.toLowerCase(), slot }];
    });

    const selectedHexBySlot = new Map<VibrantSlot, string>(
        colors.map(({ slot, hex }) => [slot, hex]),
    );
    const maxPopulation = Math.max(...swatches.map((s) => s.population), 1);

    return {
        colors,
        rankings: buildRankings(swatches, selectedHexBySlot, maxPopulation),
        hueGroups: buildHueGroups(swatches),
        swatchCount: swatches.length,
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
 * @returns クリップボードにコピー可能なテキスト
 */
export const buildDebugText = (result: VibrantResult): string => {
    const lines: string[] = [];

    lines.push("=== oshicolor debug ===");
    lines.push(`抽出: ${result.swatchCount}色`);
    lines.push("");

    // パレット6色
    lines.push("--- パレット6色 ---");
    const maxLabelLen = Math.max(
        ...result.colors.map(({ slot }) => SLOT_LABELS[slot].length),
    );
    for (const { slot, hex } of result.colors) {
        lines.push(`${SLOT_LABELS[slot].padEnd(maxLabelLen)}  ${hex}`);
    }
    lines.push("");

    // スロット別スコアランキング
    lines.push("--- スロット別スコアランキング ---");
    for (const { slot, candidates } of result.rankings) {
        if (candidates.length === 0) continue;
        lines.push(`${SLOT_LABELS[slot]} (${candidates.length}色)`);
        for (let i = 0; i < candidates.length; i++) {
            // biome-ignore lint/style/noNonNullAssertion: candidates の有効なインデックス
            const { hex, score, isSelected } = candidates[i]!;
            const star = isSelected ? "  ★" : "";
            lines.push(`  ${i + 1}. ${hex}  ${score.toFixed(3)}${star}`);
        }
    }
    lines.push("");

    // Hue 別カラーグループ
    lines.push("--- Hue別カラーグループ ---");
    for (const { label, swatches } of result.hueGroups) {
        lines.push(`${label} (${swatches.length}色)`);
        lines.push(`  ${swatches.map(({ hex }) => hex).join("  ")}`);
    }

    return lines.join("\n");
};
