import { formatHex, oklch, parse } from "culori";
import type { ColorPoint } from "@/features/color-extractor/types";
import { HUE_RULES } from "./hue-rules";
import type { HighlightMap, ThemeVariants } from "./types";

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
 * Hue 値からグループ名を返す。合致しない場合は null。
 */
const matchHueGroup = (h: number): string | null => {
    for (const rule of HUE_RULES) {
        if (h >= rule.min && h < rule.max) {
            return rule.group;
        }
    }
    return null;
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
 * ライトテーマ用に明度を反転させる
 */
const invertForLight = (hex: string, isFg: boolean): string => {
    const c = oklch(parse(hex));
    if (!c) {
        return hex;
    }
    return formatHex({ ...c, l: (1 - c.l) * (isFg ? 0.8 : 0.9) }) ?? hex;
};

/**
 * HighlightMap のすべての fg/bg を反転してライトテーマ用マップを生成する
 */
const buildLightMap = (dark: HighlightMap): HighlightMap => {
    const light: HighlightMap = {};

    for (const [group, attr] of Object.entries(dark)) {
        if (group === "Normal") {
            // Normal は bg ↔ fg を入れ替えてから反転
            light[group] = {
                ...attr,
                fg: attr.bg ? invertForLight(attr.bg, true) : attr.fg,
                bg: attr.fg ? invertForLight(attr.fg, false) : attr.bg,
            };
        } else {
            light[group] = {
                ...attr,
                fg: attr.fg ? invertForLight(attr.fg, true) : undefined,
                bg: attr.bg ? invertForLight(attr.bg, false) : undefined,
            };
        }
    }

    return light;
};

/**
 * ColorPoint[] から Neovim ハイライトグループへのマッピングを行い
 * ダーク・ライト両テーマを生成する
 *
 * @param palette - R1 で抽出した ColorPoint の配列（OKLab 抽出・12色想定）
 * @returns ダーク・ライト両テーマを含む ThemeVariants
 */
export const mapColorsToTheme = (palette: ColorPoint[]): ThemeVariants => {
    const colors = toOklchColors(palette);

    if (colors.length === 0) {
        const fallback: HighlightMap = {
            Normal: { fg: "#ffffff", bg: "#000000" },
        };
        return { dark: fallback, light: fallback };
    }

    // Step 2: 基準色の確定
    const sorted = [...colors].sort((a, b) => a.l - b.l);
    const bgColor = sorted[0];
    const fgColor = sorted[sorted.length - 1];

    const usedHexes = new Set<string>([bgColor.hex, fgColor.hex]);

    const remaining = colors.filter((c) => !usedHexes.has(c.hex));

    // C 最小 → Comment.fg
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

    // accent 候補: C 降順
    const accents = colors
        .filter((c) => !usedHexes.has(c.hex))
        .sort((a, b) => b.c - a.c);

    // Step 3: Hue レンジによるグループ分類
    const grouped = new Map<string, OklchColor>();
    for (const color of accents) {
        const group = matchHueGroup(color.h);
        if (!group) {
            continue;
        }
        const current = grouped.get(group);
        if (!current || color.c > current.c) {
            grouped.set(group, color);
        }
    }

    // Step 4: 未割り当てグループの補完
    const REQUIRED_GROUPS = [
        "String",
        "Function",
        "Keyword",
        "Special",
    ] as const;
    for (const group of REQUIRED_GROUPS) {
        if (grouped.has(group)) {
            continue;
        }

        // グループの代表 Hue（レンジ中心）を求める
        const targetHue = (() => {
            if (group === "Special") {
                return 0; // 赤系の中心
            }
            const rule = HUE_RULES.find((r) => r.group === group && r.min > 0);
            if (!rule) {
                return 0;
            }
            return (rule.min + rule.max) / 2;
        })();

        if (accents.length > 0) {
            // Hue 距離最小の色を使用
            const closest = accents.reduce((best, c) => {
                return hueDist(c.h, targetHue) < hueDist(best.h, targetHue)
                    ? c
                    : best;
            }, accents[0]);
            grouped.set(group, closest);
        } else {
            // accent 候補が空の場合: Normal.fg を shiftL で派生
            grouped.set(group, {
                ...fgColor,
                hex: shiftL(fgColor.hex, -0.1),
            });
        }
    }

    // Step 5: Number は Function と同色
    const functionColor = grouped.get("Function");
    if (functionColor && !grouped.has("Number")) {
        grouped.set("Number", functionColor);
    }

    // Step 6: HighlightMap を構築
    const commentHex = commentColor?.hex ?? shiftL(fgColor.hex, -0.2);
    const specialHex = grouped.get("Special")?.hex ?? fgColor.hex;
    const stringHex = grouped.get("String")?.hex ?? fgColor.hex;
    const typeHex = grouped.get("Type")?.hex ?? fgColor.hex;
    const keywordHex = grouped.get("Keyword")?.hex ?? fgColor.hex;
    const functionHex = grouped.get("Function")?.hex ?? fgColor.hex;
    const numberHex = grouped.get("Number")?.hex ?? functionHex;

    // PmenuSel.bg は C 最大の accent 色
    const pmenuSelHex = accents[0]?.hex ?? fgColor.hex;

    const dark: HighlightMap = {
        Normal: { fg: fgColor.hex, bg: bgColor.hex },
        Comment: { fg: commentHex, italic: true },
        String: { fg: stringHex },
        Type: { fg: typeHex },
        Keyword: { fg: keywordHex, bold: true },
        Function: { fg: functionHex },
        Special: { fg: specialHex },
        Number: { fg: numberHex },
        Boolean: { fg: numberHex },
        Operator: { fg: keywordHex },
        Variable: { fg: fgColor.hex },
        CursorLine: { bg: shiftL(bgColor.hex, 0.04) },
        Visual: { bg: shiftL(bgColor.hex, 0.08) },
        Pmenu: { bg: shiftL(bgColor.hex, 0.03) },
        PmenuSel: { bg: pmenuSelHex },
        LineNr: { fg: commentHex },
        CursorLineNr: { fg: shiftL(fgColor.hex, -0.1) },
    };

    const light = buildLightMap(dark);

    return { dark, light };
};
