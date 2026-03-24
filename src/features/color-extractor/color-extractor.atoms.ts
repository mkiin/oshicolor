import { getColor, getPalette } from "colorthief";
import { Vibrant } from "node-vibrant/browser";
import { atom } from "jotai";
import { deriveColorAxes } from "./color-axes";

const OPTIONS_BASE = {
  quality: 10,
  colorSpace: "rgb" as const,
  ignoreWhite: true,
  minSaturation: 0.05,
} satisfies Parameters<typeof getPalette>[1];

const OPTIONS = { ...OPTIONS_BASE, colorCount: 16 } satisfies Parameters<
  typeof getPalette
>[1];

export const fileAtom = atom<File | null>(null);

export const previewUrlAtom = atom((get) => {
  const file = get(fileAtom);
  return file ? URL.createObjectURL(file) : null;
});

export const colorPaletteAtom = atom(async (get) => {
  const file = get(fileAtom);
  if (!file) return null;
  const bitmap = await createImageBitmap(file);
  return getPalette(bitmap, OPTIONS);
});

export const colorAtom = atom(async (get) => {
  const file = get(fileAtom);
  if (!file) return null;
  const bitmap = await createImageBitmap(file);
  return getColor(bitmap, OPTIONS_BASE);
});

export const colorSwatchesAtom = atom(async (get) => {
  const url = get(previewUrlAtom);
  if (!url) return null;
  return Vibrant.from(url).getPalette();
});

export const colorAxesAtom = atom(async (get) => {
  const colors = await get(colorPaletteAtom);
  if (!colors) return null;
  return deriveColorAxes(colors);
});

const SEED_COUNT = 5;

const SEED_OPTIONS = {
  ...OPTIONS_BASE,
  colorCount: SEED_COUNT,
} satisfies Parameters<typeof getPalette>[1];

/** ドミナント 5色を seed として抽出する */
export const seedColorsAtom = atom(async (get) => {
  const file = get(fileAtom);
  if (!file) return null;
  const bitmap = await createImageBitmap(file);
  return getPalette(bitmap, SEED_OPTIONS);
});
