import type { Color } from "colorthief";
import { useMode, modeOklch, type Rgb } from "culori/fn";
import { kmeans } from "ml-kmeans";
import silhouetteScore from "@robzzson/silhouette";

// culoriの変換関数
const toOklch = useMode(modeOklch);

/**
 * 抽出した16色のカラーマップからクラスタに分けてキャラの色の軸を抽出する
 *
 * 1. colorsをoklch変換、C < 0.03 またL < 0.22の色を除外して有彩色リストを作成する
 * 2. 各色の色相Hをcos/sinの2次元座標に変換
 * 3. K=2, K=3でそれぞれKmeansを実行する。シルエット係数を計算する
 * 4. シルエット係数が高い方のKを採用する
 * 5. クラスタをidx(colorsの並び順)でソートして返す。
 */

/**
 * クラスタ数が2個だとroleは mainまたはsub
 * クラスタ数が3個だとmian, sub, accentに増やす
 */
export type ColorAxis = {
    colors: Color[];
    role: "main" | "sub" | "accent";
};

type KMeansCandidate = {
    k: number;
    score: number;
    kmeansResult: ReturnType<typeof kmeans>;
};

export const deriveColorAxes = (colors: Color[]): ColorAxis[] => {
    // Step 1. colorsをoklch変換し、無彩色（C < 0.03）と暗色（L < 0.22）を除外した有彩色リストを作成する
    // idxを保存しておくことで、クラスタリング後に元のcolorsの並び順でソートできる
    const oklchs = colors
        .map((color, idx) => {
            const rgb = color.rgb();
            const linearRgb: Rgb = {
                mode: "rgb",
                r: rgb.r / 255,
                g: rgb.g / 255,
                b: rgb.b / 255,
            };
            const o = toOklch(linearRgb);
            if (o === undefined || o.h === undefined) {
                return null;
            }
            return { color, idx, h: o.h };
        })
        .filter(
            (o): o is { color: Color; idx: number; h: number } => o !== null,
        );

    // Step 2. 各色の色相Hをcos/sinの2次元座標に変換する
    // 色相は円環（0°〜360°）なので、cos/sinで2次元座標に変換することで距離計算が正しくなる
    const huePoints = oklchs.map((o) => {
        const x = Math.cos((o.h * Math.PI) / 180);
        const y = Math.sin((o.h * Math.PI) / 180);
        return [x, y];
    });

    // Step 3. K=2, K=3でそれぞれKmeansを実行し、シルエット係数を計算する
    const results: KMeansCandidate[] = [];
    for (const k of [2, 3]) {
        const kmeansResult = kmeans(huePoints, k, {
            initialization: "kmeans++",
            seed: 42,
        });
        const score = silhouetteScore(huePoints, kmeansResult.clusters);
        results.push({ k, score, kmeansResult });
    }

    // Step 4. シルエット係数が高い方のKを採用する
    const best = results.reduce((a, b) => (a.score > b.score ? a : b));

    // 各色にclusterIdを紐付ける
    const labeled = best.kmeansResult.clusters.map((clusterId, i) => {
        return {
            clusterId,
            color: oklchs[i].color,
            idx: oklchs[i].idx,
        };
    });

    // Step 5. クラスタをidx（colorsの並び順）でソートしてroleを割り当てて返す
    const groups = Map.groupBy(labeled, (o) => o.clusterId);
    const ROLES = [
        "main",
        "sub",
        "accent",
    ] as const satisfies ColorAxis["role"][];
    return [...groups.values()]
        .sort(
            (a, b) =>
                a.reduce((min, o) => Math.min(min, o.idx), Infinity) -
                b.reduce((min, o) => Math.min(min, o.idx), Infinity),
        )
        .map((group, i) => ({
            colors: group.map((o) => o.color),
            role: ROLES[i],
        }));
};
