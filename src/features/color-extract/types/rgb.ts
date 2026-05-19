// sRGB を 0..1 の浮動小数で扱う型。wallust の `palette::Srgb<f32>` に対応する。

export type Rgb = {
    /** Red 0..1 */
    r: number;
    /** Green 0..1 */
    g: number;
    /** Blue 0..1 */
    b: number;
};
