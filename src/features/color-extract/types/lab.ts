// CIE Lab (D65 white point) の型。
// wallust の `palette::Lab<D65, f32>` に対応する。

export type Lab = {
    /** Lightness, 0..100 */
    l: number;
    /** a*: green (-) → red (+) */
    a: number;
    /** b*: blue (-) → yellow (+) */
    b: number;
};
