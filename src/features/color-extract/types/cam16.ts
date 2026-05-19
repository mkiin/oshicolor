/** 周辺視野の明るさ環境 (CIE CAM16 の Surround パラメータ) */
export type Surround = "average" | "dim" | "dark";

/**
 * CAM16 の観察条件入力。
 * wallust v4 の `Histogram::new_empty` (library/wallust/src/histogram/mod.rs:208-222) と同じ
 * セマンティクスで dark / light テーマで使い分ける。
 */
export type Parameters = {
    /** Adapting luminance L_A (cd/m²)。dark テーマで 140、light テーマで 500 を使う */
    lA: number;
    /** Background luminance Y_b の相対値 (0..1)。dark で 0.2、light で 0.8 */
    yB: number;
    /** Surround の明るさ環境。wallust は両テーマで Average を使う */
    surround: Surround;
};

/**
 * Parameters から導出した係数群。画像に依存しないので 1 度焼いて Web Worker で使い回す。
 * palette クレートの `BakedParameters` と同じ係数を保持する (フィールド名は wallust 流の snake_case を TS の camelCase に変換)。
 */
export type BakedParameters = {
    /** 再構成・デバッグ用の入力 */
    params: Parameters;
    /** 白点に対する achromatic response Aw */
    aw: number;
    /** Surround dependent factor F */
    f: number;
    /** Surround dependent factor c */
    c: number;
    /** Surround dependent factor Nc */
    nc: number;
    /** Degree of chromatic adaptation D (post-clamp 0..1) */
    d: number;
    /** Luminance level adaptation factor Fl */
    fl: number;
    /** Inductive factor n = Y_b / Y_w */
    n: number;
    /** Coefficient z = 1.48 + sqrt(n) */
    z: number;
    /** Background induction factor Nbb */
    nbb: number;
    /** Chromatic induction factor Ncb (Nbb と同値) */
    ncb: number;
    /** 焼き込まれた白点 (XYZ, D65 想定) */
    whitePoint: { x: number; y: number; z: number };
};

/**
 * CAM16-UCS Jmh の出力。palette クレートの `Cam16UcsJmh<f32>` と同じ範囲・単位。
 * hue は palette クレートの実装に合わせて -180..180 degree とする。
 */
export type Cam16UcsJmh = {
    /** J': lightness, 0..100 */
    j: number;
    /** M': colorfulness, >= 0 */
    m: number;
    /** h: hue angle in degrees, -180..180 */
    h: number;
};
