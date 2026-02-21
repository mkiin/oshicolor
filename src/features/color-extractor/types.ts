/**
 * 画像から抽出された1色分のデータ
 */
export type ColorPoint = {
    /** 1始まりの連番 */
    id: number;
    /** 正規化X座標（0〜1）: 画像上での出現位置 */
    x: number;
    /** 正規化Y座標（0〜1）: 画像上での出現位置 */
    y: number;
    /** HEX文字列 "#RRGGBB" */
    color: string;
    /** color-name-list による色名 */
    name?: string;
};
