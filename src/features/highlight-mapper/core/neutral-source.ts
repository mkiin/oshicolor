import type { Color, OKLCH, SwatchMap } from "colorthief";

/**
 * neutral palette の hue 源を選定する
 *
 * 優先順: DkMuted → Muted → dominant の C 最低
 * colorthief が「控えめ」と判定した色の hue を bg に使うことで、
 * キャラの雰囲気を保ちつつ主張しすぎない背景になる。
 */
export const selectNeutralHue = (
  seeds: Color[],
  swatches: SwatchMap,
): OKLCH => {
  const dkMuted = swatches.DarkMuted;
  if (dkMuted) return dkMuted.color.oklch();

  const muted = swatches.Muted;
  if (muted) return muted.color.oklch();

  let lowestC = seeds[0];
  let lowestCValue = seeds[0].oklch().c;
  for (let i = 1; i < seeds.length; i++) {
    const c = seeds[i].oklch().c;
    if (c < lowestCValue) {
      lowestC = seeds[i];
      lowestCValue = c;
    }
  }
  return lowestC.oklch();
};
