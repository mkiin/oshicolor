import { clampChroma, formatHex, oklch, parse } from "culori";
import type { ColorPoint } from "@/features/color-extractor/types";
import type { ConceptName } from "./hue-rules";
import { C_FLOOR, THEME_CONCEPTS, ZONE_B_TARGETS } from "./hue-rules";
import type { HighlightMap } from "./types";

type OklchColor = {
    l: number;
    c: number;
    h: number;
    hex: string;
};

/**
 * Hue 距離を環状に計算する
 */
const hueDist = (a: number, b: number): number => {
    return Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
};

/**
 * Hex 文字列の OKLch 明度を delta だけシフトして新しい Hex を返す
 */
const shiftL = (hex: string, delta: number): string => {
    const c = oklch(parse(hex));
    if (!c) {
        return hex;
    }
    return formatHex({ ...c, l: Math.min(1, Math.max(0, c.l + delta)) }) ?? hex;
};

/**
 * ColorPoint[] を OklchColor[] に変換し、変換できなかった色は除外する
 */
const toOklchColors = (points: ColorPoint[]): OklchColor[] => {
    const result: OklchColor[] = [];
    for (const point of points) {
        const parsed = oklch(parse(point.color));
        if (!parsed || parsed.h === undefined) {
            continue;
        }
        result.push({
            l: parsed.l,
            c: parsed.c,
            h: parsed.h,
            hex: point.color,
        });
    }
    return result;
};

/**
 * signatureHue を借用してニュートラル色を生成する。
 * C=0.02 のほぼ無彩色にすることで、鮮やかな色が bg/fg に来るのを防ぐ。
 * Hue だけ引き継ぐのでキャラクターの「空気感」が薄く残る。
 */
const generateNeutral = (l: number, h: number): string => {
    const generated = clampChroma(
        { mode: "oklch" as const, l, c: 0.02, h },
        "oklch",
        "rgb",
    );
    return formatHex(generated) ?? "#000000";
};

/**
 * Zone B 補完色を生成する。
 * accents[3] 以降に targetHue 付近の色があればそれを使い、
 * なければ象徴色（accents[0]）から補完色を生成する。
 */
const generateSupplemental = (
    targetHue: number,
    hueRange: number,
    zoneBCandidates: OklchColor[],
    signature: OklchColor,
    isDark: boolean,
    bgL: number,
    fgL: number,
    cRatio: number,
): string => {
    // Step 1: zoneBCandidates に targetHue 付近の色があるか確認（抽出色優先）
    const found = zoneBCandidates.find(
        (c) => hueDist(c.h, targetHue) <= hueRange,
    );
    if (found) {
        return found.hex;
    }

    // Step 2: 象徴色を基準に補完色を生成
    // コンセプトに応じて L の計算方向を変える（ライトテーマは反転）
    const l = isDark
        ? Math.max(bgL + 0.35, signature.l + 0.08)
        : Math.max(fgL + 0.25, signature.l - 0.08);
    const c = Math.max(signature.c * cRatio, C_FLOOR);

    const tryClamp = (h: number): { hex: string; chroma: number } | null => {
        const clamped = clampChroma(
            { mode: "oklch" as const, l, c, h },
            "oklch",
            "rgb",
        );
        const clampedOklch = oklch(clamped);
        if (!clampedOklch) {
            return null;
        }
        return {
            hex: formatHex(clamped) ?? signature.hex,
            chroma: clampedOklch.c ?? 0,
        };
    };

    // Step 3: ガマットクランプ
    const first = tryClamp(targetHue);
    if (!first) {
        return (
            formatHex({
                mode: "oklch" as const,
                l,
                c: C_FLOOR,
                h: targetHue,
            }) ?? signature.hex
        );
    }

    // Step 4: クランプ後に C < C_FLOOR なら Hue を +20° シフトして再試行
    if (first.chroma < C_FLOOR) {
        const shifted = tryClamp((targetHue + 20) % 360);
        if (shifted && shifted.chroma >= C_FLOOR) {
            return shifted.hex;
        }
        // それでも C_FLOOR 未満: C_FLOOR に固定
        return (
            formatHex({
                mode: "oklch" as const,
                l,
                c: C_FLOOR,
                h: targetHue,
            }) ?? signature.hex
        );
    }

    return first.hex;
};

/**
 * ColorPoint[] から Neovim ハイライトグループへのマッピングを行い
 * HighlightMap を生成する。
 *
 * Zone A: 抽出色を C 値ランクで直接割り当て（Hue 非依存）
 * Zone B: 不足 Hue を象徴色から補完色生成で補完
 *
 * bg は抽出色から取らず、象徴色（C最大）の Hue を借用したニュートラル色を生成する。
 * fg は閾値チェックを行い、未達の場合はニュートラル色を生成する。
 * これにより「鮮やかな暗色が bg になる」問題と「パステル系でのダークテーマ崩壊」を解消する。
 *
 * @param palette - R1 で抽出した ColorPoint の配列
 * @param conceptName - テーマコンセプト（デフォルト: "darkClassic"）
 * @returns Neovim ハイライトグループのマッピング
 */
export const mapColorsToTheme = (
    palette: ColorPoint[],
    conceptName: ConceptName = "darkClassic",
): HighlightMap => {
    const concept = THEME_CONCEPTS[conceptName];
    const colors = toOklchColors(palette);

    if (colors.length === 0) {
        return { Normal: { fg: "#c8c093", bg: "#1f1f28" } };
    }

    // Step 1: 象徴色（C 最大）の Hue を取得（signatureHue）
    // bg・fg のニュートラル色生成に使う（キャラクターの「空気感」を薄く引き継ぐ）
    // fallback は 270°（紫系）
    const sortedByC = [...colors].sort((a, b) => b.c - a.c);
    const signatureHue = sortedByC[0]?.h ?? 270;

    // Step 2: bg をニュートラル色として生成（抽出色から取らない）
    // C=0.02 のほぼ無彩色なので鮮やかな色が bg に来ることがなくなる
    const bgHex = generateNeutral(concept.bgL, signatureHue);

    // Step 3: fg の選択（閾値チェック）
    // 閾値に達しない場合はニュートラル色を生成してテーマ成立を保証する
    let fgHex: string;
    if (concept.isDark) {
        // ダークテーマ: L 最大の抽出色が fgThreshold 以上なら採用
        const sortedByLDesc = [...colors].sort((a, b) => b.l - a.l);
        const fgCandidate = sortedByLDesc[0];
        fgHex =
            fgCandidate && fgCandidate.l >= concept.fgThreshold
                ? fgCandidate.hex
                : generateNeutral(concept.fgL, signatureHue);
    } else {
        // ライトテーマ: L 最小の抽出色が fgThreshold 以下なら採用
        const sortedByLAsc = [...colors].sort((a, b) => a.l - b.l);
        const fgCandidate = sortedByLAsc[0];
        fgHex =
            fgCandidate && fgCandidate.l <= concept.fgThreshold
                ? fgCandidate.hex
                : generateNeutral(concept.fgL, signatureHue);
    }

    // Step 4: Comment（C 最小の抽出色）
    const sortedByCasc = [...colors].sort((a, b) => a.c - b.c);
    const commentColor = sortedByCasc[0] ?? null;

    // Step 5: Zone A accents
    // bg は生成色なので除外不要。fg の採用有無に関わらず除外しない。
    // comment のみ除外 → 最大 11 色が accent 候補になる（v2 は最大 9 色）
    const usedHexes = new Set<string>();
    if (commentColor) {
        usedHexes.add(commentColor.hex);
    }

    const accents = colors
        .filter((c) => !usedHexes.has(c.hex))
        .sort((a, b) => b.c - a.c);

    // Zone A 割り当て（C ランク直接）
    // 抽出色不足時は fgHex を shiftL して代替する
    const keywordHex = accents[0]?.hex ?? shiftL(fgHex, -0.05);
    const functionHex = accents[1]?.hex ?? shiftL(fgHex, -0.1);
    const specialHex = accents[2]?.hex ?? shiftL(fgHex, -0.15);

    // Zone B: accents[3] 以降を候補として補完色を生成
    // 象徴色（C 最大の accent = keyword の色）を基準にする
    // colors が空でないことは上部で保証済み
    const topCColor = colors.reduce((max, c) => (c.c > max.c ? c : max));
    const signature = accents[0] ?? topCColor;
    const zoneBCandidates = accents.slice(3);
    const supplemental: Record<string, string> = {};
    for (const target of ZONE_B_TARGETS) {
        supplemental[target.group] = generateSupplemental(
            target.targetHue,
            target.hueRange,
            zoneBCandidates,
            signature,
            concept.isDark,
            concept.bgL,
            concept.fgL,
            concept.cRatio,
        );
    }

    const commentHex = commentColor?.hex ?? shiftL(fgHex, -0.2);
    // PmenuSel は最も鮮やかな accent 色（キャラクター象徴色）
    const pmenuSelHex = accents[0]?.hex ?? fgHex;

    // CursorLine / Visual / Pmenu: ダークテーマは明るく、ライトテーマは暗くシフト
    const cursorLineBg = shiftL(bgHex, concept.isDark ? +0.04 : -0.04);
    const visualBg = shiftL(bgHex, concept.isDark ? +0.08 : -0.08);
    const pmenuBg = shiftL(bgHex, concept.isDark ? +0.03 : -0.03);

    return {
        Normal: { fg: fgHex, bg: bgHex },
        Comment: { fg: commentHex, italic: true },
        Keyword: { fg: keywordHex, bold: true },
        Function: { fg: functionHex },
        Special: { fg: specialHex },
        String: { fg: supplemental.String },
        Type: { fg: supplemental.Type },
        Number: { fg: supplemental.Number },
        Boolean: { fg: supplemental.Number },
        Operator: { fg: keywordHex },
        Variable: { fg: fgHex },
        CursorLine: { bg: cursorLineBg },
        Visual: { bg: visualBg },
        Pmenu: { bg: pmenuBg },
        PmenuSel: { bg: pmenuSelHex },
        LineNr: { fg: commentHex },
        CursorLineNr: { fg: shiftL(fgHex, -0.1) },
    };
};
