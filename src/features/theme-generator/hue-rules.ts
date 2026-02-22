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

/**
 * テーマコンセプトの識別子
 */
export type ConceptName = "darkClassic" | "lightPastel";

/**
 * テーマコンセプトの設定
 */
export type ConceptConfig = {
    /** ダークテーマかどうか（bg/fg の明暗シフト方向を決定する） */
    isDark: boolean;
    /** bg のニュートラル色生成時の OKLch 明度 */
    bgL: number;
    /** neutral fg 生成時の OKLch 明度 */
    fgL: number;
    /** fg 抽出色採用の閾値（ダーク: L >= threshold で採用、ライト: L <= threshold で採用） */
    fgThreshold: number;
    /** 象徴色 C に対する Zone B 脇役色 C の比率 */
    cRatio: number;
};

/**
 * 提供する 3 種のテーマコンセプト。
 * bg は抽出色から取らずに signatureHue を借用したニュートラル色として生成する。
 */
export const THEME_CONCEPTS: Record<ConceptName, ConceptConfig> = {
    darkClassic: {
        isDark: true,
        bgL: 0.12,
        fgL: 0.88,
        fgThreshold: 0.7,
        cRatio: 0.35,
    },
    lightPastel: {
        isDark: false,
        bgL: 0.97,
        fgL: 0.15,
        fgThreshold: 0.35,
        cRatio: 0.4,
    },
};
