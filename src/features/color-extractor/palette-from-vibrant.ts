import type { Oklch } from "culori";
import { clampChroma, converter, formatHex } from "culori";
import type {
    HueSwatch,
    VibrantResult,
    VibrantSlot,
} from "./vibrant-extractor";

// ── 型定義 ─────────────────────────────────────────────────────────────────

/** mini.hues が扱う8色相名 */
export type SyntaxColorName =
    | "red"
    | "orange"
    | "yellow"
    | "green"
    | "cyan"
    | "azure"
    | "blue"
    | "purple";

/** 各 syntax 色の由来 */
export type ColorSource = "image" | "generated";

/** 画像から生成した Neovim カラースキーム用パレット */
export type CharacterPalette = {
    /** 背景色（DarkMuted の色相で L=0.13 に固定） */
    bg: string;
    /** 前景色（LightMuted の色相で L=0.90 に固定） */
    fg: string;
    /** アクセントカラー（Vibrant の hex そのまま） */
    accent: string;
    /** syntax カラー（8色相） */
    red: string;
    orange: string;
    yellow: string;
    green: string;
    cyan: string;
    azure: string;
    blue: string;
    purple: string;
    /** 各 syntax 色が画像由来か生成値かを示す */
    source: Record<SyntaxColorName, ColorSource>;
    /** syntax カラーに使った OKLch chroma */
    syntaxChroma: number;
    /** Vibrant(60%) + Muted(40%) の加重平均 chroma */
    ambientChroma: number;
    /** Vibrant の OKLch C 値 */
    vibrantC: number;
    /** Muted の OKLch C 値 */
    mutedC: number;
    /** make_hues に渡した n_hues */
    nHues: number;
};

// ── OKLch ユーティリティ ───────────────────────────────────────────────────

const toOklch = converter("oklch");

/** hex を OKLch に変換する（変換失敗時は L=0, C=0, h=0 を返す） */
const hexToOklch = (hex: string): Oklch => {
    const result = toOklch(hex);
    if (!result) {
        return { mode: "oklch", l: 0, c: 0, h: 0 };
    }
    return result;
};

/** OKLch を hex に変換する（sRGB gamut clamp あり） */
const oklchToHex = (l: number, c: number, h: number): string => {
    const clamped = clampChroma({ mode: "oklch", l, c, h }, "oklch");
    return formatHex(clamped) ?? "#000000";
};

// ── mini.hues make_hues ────────────────────────────────────────────────────

/**
 * 2つの色相角（0–360°）の角度距離を計算する（最大180°）
 *
 * @param a - 色相角 A
 * @param b - 色相角 B
 */
const angularDistance = (a: number, b: number): number => {
    const d = Math.abs(a - b) % 360;
    return Math.min(d, 360 - d);
};

/**
 * 循環距離を計算する
 *
 * @param x - 第1の値
 * @param y - 第2の値
 * @param period - 循環周期
 */
const distPeriod = (x: number, y: number, period: number): number => {
    const d = Math.abs((x % period) - (y % period));
    return Math.min(d, period - d);
};

/**
 * リスト内で最も近い値を返す
 *
 * @param x - 基準値
 * @param values - 比較対象リスト
 * @param distFn - 距離関数
 */
const getClosest = (
    x: number,
    values: number[],
    distFn: (a: number, b: number) => number,
): number => {
    let bestVal = values[0];
    let bestDist = Infinity;
    for (const val of values) {
        const d = distFn(x, val);
        if (d <= bestDist) {
            bestDist = d;
            bestVal = val;
        }
    }
    return bestVal;
};

/**
 * mini.hues の make_hues を TypeScript に移植
 *
 * bg/fg の色相から最も遠い等間隔グリッドを nHues 個生成し、
 * red(0°)/orange(45°)/yellow(90°)/green(135°)/cyan(180°)/azure(225°)/blue(270°)/purple(315°)
 * に最近点を割り当てる。
 *
 * @param bgH - 背景色の OKLch hue（度数、undefined 可）
 * @param fgH - 前景色の OKLch hue（度数、undefined 可）
 * @param nHues - グリッドの数（0–8）
 */
const makeHues = (
    bgH: number | undefined,
    fgH: number | undefined,
    nHues: number,
): Partial<Record<SyntaxColorName, number>> => {
    if (nHues === 0) return {};

    const period = 360 / nHues;
    const halfPeriod = 0.5 * period;

    // bg/fg の色相から最も遠くなるオフセット d を求める
    let d: number;
    if (bgH === undefined && fgH === undefined) {
        d = 0;
    } else if (bgH !== undefined && fgH === undefined) {
        d = ((bgH % period) + halfPeriod) % period;
    } else if (bgH === undefined && fgH !== undefined) {
        d = ((fgH % period) + halfPeriod) % period;
    } else {
        // bg/fg 両方あり: 中点の対極を選ぶ
        // biome-ignore lint/style/noNonNullAssertion: else 節に到達する時点で両方 defined
        const refBg = bgH! % period;
        // biome-ignore lint/style/noNonNullAssertion: else 節に到達する時点で両方 defined
        const refFg = fgH! % period;
        const mid = 0.5 * (refBg + refFg);
        const midAlt = (mid + halfPeriod) % period;
        d =
            distPeriod(mid, refBg, period) < distPeriod(midAlt, refBg, period)
                ? midAlt
                : mid;
    }

    // 等間隔グリッドを生成
    const grid: number[] = [];
    for (let i = 0; i < nHues; i++) {
        grid.push(i * period + d);
    }

    // 各標準色相の最近点をグリッドから取得
    const dist360 = (x: number, y: number) => distPeriod(x, y, 360);
    const approx = (refHue: number) => getClosest(refHue, grid, dist360);

    return {
        red: approx(0),
        orange: approx(45),
        yellow: approx(90),
        green: approx(135),
        cyan: approx(180),
        azure: approx(225),
        blue: approx(270),
        purple: approx(315),
    };
};

// ── syntax chroma 決定 ────────────────────────────────────────────────────

/**
 * Muted スウォッチの OKLch C 値から syntax カラーの chroma を決定する
 *
 * Muted の C は画像全体の ambient saturation を表す。
 * これを 5 段階の syntax chroma にマッピングする。
 *
 * @param mutedC - Muted スウォッチの OKLch C 値
 */
const deriveSyntaxChroma = (mutedC: number): number => {
    if (mutedC < 0.03) return 0.04; // low
    if (mutedC < 0.06) return 0.06; // lowmedium
    if (mutedC < 0.1) return 0.08; // medium
    if (mutedC < 0.15) return 0.12; // mediumhigh
    return 0.16; // high
};

// ── HueGroup → SyntaxColorName マッピング ─────────────────────────────────

/**
 * HueGroup ラベルと SyntaxColorName の対応
 *
 * vibrant-extractor の HUE_BANDS（HSL 基準）と
 * mini.hues の OKLch 基準色相との近似マッピング。
 */
const HUE_LABEL_TO_SYNTAX: Partial<Record<string, SyntaxColorName>> = {
    Red: "red",
    Orange: "orange",
    Yellow: "yellow",
    Green: "green",
    Cyan: "cyan",
    Blue: "azure", // HSL 200-255° ≈ OKLch azure 225°
    Purple: "blue", // HSL 255-315° ≈ OKLch blue 270°
    Magenta: "purple", // HSL 315-345° ≈ OKLch purple 315°
};

// ── 画像由来の syntax 色選定 ───────────────────────────────────────────────

/** syntax 色として使いたい OKLch L の範囲 */
const SYNTAX_L_MIN = 0.45;
const SYNTAX_L_MAX = 0.78;

/** 信頼できる HueGroup の最小スウォッチ数 */
const MIN_SWATCHES_FOR_TRUST = 3;

/**
 * HueGroup から最適な syntax 色の hex を選択する
 *
 * 最低限の彩度（ambientChroma × 0.7）を持つ候補を優先し、
 * その中で読みやすさの理想明度（TARGET_L=0.62）に最も近いものを選ぶ。
 *
 * @param swatches - Hue グループ内のスウォッチ列
 * @param ambientChroma - Vibrant と Muted の加重平均 chroma
 */
const selectBestSyntaxSwatch = (
    swatches: HueSwatch[],
    ambientChroma: number,
): string | undefined => {
    // 読みやすい L 範囲に絞る
    const candidates = swatches.filter((s) => {
        const lch = hexToOklch(s.hex);
        return lch.l >= SYNTAX_L_MIN && lch.l <= SYNTAX_L_MAX;
    });

    if (candidates.length === 0) return undefined;

    // ambientChroma の 70% 以上の彩度を持つ候補を優先する
    // → 最低限の鮮やかさを確保してくすんだ色を避ける
    const minC = ambientChroma * 0.7;
    const above = candidates.filter((s) => (hexToOklch(s.hex).c ?? 0) >= minC);
    const pool = above.length > 0 ? above : candidates;

    // pool の中で TARGET_L に最も近い明度のものを選ぶ
    // → 読みやすさを最優先にする
    const TARGET_L = 0.62;
    let bestHex = pool[0].hex;
    let bestDist = Infinity;
    for (const { hex } of pool) {
        const lch = hexToOklch(hex);
        const d = Math.abs(lch.l - TARGET_L);
        if (d < bestDist) {
            bestDist = d;
            bestHex = hex;
        }
    }
    return bestHex;
};

// ── メイン関数 ────────────────────────────────────────────────────────────

/**
 * node-vibrant の VibrantResult から Neovim カラースキーム用パレットを生成する
 *
 * Step 1: 6色（Vibrant/DarkVibrant/LightVibrant/Muted/DarkMuted/LightMuted）から
 *         mini.hues アルゴリズムでベースライン palette を生成する。
 * Step 2: MMCQ 48色の Hue グループを走査し、3色以上あるグループは
 *         画像の実際の色で syntax カラーを上書きする。
 *
 * @param result - extractColorsVibrant の返り値
 */
export const deriveCharacterPalette = (
    result: VibrantResult,
): CharacterPalette => {
    // ── Step 0: 6スロットの hex を取り出す ────────────────────────────────
    const slotMap: Partial<Record<VibrantSlot, string>> = {};
    for (const { slot, hex } of result.colors) {
        slotMap[slot] = hex;
    }

    // フォールバック: スロットが存在しない場合はグレー系で補完
    const darkMutedHex = slotMap.DarkMuted ?? slotMap.DarkVibrant ?? "#1a1a1a";
    const lightMutedHex =
        slotMap.LightMuted ?? slotMap.LightVibrant ?? "#e0e0e0";
    const vibrantHex = slotMap.Vibrant ?? slotMap.LightVibrant ?? "#888888";
    const mutedHex = slotMap.Muted ?? "#888888";

    // ── Step 1: ベースライン生成 ────────────────────────────────────────────

    // bg: DarkMuted の色相で L=0.13 に固定（暗い背景）
    // chroma は DarkMuted の 0.6 倍: 0.4 だと暗すぎて彩度が消えるため引き上げ
    const darkMutedLch = hexToOklch(darkMutedHex);
    const bgH = darkMutedLch.h;
    const bg = oklchToHex(0.13, (darkMutedLch.c ?? 0) * 0.6, bgH ?? 0);

    // fg: LightMuted の色相で L=0.90 に固定（明るい前景）
    const lightMutedLch = hexToOklch(lightMutedHex);
    const fgH = lightMutedLch.h;
    const fg = oklchToHex(0.9, (lightMutedLch.c ?? 0) * 0.5, fgH ?? 0);

    // accent: Vibrant そのまま
    const accent = vibrantHex;

    // ambientChroma: Vibrant(60%) と Muted(40%) の加重平均
    // → Vibrant が高いキャラは鮮やかな色を、Muted なキャラはくすんだ色を選ぶ
    const vibrantLch = hexToOklch(vibrantHex);
    const mutedLch = hexToOklch(mutedHex);
    const ambientChroma =
        (mutedLch.c ?? 0.05) * 0.4 + (vibrantLch.c ?? 0.1) * 0.6;

    // syntax chroma: ambientChroma から 5 段階に変換
    const syntaxChroma = deriveSyntaxChroma(ambientChroma);

    // syntax カラーの明度: bg(0.13) に対してコントラストが確保できる固定値
    const syntaxL = 0.72;

    // n_hues: 8 固定（常に最大グリッドで生成し、画像色で上書きする）
    const nHues = 8;

    // make_hues: bg/fg の色相から等間隔グリッドを生成
    const generatedHues = makeHues(bgH, fgH, nHues);

    // キャラクターの主要色相を収集（彩度が十分あるスロットのみ）
    // 生成色がキャラから離れた色相のとき chroma を減衰させるために使う
    const characterHues: number[] = [];
    for (const lch of [darkMutedLch, vibrantLch, mutedLch, lightMutedLch]) {
        if ((lch.c ?? 0) > 0.01 && lch.h !== undefined) {
            characterHues.push(lch.h);
        }
    }

    // ベースライン: すべて生成値で埋める
    const SYNTAX_NAMES: SyntaxColorName[] = [
        "red",
        "orange",
        "yellow",
        "green",
        "cyan",
        "azure",
        "blue",
        "purple",
    ];

    const palette: Record<SyntaxColorName, string> = {} as Record<
        SyntaxColorName,
        string
    >;
    const source: Record<SyntaxColorName, ColorSource> = {} as Record<
        SyntaxColorName,
        ColorSource
    >;

    for (const name of SYNTAX_NAMES) {
        const h = generatedHues[name] ?? 0;

        // キャラクターの主要色相から遠い生成色ほど chroma を減衰させる
        // → 暖色キャラに原色のシアンが生成されるような「浮き」を防ぐ
        let effectiveChroma = syntaxChroma;
        if (characterHues.length > 0) {
            const minDist = Math.min(
                ...characterHues.map((ch) => angularDistance(h, ch)),
            );
            // 距離 0° で damping=1.0、距離 180° で damping=0.5
            const damping = 1.0 - (minDist / 180) * 0.5;
            effectiveChroma = syntaxChroma * damping;
        }

        palette[name] = oklchToHex(syntaxL, effectiveChroma, h);
        source[name] = "generated";
    }

    // ── Step 2: 画像由来の色で上書き ────────────────────────────────────────
    for (const { label, swatches } of result.hueGroups) {
        // 信頼できる色数に満たないグループはスキップ
        if (swatches.length < MIN_SWATCHES_FOR_TRUST) continue;

        const syntaxName = HUE_LABEL_TO_SYNTAX[label];
        if (!syntaxName) continue; // Neutral など対応なし

        const bestHex = selectBestSyntaxSwatch(swatches, ambientChroma);
        if (!bestHex) continue; // L 範囲に候補がない場合はスキップ

        // 彩度が syntaxChroma の 50% 未満なら生成色のほうがまし
        const bestLch = hexToOklch(bestHex);
        if ((bestLch.c ?? 0) < syntaxChroma * 0.5) continue;

        palette[syntaxName] = bestHex;
        source[syntaxName] = "image";
    }

    return {
        bg,
        fg,
        accent,
        ...palette,
        source,
        syntaxChroma,
        ambientChroma,
        vibrantC: vibrantLch.c ?? 0,
        mutedC: mutedLch.c ?? 0,
        nHues,
    };
};

// ── デバッグ出力 ──────────────────────────────────────────────────────────────

const SYNTAX_NAMES_ORDERED: SyntaxColorName[] = [
    "red",
    "orange",
    "yellow",
    "green",
    "cyan",
    "azure",
    "blue",
    "purple",
];

/**
 * CharacterPalette をデバッグ用のテキストフォーマットに変換する
 *
 * @param palette - deriveCharacterPalette の返り値
 */
export const buildCharacterPaletteDebugText = (
    palette: CharacterPalette,
): string => {
    const lines: string[] = [];

    lines.push("--- 生成パレット ---");
    lines.push(
        `syntaxChroma: ${palette.syntaxChroma.toFixed(3)}  n_hues: ${palette.nHues}`,
    );
    lines.push("");

    lines.push(`bg      ${palette.bg}`);
    lines.push(`fg      ${palette.fg}`);
    lines.push(`accent  ${palette.accent}`);
    lines.push("");

    for (const name of SYNTAX_NAMES_ORDERED) {
        const src = palette.source[name] === "image" ? "画像" : "生成";
        lines.push(`${name.padEnd(7)}  ${palette[name]}  [${src}]`);
    }

    return lines.join("\n");
};
