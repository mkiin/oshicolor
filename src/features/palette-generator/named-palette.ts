import type { Palette, Swatch } from "@oshicolor/color";
import { clampChroma, converter, formatHex } from "culori";

import {
    analyzeSignatureColor,
    analyzeToneProfile,
    diagnoseHueCoverage,
} from "./palette-analyzer";
import type { NamedPalette } from "./types";

const toOklch = converter("oklch");

/** 合成カラーのクロマ床値（これ未満にはならない） */
const SYNTH_CHROMA_FLOOR = 0.08;

/**
 * Syntax ゾーンごとの OKLch Hue（°）
 *
 * ZONE_SPECS は HSL H（0–1）を使うが、OKLch 合成は 0–360° スケール。
 * 視覚的に妥当な代表色相を割り当てている。
 */
const ZONE_OKLCH_H: Record<string, number> = {
    Function: 225,
    Keyword: 285,
    String: 140,
    Type: 185,
    Constant: 55,
    Identifier: 90,
};

/** OKLch → HEX（ガモット圧縮あり） */
const synthHex = (l: number, c: number, h: number): string => {
    const clamped = clampChroma({ mode: "oklch", l, c, h }, "oklch");
    return formatHex(clamped) ?? "#000000";
};

/**
 * 画像の Swatch と HueZone パレットから役割ベースの17色 NamedPalette を生成する
 *
 * - bg / fg は常に signatureH から OKLch で合成する（エディタ上で違和感のない配色）
 * - syntax: coveredCount ≥ 4 なら hueZonePalette 優先 + 不足分を合成
 *           coveredCount < 4 なら全ゾーンを characterSaturation で合成（赤系キャラ対応）
 * - diag: テーマ中立な固定値（Catppuccin Mocha ベース）
 *
 * @param swatches - 量子化で得た全 Swatch
 * @param hueZonePalette - HueZoneGenerator が生成したパレット
 */
export const generateNamedPalette = (
    swatches: Swatch[],
    hueZonePalette: Palette,
): NamedPalette => {
    const signature = analyzeSignatureColor(swatches);
    const tone = analyzeToneProfile(swatches);
    const coverage = diagnoseHueCoverage(hueZonePalette);

    // signatureH がない場合は青系をデフォルトにする
    const sigH = signature?.h ?? 225;
    const sigC = signature?.c ?? 0.1;

    // characterSaturation から合成クロマを決める（トーン継承）
    const synthChroma = Math.max(
        tone.characterSaturation * 0.85,
        SYNTH_CHROMA_FLOOR,
    );

    // ── bg: 暗め・低クロマ ───────────────────────────────────────────────────
    const bg = synthHex(0.13, Math.min(sigC * 0.12, 0.03), sigH);
    const bgSubtle = synthHex(0.17, Math.min(sigC * 0.15, 0.04), sigH);
    const bgHighlight = synthHex(0.22, Math.min(sigC * 0.2, 0.05), sigH);

    // ── fg: 明るめ・低クロマ ─────────────────────────────────────────────────
    const fg = synthHex(0.92, Math.min(sigC * 0.08, 0.02), sigH);
    const fgDim = synthHex(0.72, Math.min(sigC * 0.1, 0.03), sigH);
    const fgFaint = synthHex(0.55, Math.min(sigC * 0.12, 0.04), sigH);

    // ── accent = signatureColor そのもの ─────────────────────────────────────
    const accent = signature?.hex ?? synthHex(0.65, synthChroma, sigH);

    // ── syntax カラー ─────────────────────────────────────────────────────────
    // coveredCount ≥ 4: 画像優先（hueZone を使い、null は合成で補完）
    // coveredCount < 4: 全ゾーンを characterSaturation から合成（赤キャラ等）
    const useImageColors = coverage.coveredCount >= 4;

    const getSynHex = (slot: string): string => {
        if (useImageColors) {
            const swatch = hueZonePalette[slot];
            if (swatch) return swatch.hex.toLowerCase();
        }
        // 合成: characterSaturation をトーンとして引き継ぐ
        return synthHex(0.7, synthChroma, ZONE_OKLCH_H[slot] ?? 225);
    };

    // ── diag: Catppuccin Mocha 系の固定値 ────────────────────────────────────
    // テーマの「空気感」に依存せず視認性を保証する
    return {
        bg,
        bgSubtle,
        bgHighlight,
        fg,
        fgDim,
        fgFaint,
        accent,
        synFunction: getSynHex("Function"),
        synKeyword: getSynHex("Keyword"),
        synString: getSynHex("String"),
        synType: getSynHex("Type"),
        synConstant: getSynHex("Constant"),
        synIdentifier: getSynHex("Identifier"),
        diagError: "#f38ba8",
        diagWarn: "#fab387",
        diagInfo: "#89dceb",
        diagHint: "#a6e3a1",
    };
};

/**
 * OKLch 変換を用いて Swatch から characterSaturation を取得するユーティリティ
 *
 * @internal named-palette 内部で analyzeOklch が必要な場合に使う
 */
export const swatchOklchC = (swatch: Swatch): number => {
    const oklch = toOklch({
        mode: "rgb",
        r: swatch.r / 255,
        g: swatch.g / 255,
        b: swatch.b / 255,
    });
    return oklch?.c ?? 0;
};
