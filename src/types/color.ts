import type { Vibrant } from "node-vibrant/browser";

/** node-vibrant の getPalette() が返すパレット */
export type VibrantPalette = Awaited<ReturnType<Vibrant["getPalette"]>>;

/** node-vibrant の個別 Swatch（null でないもの） */
export type VibrantSwatch = NonNullable<VibrantPalette[keyof VibrantPalette]>;
