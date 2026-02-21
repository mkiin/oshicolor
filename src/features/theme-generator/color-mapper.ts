import { clampChroma, formatHex, oklch, parse } from "culori";
import type { ColorPoint } from "@/features/color-extractor/types";
import { C_FLOOR, C_RATIO, ZONE_B_TARGETS } from "./hue-rules";
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
 * Zone B 補完色を生成する。
 * accents[3] 以降に targetHue 付近の色があればそれを使い、
 * なければ象徴色（accents[0]）から補完色を生成する。
 */
const generateSupplemental = (
    targetHue: number,
    hueRange: number,
    zoneBCandidates: OklchColor[],
    signature: OklchColor,
    bgL: number,
): string => {
    // Step 1: zoneBCandidates に targetHue 付近の色があるか確認（抽出色優先）
    const found = zoneBCandidates.find(
        (c) => hueDist(c.h, targetHue) <= hueRange,
    );
    if (found) {
        return found.hex;
    }

    // Step 2: 象徴色を基準に補完色を生成
    // bg より 0.35 明るく保証し、彩度は signature の C_RATIO 倍（脇役色）
    const l = Math.max(bgL + 0.35, signature.l + 0.08);
    const c = Math.max(signature.c * C_RATIO, C_FLOOR);

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
 * ダークテーマの HighlightMap を生成する。
 *
 * Zone A: 抽出色を C 値ランクで直接割り当て（Hue 非依存）
 * Zone B: 不足 Hue を象徴色から補完色生成で補完
 *
 * 抽出色が少ない場合（count 未満）は fg の shiftL 派生でフォールバックする。
 *
 * @param palette - R1 で抽出した ColorPoint の配列
 * @returns Neovim ハイライトグループのマッピング
 */
export const mapColorsToTheme = (palette: ColorPoint[]): HighlightMap => {
    const colors = toOklchColors(palette);

    if (colors.length === 0) {
        return { Normal: { fg: "#c8c093", bg: "#1f1f28" } };
    }

    // Step 2: 基準色の確定（L 順ソート）
    const sorted = [...colors].sort((a, b) => a.l - b.l);
    const bgColor = sorted[0];
    const fgColor = sorted[sorted.length - 1];

    const usedHexes = new Set<string>([bgColor.hex, fgColor.hex]);
    const remaining = colors.filter((c) => !usedHexes.has(c.hex));

    // C 最小 → Comment.fg（最もくすんだ色）
    const commentColor =
        remaining.length > 0
            ? remaining.reduce(
                  (min, c) => (c.c < min.c ? c : min),
                  remaining[0],
              )
            : null;

    if (commentColor) {
        usedHexes.add(commentColor.hex);
    }

    // Zone A accents: used 以外を C 降順で列挙
    const accents = colors
        .filter((c) => !usedHexes.has(c.hex))
        .sort((a, b) => b.c - a.c);

    // Zone A 割り当て（C ランク直接）
    // 抽出色不足時は fgColor を shiftL して代替する
    const keywordColor =
        accents[0] ??
        ({ ...fgColor, hex: shiftL(fgColor.hex, -0.05) } satisfies OklchColor);
    const functionColor =
        accents[1] ??
        ({ ...fgColor, hex: shiftL(fgColor.hex, -0.1) } satisfies OklchColor);
    const specialColor =
        accents[2] ??
        ({ ...fgColor, hex: shiftL(fgColor.hex, -0.15) } satisfies OklchColor);

    // Zone B: accents[3] 以降を候補として補完色を生成
    // 象徴色（keywordColor）の L/C を基準に Hue だけ変えた脇役色を作る
    const zoneBCandidates = accents.slice(3);
    const supplemental: Record<string, string> = {};
    for (const target of ZONE_B_TARGETS) {
        supplemental[target.group] = generateSupplemental(
            target.targetHue,
            target.hueRange,
            zoneBCandidates,
            keywordColor,
            bgColor.l,
        );
    }

    const commentHex = commentColor?.hex ?? shiftL(fgColor.hex, -0.2);
    // PmenuSel は最も鮮やかな accent 色（キャラクター象徴色）
    const pmenuSelHex = accents[0]?.hex ?? fgColor.hex;

    return {
        Normal: { fg: fgColor.hex, bg: bgColor.hex },
        Comment: { fg: commentHex, italic: true },
        Keyword: { fg: keywordColor.hex, bold: true },
        Function: { fg: functionColor.hex },
        Special: { fg: specialColor.hex },
        String: { fg: supplemental.String },
        Type: { fg: supplemental.Type },
        Number: { fg: supplemental.Number },
        Boolean: { fg: supplemental.Number },
        Operator: { fg: keywordColor.hex },
        Variable: { fg: fgColor.hex },
        CursorLine: { bg: shiftL(bgColor.hex, 0.04) },
        Visual: { bg: shiftL(bgColor.hex, 0.08) },
        Pmenu: { bg: shiftL(bgColor.hex, 0.03) },
        PmenuSel: { bg: pmenuSelHex },
        LineNr: { fg: commentHex },
        CursorLineNr: { fg: shiftL(fgColor.hex, -0.1) },
    };
};
