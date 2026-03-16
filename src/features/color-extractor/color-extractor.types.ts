import type { Color } from "colorthief";

/**
 * クラスタリングで導出された色の軸
 *
 * クラスタ数が2個だと role は main または sub、
 * クラスタ数が3個だと main, sub, accent になる
 */
export type ColorAxis = {
    colors: Color[];
    role: "main" | "sub" | "accent";
};
