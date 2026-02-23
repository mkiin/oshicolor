import type { Palette, Swatch } from "@oshicolor/color";
import type { ProcessResult } from "@oshicolor/core";
import { Extractor, ZONE_SPECS } from "@oshicolor/core";
import { generateNamedPalette } from "@/features/palette-generator/named-palette";
import {
    analyzeSignatureColor,
    analyzeToneProfile,
    diagnoseHueCoverage,
} from "@/features/palette-generator/palette-analyzer";
import type {
    HueCoverage,
    NamedPalette,
    SignatureColor,
    ToneProfile,
} from "@/features/palette-generator/types";

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

/** HueZoneGenerator が選んだ1スロット分の syntax color */
export type HueZoneColor = {
    /** ZONE_SPECS の slot 名（"Function" | "Keyword" | "String" | "Type" | "Constant" | "Identifier"） */
    slot: string;
    /** 選ばれた色の HEX文字列。null の場合はその Hue 帯に適合する色がなかった */
    hex: string | null;
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
/** 色抽出の結果 */
export type VibrantResult = {
    /** スコアリングで選ばれた最大6色 */
    colors: VibrantColor[];
    /** 量子化全色を色相帯別にまとめたグループ（population 降順） */
    hueGroups: HueGroup[];
    /** HueZoneGenerator で選ばれた syntax 6色（hex が null の場合は合成で補完） */
    hueZone: HueZoneColor[];
    /** 量子化で抽出された色の総数 */
    swatchCount: number;
    /** 計算時間 (ms) */
    elapsedMs: number;
    /** 役割ベースの17色パレット（Neovim カラースキーム生成の中間表現） */
    namedPalette: NamedPalette;
    /** 画像を代表するシグネチャカラー（null = 有彩色なし） */
    signatureColor: SignatureColor | null;
    /** 画像のトーンプロファイル（characterSaturation, temperatureSign） */
    toneProfile: ToneProfile;
    /** HueZone カバレッジ診断（何ゾーンが画像から直接取得できたか） */
    hueCoverage: HueCoverage;
};

export type { NamedPalette, SignatureColor, ToneProfile, HueCoverage };

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
 * Palette と Swatch[] から VibrantResult の本体部分を構築する
 *
 * ブラウザ・Node.js 双方から呼べる純粋関数。
 * elapsedMs は含まないため、呼び出し側で計測して付与する。
 *
 * @param palette - DefaultGenerator が生成した6スロットパレット
 * @param hueZonePalette - HueZoneGenerator が生成した syntax 6スロットパレット
 * @param swatches - 量子化器が返した全 Swatch
 * @returns elapsedMs を除いた VibrantResult
 */
export const buildResultFromSwatches = (
    palette: Palette,
    hueZonePalette: Palette,
    swatches: Swatch[],
): Omit<VibrantResult, "elapsedMs"> => {
    const colors: VibrantColor[] = SLOTS.flatMap((slot) => {
        const swatch = palette[slot];
        if (!swatch) return [];
        return [{ hex: swatch.hex.toLowerCase(), slot }];
    });
    const hueZone: HueZoneColor[] = ZONE_SPECS.map(({ slot }) => ({
        slot,
        hex: hueZonePalette[slot]?.hex.toLowerCase() ?? null,
    }));

    const signatureColor = analyzeSignatureColor(swatches);
    const toneProfile = analyzeToneProfile(swatches);
    const hueCoverage = diagnoseHueCoverage(hueZonePalette);
    const namedPalette = generateNamedPalette(swatches, hueZonePalette);

    return {
        colors,
        hueGroups: buildHueGroups(swatches),
        hueZone,
        swatchCount: swatches.length,
        namedPalette,
        signatureColor,
        toneProfile,
        hueCoverage,
    };
};

/**
 * 画像 URL からカラーパレットを抽出する
 *
 * @oshicolor/core の Extractor（自前 MMCQ + DefaultGenerator + HueZoneGenerator）を使い、
 * 6色パレット・Hue Zone syntax 6色・Hue 別グループを返す。
 *
 * @param url - 画像の URL（objectURL 可）
 * @returns 最終6色・Hue 別グループ・syntax 6色・計算時間
 */
export const extractColorsVibrant = async (
    url: string,
): Promise<VibrantResult> => {
    const t0 = performance.now();

    const extractor = Extractor.from(url).build();
    const palette = await extractor.getPalette();

    const result = extractor.result as ProcessResult;
    // ProcessResult.colors は量子化後の全 Swatch（フィルタ適用済み）
    const swatches: Swatch[] = result.colors;
    // getPalette() が default と hue-zone を同時実行するため両方取得できる
    const hueZonePalette: Palette = result.palettes["hue-zone"] ?? {
        Vibrant: null,
        DarkVibrant: null,
        LightVibrant: null,
        Muted: null,
        DarkMuted: null,
        LightMuted: null,
    };

    const t1 = performance.now();

    return {
        ...buildResultFromSwatches(palette, hueZonePalette, swatches),
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

    // Hue Zone syntax 6色
    lines.push("--- Syntax カラー (Hue Zone) ---");
    for (const { slot, hex } of result.hueZone) {
        const value = hex ?? "(フォールバック必要)";
        lines.push(`${slot.padEnd(12)}  ${value}`);
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
