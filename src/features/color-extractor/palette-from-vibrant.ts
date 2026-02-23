import type { Oklch } from "culori";
import { clampChroma, converter, formatHex } from "culori";
import type { VibrantResult, VibrantSlot } from "./vibrant-extractor";

// ── 型定義 ────────────────────────────────────────────────────────────────────

/** Neovim 構文ロール名 */
export type SyntaxRole =
    | "fn"
    | "kw"
    | "field"
    | "string"
    | "type"
    | "op"
    | "const"
    | "special";

/** 各 syntax 色の由来 */
export type ColorSource = "accent" | "image" | "generated";

/** キャラクタートーン分類 */
export type ToneCategory = "dark" | "vivid" | "pastel" | "normal";

/** 画像から生成した Neovim カラースキーム用パレット */
export type CharacterPalette = {
    /** 背景色（DarkMuted の色相で L=0.15 に固定） */
    bg: string;
    /** 前景色（LightMuted の色相で L=0.90 に固定） */
    fg: string;
    /** アクセントカラー（Vibrant の hex そのまま） */
    accent: string;
    /** コメント色（DarkMuted の色相で L=0.50、C=0.025） */
    comment: string;
    /** エラー色（赤固定: OKLch L=0.65, C=0.20, H=25°） */
    error: string;
    /** @function — accent から導出した最頻出構文色 */
    fn: string;
    /** @keyword — キャラ色相世界内で fn と対比的な色 */
    kw: string;
    /** @field — フィールド・プロパティ */
    field: string;
    /** @string — 文字列リテラル */
    string: string;
    /** @type — 型アノテーション */
    type: string;
    /** @operator — 演算子 */
    op: string;
    /** @constant — 定数・マクロ */
    const: string;
    /** @special — 特殊記法（デコレータ等） */
    special: string;
    /** 各 syntax 色が accent / 画像由来 / 生成値かを示す */
    source: Record<SyntaxRole, ColorSource>;
    /** 画像由来色の chroma 中央値（生成色の基準彩度） */
    syntaxChroma: number;
    /** Vibrant の OKLch C 値 */
    vibrantC: number;
    /** キャラクタートーン分類 */
    toneCategory: ToneCategory;
};

// ── 内部型 ────────────────────────────────────────────────────────────────────

type Candidate = {
    hex: string;
    lch: Oklch;
    groupSize: number;
};

/** トーン別パラメータセット */
type TonePreset = {
    /** Phase 3 生成色の基準明度 */
    syntaxL: number;
    /** fn の明度下限 */
    fnLMin: number;
    /** fn の明度上限 */
    fnLMax: number;
    /** kw 専用候補プールの明度下限（一般候補より低め） */
    kwLMin: number;
    /** kw 専用候補プールの明度上限 */
    kwLMax: number;
};

// ── 定数 ──────────────────────────────────────────────────────────────────────

const BG_L = 0.15;
const FG_L = 0.9;
const COMMENT_L = 0.5;
const COMMENT_C = 0.025;
const BG_C_FACTOR = 0.6;
const FG_C_FACTOR = 0.3;

/** error は業界慣習に従い常に赤固定（キャラクターに依存しない） */
const ERROR_L = 0.65;
const ERROR_C = 0.2;
const ERROR_H = 25;

/** 一般候補プールの明度フィルタ */
const L_MIN = 0.45;
const L_MAX = 0.82;
const C_MIN = 0.04;
const MIN_SW = 3;

const FN_C_FACTOR = 0.85;
/** fn_C の下限: accent が低彩度でも bg に対して視認できる最低限 */
const C_FLOOR = 0.08;

/** kw: fn からの最小色相分離（これ未満は失格） */
const KW_SEP_MIN = 35;
/** kw スコア: fn からの分離度の理想距離（山型の峰） */
const KW_SEP_PEAK = 90;
/** kw スコア: キャラ色相への近接スコアの有効半径 */
const KW_CHAR_PROXIMITY_PEAK = 120;

const MIN_HUE_SEP = 35;
const PHASE1_MATCH_THRESHOLD = 50;
/** 最大減衰率: キャラの色相から 180° 離れた生成色で 50% 減衰 */
const DAMPING_FACTOR = 0.5;

// ── Step A: トーン分類の閾値 ──────────────────────────────────────────────────

const TONE_DARK_L_MAX = 0.5;
const TONE_PASTEL_L_MIN = 0.65;
const TONE_PASTEL_C_MAX = 0.12;
const TONE_VIVID_C_MIN = 0.17;

// ── Step B: トーン別パラメータ ────────────────────────────────────────────────

/**
 * トーン別パラメータセット
 *
 * - dark  : 暗め・重厚系。L 全体を低め、kw は暗い色相でも拾えるよう下限を緩める
 * - vivid : 鮮やか系（アニメ寄り）。L は標準より少し高め
 * - pastel: 柔らか系。L 全体を高め
 * - normal: それ以外の標準
 */
const TONE_PRESETS: Record<ToneCategory, TonePreset> = {
    dark: {
        syntaxL: 0.65,
        fnLMin: 0.52,
        fnLMax: 0.7,
        kwLMin: 0.42,
        kwLMax: 0.73,
    },
    vivid: {
        syntaxL: 0.72,
        fnLMin: 0.58,
        fnLMax: 0.75,
        kwLMin: 0.52,
        kwLMax: 0.78,
    },
    pastel: {
        syntaxL: 0.76,
        fnLMin: 0.65,
        fnLMax: 0.82,
        kwLMin: 0.62,
        kwLMax: 0.84,
    },
    normal: {
        syntaxL: 0.72,
        fnLMin: 0.58,
        fnLMax: 0.75,
        kwLMin: 0.52,
        kwLMax: 0.78,
    },
};

/** Phase 1 の業界標準 Hue（kanagawa / tokyonight / catppuccin の合意値） */
const INDUSTRY_HUES: Partial<Record<SyntaxRole, number>> = {
    string: 130,
    type: 195,
    const: 30,
};

/** fn / kw を除いた残りロール。Phase 1 は string/type/const を先に処理する */
const REMAINING_ROLES: SyntaxRole[] = [
    "string",
    "type",
    "const",
    "field",
    "op",
    "special",
];

// ── OKLch ユーティリティ ──────────────────────────────────────────────────────

const toOklch = converter("oklch");

/** hex を OKLch に変換する（変換失敗時は L=0, C=0, H=0 を返す） */
const hexToOklch = (hex: string): Oklch => {
    const result = toOklch(hex);
    if (!result) return { mode: "oklch", l: 0, c: 0, h: 0 };
    return result;
};

/** OKLch を hex に変換する（sRGB gamut clamp あり） */
const oklchToHex = (l: number, c: number, h: number): string => {
    const clamped = clampChroma({ mode: "oklch", l, c, h }, "oklch");
    return formatHex(clamped) ?? "#000000";
};

/**
 * 2つの色相角（0–360°）の角度距離を計算する（最大 180°）
 *
 * @param a - 色相角 A
 * @param b - 色相角 B
 */
const angularDistance = (a: number, b: number): number => {
    const d = Math.abs(a - b) % 360;
    return Math.min(d, 360 - d);
};

/** 数値配列の中央値を返す */
const median = (values: number[]): number => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
        : (sorted[mid] ?? 0);
};

/**
 * 新しい色相が割り当て済み色相リストと MIN_HUE_SEP 以上離れているか確認する
 *
 * @param h - チェックする色相角
 * @param assigned - 割り当て済み色相角リスト
 */
const isSeparated = (h: number, assigned: number[]): boolean => {
    return assigned.every((ah) => angularDistance(h, ah) >= MIN_HUE_SEP);
};

/**
 * キャラクターの色相から遠い生成色ほど chroma を減衰させる
 *
 * 画像にない色相の生成色が主張しすぎることを防ぐ。
 * 距離 0° で damping=1.0、距離 180° で damping=0.5。
 *
 * @param h - 生成色の色相角
 * @param chroma - 基準 chroma
 * @param characterHues - キャラクターの主要色相リスト
 */
const dampedChroma = (
    h: number,
    chroma: number,
    characterHues: number[],
): number => {
    if (characterHues.length === 0) return chroma;
    const minDist = Math.min(
        ...characterHues.map((ch) => angularDistance(h, ch)),
    );
    const damping = 1.0 - (minDist / 180) * DAMPING_FACTOR;
    return chroma * damping;
};

/**
 * 割り当て済み色相リストの中で最も遠い色相角を 5° 刻みで探索する
 *
 * @param assigned - 割り当て済み色相角リスト
 */
const findMostDistantHue = (assigned: number[]): number => {
    let bestH = 0;
    let bestDist = -Infinity;
    for (let h = 0; h < 360; h += 5) {
        const minDist = Math.min(
            ...assigned.map((ah) => angularDistance(h, ah)),
        );
        if (minDist > bestDist) {
            bestDist = minDist;
            bestH = h;
        }
    }
    return bestH;
};

// ── Step D: 面積加重平均 L ────────────────────────────────────────────────────

/**
 * 全有彩色スウォッチの面積（population）加重平均 OKLch L を計算する
 *
 * 背景・影色の歪みを補正するため Neutral グループを除外する。
 * 48色単純中央値より背景の影響を受けにくく、キャラの明度感を正確に捉える。
 *
 * @param result - VibrantResult（hueGroups を使用）
 */
const computeWeightedMeanL = (result: VibrantResult): number => {
    let sumL = 0;
    let sumPop = 0;
    for (const { label, swatches } of result.hueGroups) {
        if (label === "Neutral") continue;
        for (const { hex, population } of swatches) {
            const lch = hexToOklch(hex);
            sumL += lch.l * population;
            sumPop += population;
        }
    }
    return sumPop > 0 ? sumL / sumPop : 0.5;
};

// ── Step A: トーン分類 ────────────────────────────────────────────────────────

/**
 * Vibrant スロットの L/C と面積加重平均 L からキャラクタートーンを分類する
 *
 * Vibrant.L と面積加重 L の平均を「実効明度」とし、
 * それに Vibrant.C（鮮やかさ）を組み合わせて 4 分類する。
 *
 * @param vibrantL - Vibrant スロットの OKLch L
 * @param vibrantC - Vibrant スロットの OKLch C
 * @param weightedL - 面積加重平均 OKLch L（有彩色のみ）
 */
const classifyTone = (
    vibrantL: number,
    vibrantC: number,
    weightedL: number,
): ToneCategory => {
    // Vibrant.L と面積加重 L の平均を実効明度とする
    // Vibrant 単体より背景・影の影響を受けにくい
    const effectiveL = (vibrantL + weightedL) / 2;

    if (effectiveL < TONE_DARK_L_MAX) return "dark";
    if (effectiveL > TONE_PASTEL_L_MIN && vibrantC < TONE_PASTEL_C_MAX) {
        return "pastel";
    }
    if (vibrantC > TONE_VIVID_C_MIN) return "vivid";
    return "normal";
};

// ── Step C: kw スコア計算 ─────────────────────────────────────────────────────

/**
 * kw 候補色のスコアを計算する
 *
 * キャラの色相世界への近接度（重み 0.7）と fn からの分離度（重み 0.3）の加重和。
 * fn から KW_SEP_MIN° 未満の候補は失格（-1 を返す）。
 *
 * 旧: 「fn から遠い = 高スコア」→ キャラに無関係な色が選ばれやすかった
 * 新: 「キャラの色相内で fn と適度に離れた色」を優先
 *
 * @param h - 候補色の色相角
 * @param fnH - fn の色相角
 * @param characterHues - キャラクターの主要色相リスト（6スロット由来）
 */
const scoreKwCandidate = (
    h: number,
    fnH: number,
    characterHues: number[],
): number => {
    const fnDist = angularDistance(h, fnH);
    if (fnDist < KW_SEP_MIN) return -1;

    // fn からの分離度スコア（山型: 峰=KW_SEP_PEAK°、両端に向かって線形減衰）
    const sepScore = Math.max(
        0,
        1.0 - Math.abs(fnDist - KW_SEP_PEAK) / (180 - KW_SEP_PEAK),
    );

    // キャラ色相への近接スコア（峰: 0°、KW_CHAR_PROXIMITY_PEAK° で 0）
    const proximityScore =
        characterHues.length > 0
            ? Math.max(
                  0,
                  1.0 -
                      Math.min(
                          ...characterHues.map((ch) => angularDistance(h, ch)),
                      ) /
                          KW_CHAR_PROXIMITY_PEAK,
              )
            : 0;

    return proximityScore * 0.7 + sepScore * 0.3;
};

// ── メイン関数 ────────────────────────────────────────────────────────────────

/**
 * node-vibrant の VibrantResult から Neovim カラースキーム用パレットを生成する
 *
 * アルゴリズム:
 *   Step D   : 面積加重平均 L を算出（有彩色を population で重み付け）
 *   Step A   : キャラクタートーンを分類（dark/vivid/pastel/normal）
 *   Step B   : トーン別パラメータセットを取得
 *   Step 1   : bg / fg / accent / comment / error を決定
 *   Step 4   : hueGroups から候補色を抽出（L・C フィルタ）
 *   Step 5   : fn = accent の L をトーン別範囲に調整
 *   Step 6   : kw = キャラ近接スコア × fn 分離スコアで選出（Step B/C）
 *   Step 7.1 : 業界標準 Hue に近い画像色をマッチング（string/type/const）
 *   Step 7.2 : 残りロールに色相が最も分散する画像色を割り当て
 *   Step 7.25: syntaxChroma = 画像由来色の chroma 中央値
 *   Step 7.3 : 未割り当てロールをトーン別 syntaxL で OKLch 生成色補完
 *
 * @param result - extractColorsVibrant の返り値
 */
export const deriveCharacterPalette = (
    result: VibrantResult,
): CharacterPalette => {
    // ── Step 0: 6スロットの hex を取り出す ─────────────────────────────────────
    const slotMap: Partial<Record<VibrantSlot, string>> = {};
    for (const { slot, hex } of result.colors) {
        slotMap[slot] = hex;
    }

    const darkMutedHex = slotMap.DarkMuted ?? slotMap.DarkVibrant ?? "#1a1a1a";
    const lightMutedHex =
        slotMap.LightMuted ?? slotMap.LightVibrant ?? "#e0e0e0";
    const vibrantHex = slotMap.Vibrant ?? slotMap.LightVibrant ?? "#888888";
    const mutedHex = slotMap.Muted ?? "#888888";

    const darkMutedLch = hexToOklch(darkMutedHex);
    const lightMutedLch = hexToOklch(lightMutedHex);
    const vibrantLch = hexToOklch(vibrantHex);
    const mutedLch = hexToOklch(mutedHex);

    // ── Step D: 面積加重平均 L の算出 ──────────────────────────────────────────
    const weightedL = computeWeightedMeanL(result);

    // ── Step A: トーン分類 ─────────────────────────────────────────────────────
    const toneCategory = classifyTone(
        vibrantLch.l,
        vibrantLch.c ?? 0,
        weightedL,
    );

    // ── Step B: トーン別パラメータ取得 ─────────────────────────────────────────
    const preset = TONE_PRESETS[toneCategory];

    // ── Step 1: ベース色の決定 ─────────────────────────────────────────────────
    const bgH = darkMutedLch.h ?? 0;
    const bg = oklchToHex(BG_L, (darkMutedLch.c ?? 0) * BG_C_FACTOR, bgH);
    const fg = oklchToHex(
        FG_L,
        (lightMutedLch.c ?? 0) * FG_C_FACTOR,
        lightMutedLch.h ?? 0,
    );
    const accent = vibrantHex;
    const comment = oklchToHex(COMMENT_L, COMMENT_C, bgH);
    const error = oklchToHex(ERROR_L, ERROR_C, ERROR_H);

    // キャラクターの主要色相（kw scoring & chroma damping に使用）
    const characterHues: number[] = [];
    for (const lch of [darkMutedLch, vibrantLch, mutedLch, lightMutedLch]) {
        if ((lch.c ?? 0) > 0.01 && lch.h !== undefined) {
            characterHues.push(lch.h);
        }
    }

    // ── Step 4: 一般候補色の抽出 ──────────────────────────────────────────────
    const seen = new Set<string>();
    const candidates: Candidate[] = [];

    for (const { label, swatches } of result.hueGroups) {
        if (label === "Neutral") continue;
        if (swatches.length < MIN_SW) continue;
        for (const { hex } of swatches) {
            if (seen.has(hex)) continue;
            const lch = hexToOklch(hex);
            if (lch.l < L_MIN || lch.l > L_MAX) continue;
            if ((lch.c ?? 0) < C_MIN) continue;
            seen.add(hex);
            candidates.push({ hex, lch, groupSize: swatches.length });
        }
    }

    // LightVibrant / DarkVibrant を追加（MMCQ とは別経路で得られた色）
    for (const hex of [slotMap.LightVibrant, slotMap.DarkVibrant]) {
        if (!hex || seen.has(hex)) continue;
        const lch = hexToOklch(hex);
        if (lch.l < L_MIN || lch.l > L_MAX) continue;
        if ((lch.c ?? 0) < C_MIN) continue;
        seen.add(hex);
        candidates.push({ hex, lch, groupSize: 1 });
    }

    // ── Step 5: fn の決定（Step B: トーン別 L 範囲を適用） ─────────────────────
    const fnH = vibrantLch.h ?? 0;
    const fnL = Math.max(preset.fnLMin, Math.min(preset.fnLMax, vibrantLch.l));
    const fnC = Math.max(C_FLOOR, (vibrantLch.c ?? 0) * FN_C_FACTOR);
    const fnHex = oklchToHex(fnL, fnC, fnH);

    // 割り当て済み色相（fn から始まり順次追加される）
    const assignedHues: number[] = [fnH];

    // ── Step 6: kw の決定（Step B: トーン別 L 範囲 + Step C: キャラ近接スコア） ─
    // 一般候補プールより L 下限を緩めた kw 専用候補を収集する
    // （暗いキャラの場合、そのキャラの色相は L < 0.45 に集中しやすいため）
    const kwSeen = new Set<string>();
    const kwCandidates: { hex: string; lch: Oklch }[] = [];

    for (const { label, swatches } of result.hueGroups) {
        if (label === "Neutral") continue;
        if (swatches.length < MIN_SW) continue;
        for (const { hex } of swatches) {
            if (kwSeen.has(hex)) continue;
            const lch = hexToOklch(hex);
            if (lch.l < preset.kwLMin || lch.l > preset.kwLMax) continue;
            if ((lch.c ?? 0) < C_MIN) continue;
            kwSeen.add(hex);
            kwCandidates.push({ hex, lch });
        }
    }

    let kwHex = "";
    let kwSource: ColorSource = "generated";
    let kwBestScore = -Infinity;

    for (const { hex, lch } of kwCandidates) {
        const h = lch.h ?? 0;
        if (!isSeparated(h, assignedHues)) continue;

        const score = scoreKwCandidate(h, fnH, characterHues);
        if (score < 0) continue;
        if (score > kwBestScore) {
            kwBestScore = score;
            kwHex = hex;
            kwSource = "image";
        }
    }

    if (!kwHex) {
        // フォールバック: キャラ色相の中で fn から最も離れた色相を選び、
        // トーン別 L の中間値で生成色を作る
        let fallbackH = (fnH + 120) % 360;
        let bestFallbackDist = -Infinity;
        for (const ch of characterHues) {
            const dist = angularDistance(ch, fnH);
            if (dist >= KW_SEP_MIN && dist > bestFallbackDist) {
                bestFallbackDist = dist;
                fallbackH = ch;
            }
        }
        const kwL = (preset.kwLMin + preset.kwLMax) / 2;
        kwHex = oklchToHex(kwL, C_FLOOR, fallbackH);
    }

    assignedHues.push(hexToOklch(kwHex).h ?? 0);

    // ── Step 7: 残りロールの割り当て ──────────────────────────────────────────
    const palette: Partial<Record<SyntaxRole, string>> = {};
    const roleSource: Partial<Record<SyntaxRole, ColorSource>> = {};
    const usedHexes = new Set<string>([fnHex, kwHex]);

    // Phase 1: 業界標準 Hue マッチング（string=130°, type=195°, const=30°）
    for (const role of ["string", "type", "const"] as SyntaxRole[]) {
        const targetH = INDUSTRY_HUES[role];
        if (targetH === undefined) continue;

        let bestHex = "";
        let bestDist = Infinity;
        for (const { hex, lch } of candidates) {
            if (usedHexes.has(hex)) continue;
            const h = lch.h ?? 0;
            const dist = angularDistance(h, targetH);
            if (dist >= PHASE1_MATCH_THRESHOLD) continue;
            if ((lch.c ?? 0) < C_MIN) continue;
            if (!isSeparated(h, assignedHues)) continue;
            if (dist < bestDist) {
                bestDist = dist;
                bestHex = hex;
            }
        }
        if (bestHex) {
            palette[role] = bestHex;
            roleSource[role] = "image";
            assignedHues.push(hexToOklch(bestHex).h ?? 0);
            usedHexes.add(bestHex);
        }
    }

    // Phase 2: 多様性ピック（既存割り当て色から最も遠い画像色を残りロールに割り当てる）
    for (const role of REMAINING_ROLES.filter((r) => !palette[r])) {
        let bestHex = "";
        let bestMinDist = -Infinity;
        for (const { hex, lch } of candidates) {
            if (usedHexes.has(hex)) continue;
            const h = lch.h ?? 0;
            if ((lch.c ?? 0) < C_MIN) continue;
            if (!isSeparated(h, assignedHues)) continue;
            const minDist =
                assignedHues.length > 0
                    ? Math.min(
                          ...assignedHues.map((ah) => angularDistance(h, ah)),
                      )
                    : 180;
            if (minDist > bestMinDist) {
                bestMinDist = minDist;
                bestHex = hex;
            }
        }
        if (bestHex) {
            palette[role] = bestHex;
            roleSource[role] = "image";
            assignedHues.push(hexToOklch(bestHex).h ?? 0);
            usedHexes.add(bestHex);
        }
    }

    // Phase 2.5: syntaxChroma 算出
    // fn（accent source）と画像由来色の chroma の中央値が生成色の基準彩度になる
    const imageChromas: number[] = [fnC];
    if (kwSource === "image") imageChromas.push(hexToOklch(kwHex).c ?? 0);
    for (const role of REMAINING_ROLES) {
        if (roleSource[role] === "image" && palette[role]) {
            // biome-ignore lint/style/noNonNullAssertion: 直前の if で palette[role] が truthy を確認済み
            imageChromas.push(hexToOklch(palette[role]!).c ?? 0);
        }
    }
    const syntaxChroma =
        imageChromas.length > 0
            ? median(imageChromas)
            : (vibrantLch.c ?? 0.1) * 0.5;

    // Phase 3: 生成色で補完（Step B: トーン別 syntaxL を適用）
    for (const role of REMAINING_ROLES.filter((r) => !palette[r])) {
        const industryH = INDUSTRY_HUES[role];
        const genH =
            industryH !== undefined && isSeparated(industryH, assignedHues)
                ? industryH
                : findMostDistantHue(assignedHues);
        palette[role] = oklchToHex(
            preset.syntaxL,
            dampedChroma(genH, syntaxChroma, characterHues),
            genH,
        );
        roleSource[role] = "generated";
        assignedHues.push(genH);
    }

    // ── 結果の結合 ─────────────────────────────────────────────────────────────
    const source: Record<SyntaxRole, ColorSource> = {
        fn: "accent",
        kw: kwSource,
        field: roleSource.field ?? "generated",
        string: roleSource.string ?? "generated",
        type: roleSource.type ?? "generated",
        op: roleSource.op ?? "generated",
        const: roleSource.const ?? "generated",
        special: roleSource.special ?? "generated",
    };

    return {
        bg,
        fg,
        accent,
        comment,
        error,
        fn: fnHex,
        kw: kwHex,
        // biome-ignore lint/style/noNonNullAssertion: Phase 3 で全ての未割り当てロールが埋まることを保証
        field: palette.field!,
        // biome-ignore lint/style/noNonNullAssertion: Phase 3 で全ての未割り当てロールが埋まることを保証
        string: palette.string!,
        // biome-ignore lint/style/noNonNullAssertion: Phase 3 で全ての未割り当てロールが埋まることを保証
        type: palette.type!,
        // biome-ignore lint/style/noNonNullAssertion: Phase 3 で全ての未割り当てロールが埋まることを保証
        op: palette.op!,
        // biome-ignore lint/style/noNonNullAssertion: Phase 3 で全ての未割り当てロールが埋まることを保証
        const: palette.const!,
        // biome-ignore lint/style/noNonNullAssertion: Phase 3 で全ての未割り当てロールが埋まることを保証
        special: palette.special!,
        source,
        syntaxChroma,
        vibrantC: vibrantLch.c ?? 0,
        toneCategory,
    };
};

// ── デバッグ出力 ──────────────────────────────────────────────────────────────

const SYNTAX_ROLES_ORDERED: SyntaxRole[] = [
    "fn",
    "kw",
    "field",
    "string",
    "type",
    "op",
    "const",
    "special",
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
    lines.push(`tone:         ${palette.toneCategory}`);
    lines.push(`syntaxChroma: ${palette.syntaxChroma.toFixed(3)}`);
    lines.push("");

    lines.push(`bg       ${palette.bg}`);
    lines.push(`fg       ${palette.fg}`);
    lines.push(`accent   ${palette.accent}`);
    lines.push(`comment  ${palette.comment}`);
    lines.push(`error    ${palette.error}`);
    lines.push("");

    for (const role of SYNTAX_ROLES_ORDERED) {
        const srcLabel =
            palette.source[role] === "accent"
                ? "accent"
                : palette.source[role] === "image"
                  ? "画像"
                  : "生成";
        lines.push(`${role.padEnd(7)}  ${palette[role]}  [${srcLabel}]`);
    }

    return lines.join("\n");
};
