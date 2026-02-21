/**
 * OKLch の Hue 値（0〜360°）からハイライトグループ名へのマッピングルール。
 * Special は赤系で 0° をまたぐため2エントリで表現する。
 */
export const HUE_RULES: Array<{ min: number; max: number; group: string }> = [
    { min: 330, max: 360, group: "Special" },
    { min: 0, max: 30, group: "Special" },
    { min: 30, max: 90, group: "Function" },
    { min: 90, max: 150, group: "String" },
    { min: 150, max: 210, group: "Type" },
    { min: 210, max: 270, group: "Keyword" },
    { min: 270, max: 330, group: "Keyword" },
];
