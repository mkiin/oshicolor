import type { ColorSpace } from "colorthief";
import { getColor, getPalette, getSwatches } from "colorthief";
import { atom } from "jotai";
import { deriveColorAxes } from "./color-axes";

/** 抽出に使用する色空間 */
export const colorSpaceAtom = atom<ColorSpace>("rgb");

const OPTIONS_BASE = {
  quality: 10,
  ignoreWhite: true,
  minSaturation: 0.05,
} as const;

const PALETTE_COUNT = 16;
const SEED_COUNT = 5;

export const fileAtom = atom<File | null>(null);

export const previewUrlAtom = atom((get) => {
  const file = get(fileAtom);
  return file ? URL.createObjectURL(file) : null;
});

export const colorPaletteAtom = atom(async (get) => {
  const file = get(fileAtom);
  if (!file) return null;
  const colorSpace = get(colorSpaceAtom);
  const bitmap = await createImageBitmap(file);
  return getPalette(bitmap, {
    ...OPTIONS_BASE,
    colorSpace,
    colorCount: PALETTE_COUNT,
  });
});

export const colorAtom = atom(async (get) => {
  const file = get(fileAtom);
  if (!file) return null;
  const colorSpace = get(colorSpaceAtom);
  const bitmap = await createImageBitmap(file);
  return getColor(bitmap, { ...OPTIONS_BASE, colorSpace });
});

export const colorSwatchesAtom = atom(async (get) => {
  const file = get(fileAtom);
  if (!file) return null;
  const colorSpace = get(colorSpaceAtom);
  const bitmap = await createImageBitmap(file);
  return getSwatches(bitmap, {
    ...OPTIONS_BASE,
    colorSpace,
    colorCount: PALETTE_COUNT,
  });
});

export const colorAxesAtom = atom(async (get) => {
  const colors = await get(colorPaletteAtom);
  if (!colors) return null;
  return deriveColorAxes(colors);
});

/** ドミナント 5色を seed として抽出する */
export const seedColorsAtom = atom(async (get) => {
  const file = get(fileAtom);
  if (!file) return null;
  const colorSpace = get(colorSpaceAtom);
  const bitmap = await createImageBitmap(file);
  return getPalette(bitmap, {
    ...OPTIONS_BASE,
    colorSpace,
    colorCount: SEED_COUNT,
  });
});
