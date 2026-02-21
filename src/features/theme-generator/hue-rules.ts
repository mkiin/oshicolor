/**
 * Zone B 補完色生成のための target Hue 定義表。
 * キャラクター色（Zone A）を補完する脇役色の Hue 目標値とレンジを定義する。
 */
export const ZONE_B_TARGETS: ReadonlyArray<{
    group: string;
    targetHue: number;
    hueRange: number;
}> = [
    { group: "String", targetHue: 130, hueRange: 45 }, // 緑系
    { group: "Type", targetHue: 195, hueRange: 45 }, // 水色系
    { group: "Number", targetHue: 55, hueRange: 45 }, // 黄金系
];

/**
 * Zone B 補完色生成の定数
 */
/** 補完色の最低彩度（パステルキャラクター対策） */
export const C_FLOOR = 0.06;
/** 象徴色の C に対する脇役の C の比率 */
export const C_RATIO = 0.35;
