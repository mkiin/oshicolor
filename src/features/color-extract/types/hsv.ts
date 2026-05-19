// HSV 色空間の型。wallust ansi pipeline 内部の中間表現として使う。

export type Hsv = {
    /** Hue 角度、0..360 (正の degree) */
    h: number;
    /** Saturation 0..1 */
    s: number;
    /** Value 0..1 */
    v: number;
};
