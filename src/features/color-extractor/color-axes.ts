import type { Color } from "colorthief";
import { useMode, modeOklch, type Rgb } from "culori/fn";
import { kmeans } from "ml-kmeans";
import type { ColorAxis } from "./color-extractor.types";

const CLUSTER_COUNT = 3;
const MIN_CHROMA = 0.03; // 彩度の下限値
const MIN_LIGHTNESS = 0.2; // 明度の下限値

// culoriの変換関数
const toOklch = useMode(modeOklch);

/**
 * 抽出した16色のカラーマップからK=3のクラスタに分けてキャラの色の軸を抽出する
 *
 * 1. colorsをoklch変換、無彩色・暗色を除外して有彩色リストを作成する
 * 2. 各色の色相Hをcos/sinの2次元座標に変換
 * 3. K=3でKmeansを実行する
 * 4. クラスタを支配度スコア（Σ(colorCount - idx)）降順でソートしてmain/sub/accentのroleを割り当てて返す
 */
export const deriveColorAxes = (colors: Color[]): ColorAxis[] => {
  // Step 1. colorsをoklch変換し、低彩度（C < MIN_CHROMA）と暗色（L < MIN_LIGHTNESS）を除外した有彩色リストを作成する
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
      if (
        o === undefined ||
        o.h === undefined ||
        o.c < MIN_CHROMA ||
        o.l < MIN_LIGHTNESS
      ) {
        return null;
      }
      return { color, idx, h: o.h };
    })
    .filter((o): o is { color: Color; idx: number; h: number } => o !== null);

  // Step 2. 各色の色相Hをcos/sinの2次元座標に変換する
  // 色相は円環（0°〜360°）なので、cos/sinで2次元座標に変換することで距離計算が正しくなる
  const huePoints = oklchs.map((o) => {
    const x = Math.cos((o.h * Math.PI) / 180);
    const y = Math.sin((o.h * Math.PI) / 180);
    return [x, y];
  });

  // Step 3. K=3でKmeansを実行する
  const kmeansResult = kmeans(huePoints, CLUSTER_COUNT, {
    initialization: "kmeans++",
    seed: 42,
  });

  // 各色にclusterIdを紐付ける
  const labeled = kmeansResult.clusters.map((clusterId, i) => ({
    clusterId,
    color: oklchs[i].color,
    idx: oklchs[i].idx,
  }));

  // Step 4. クラスタを支配度スコア降順でソートしてroleを割り当てて返す
  // スコア = Σ(colorCount - idx): パレット上位の色ほど高ウェイト × 色数が多いほど高スコア
  const colorCount = colors.length;
  const groups = Map.groupBy(labeled, (o) => o.clusterId);
  const ROLES = [
    "main",
    "sub",
    "accent",
  ] as const satisfies ColorAxis["role"][];
  return [...groups.values()]
    .sort(
      (a, b) =>
        b.reduce((sum, o) => sum + (colorCount - o.idx), 0) -
        a.reduce((sum, o) => sum + (colorCount - o.idx), 0),
    )
    .map((group, i) => ({
      colors: group.map((o) => o.color),
      role: ROLES[i],
    }));
};
