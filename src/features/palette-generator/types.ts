/** NamedPalette の各ロール名 */
export type PaletteRole =
    | "bg"
    | "bgSubtle"
    | "bgHighlight"
    | "fg"
    | "fgDim"
    | "fgFaint"
    | "accent"
    | "synFunction"
    | "synKeyword"
    | "synString"
    | "synType"
    | "synConstant"
    | "synIdentifier"
    | "diagError"
    | "diagWarn"
    | "diagInfo"
    | "diagHint";

/**
 * 役割ベースの17色パレット
 *
 * Neovim カラースキーム生成の中間表現。各ロールに HEX 文字列 (#rrggbb) が対応する。
 */
export type NamedPalette = Record<PaletteRole, string>;

/**
 * 画像から選ばれたシグネチャカラー
 *
 * スコア C² × (pop / maxPop) で選出された、その画像を最も代表する有彩色。
 */
export type SignatureColor = {
    /** HEX文字列 "#rrggbb" */
    hex: string;
    /** OKLch L（明度、0–1） */
    l: number;
    /** OKLch C（彩度） */
    c: number;
    /** OKLch H（色相、0–360°） */
    h: number;
};

/**
 * 画像のトーンプロファイル
 *
 * characterSaturation は「キャラクターの空気感」を表す。
 * 高い値（0.15+）は鮮やかなキャラクター、低い値（0.05 前後）はモノクロ・くすみ系。
 */
export type ToneProfile = {
    /** population 加重平均の OKLch C（画像全体の彩度感） */
    characterSaturation: number;
    /** ニュートラル系色の Hue 偏り（背景や影の色温度） */
    temperatureSign: "warm" | "cool" | "neutral";
};

/**
 * HueZone カバレッジ診断
 *
 * 画像から6ゾーンのうちいくつが直接取得できたかを示す。
 * coveredCount < 4 の場合は characterSaturation による合成を優先する。
 */
export type HueCoverage = {
    /** 有効なスウォッチが存在するゾーン数（0–6） */
    coveredCount: number;
    /** ゾーン名 → 有効フラグ のマップ */
    zones: Record<string, boolean>;
};
