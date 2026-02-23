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
    /** @keyword — fn と最も対比的な画像色 */
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
};

// ── 内部型 ────────────────────────────────────────────────────────────────────

type Candidate = {
    hex: string;
    lch: Oklch;
    groupSize: number;
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

const L_MIN = 0.45;
const L_MAX = 0.82;
const C_MIN = 0.04;
const MIN_SW = 3;

const FN_L_MIN = 0.58;
const FN_L_MAX = 0.75;
const FN_C_FACTOR = 0.85;
/** fn_C の下限: accent が低彩度でも bg に対して視認できる最低限 */
const C_FLOOR = 0.08;

const KW_MIN_DIST = 60;
const KW_L_MIN = 0.5;
const KW_L_MAX = 0.78;
const KW_FALLBACK_PRIMARY_H = 275;
const KW_FALLBACK_MIN_DIST = 40;
const KW_GROUP_BONUS = 0.3;

const SYNTAX_L = 0.72;
const MIN_HUE_SEP = 35;
const PHASE1_MATCH_THRESHOLD = 50;
/** 最大減衰率: キャラの色相から 180° 離れた生成色で 50% 減衰 */
const DAMPING_FACTOR = 0.5;

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

// ── メイン関数 ───────────────────────────────────────────────────────────────

/**
 * node-vibrant の VibrantResult から Neovim カラースキーム用パレットを生成する
 *
 * アルゴリズム:
 *   Step 1   : bg / fg / accent / comment / error を決定
 *   Step 4   : hueGroups から候補色を抽出（L・C フィルタ）
 *   Step 5   : fn = accent の L を読みやすい範囲に調整
 *   Step 6   : kw = fn と最も色相が離れた画像色
 *   Step 7.1 : 業界標準 Hue に近い画像色をマッチング（string/type/const）
 *   Step 7.2 : 残りロールに色相が最も分散する画像色を割り当て
 *   Step 7.25: syntaxChroma = 画像由来色の chroma 中央値
 *   Step 7.3 : 未割り当てロールを OKLch 生成色で補完
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

    // キャラクターの主要色相（生成色の chroma damping に使用）
    const characterHues: number[] = [];
    for (const lch of [darkMutedLch, vibrantLch, mutedLch, lightMutedLch]) {
        if ((lch.c ?? 0) > 0.01 && lch.h !== undefined) {
            characterHues.push(lch.h);
        }
    }

    // ── Step 4: 候補色の抽出 ───────────────────────────────────────────────────
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

    // ── Step 5: fn の決定 ──────────────────────────────────────────────────────
    const fnH = vibrantLch.h ?? 0;
    const fnL = Math.max(FN_L_MIN, Math.min(FN_L_MAX, vibrantLch.l));
    const fnC = Math.max(C_FLOOR, (vibrantLch.c ?? 0) * FN_C_FACTOR);
    const fnHex = oklchToHex(fnL, fnC, fnH);

    // 割り当て済み色相（fn から始まり順次追加される）
    const assignedHues: number[] = [fnH];

    // ── Step 6: kw の決定 ──────────────────────────────────────────────────────
    let kwHex = "";
    let kwSource: ColorSource = "generated";
    let kwBestScore = -Infinity;

    for (const { hex, lch, groupSize } of candidates) {
        const h = lch.h ?? 0;
        if (angularDistance(h, fnH) <= KW_MIN_DIST) continue;
        if (lch.l < KW_L_MIN || lch.l > KW_L_MAX) continue;
        if ((lch.c ?? 0) < C_MIN) continue;
        if (!isSeparated(h, assignedHues)) continue;

        // スコア: fn からの距離 + グループ色数ボーナス（キャラに多い色を優先）
        const score = angularDistance(h, fnH) + groupSize * KW_GROUP_BONUS;
        if (score > kwBestScore) {
            kwBestScore = score;
            kwHex = hex;
            kwSource = "image";
        }
    }

    if (!kwHex) {
        // 紫(275°)が fn と十分離れていれば紫、そうでなければ fn から 150°
        const fallbackH =
            angularDistance(KW_FALLBACK_PRIMARY_H, fnH) >= KW_FALLBACK_MIN_DIST
                ? KW_FALLBACK_PRIMARY_H
                : (fnH + 150) % 360;
        kwHex = oklchToHex(SYNTAX_L, C_FLOOR, fallbackH);
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

    // Phase 3: 生成色で補完（画像にない色相を OKLch で直接生成）
    for (const role of REMAINING_ROLES.filter((r) => !palette[r])) {
        const industryH = INDUSTRY_HUES[role];
        const genH =
            industryH !== undefined && isSeparated(industryH, assignedHues)
                ? industryH
                : findMostDistantHue(assignedHues);
        palette[role] = oklchToHex(
            SYNTAX_L,
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
