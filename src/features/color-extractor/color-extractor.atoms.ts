import { getColor, getPalette, getSwatches } from "colorthief";
import { Vibrant } from "node-vibrant/browser";
import {
  QuantizerCelebi,
  Score,
  argbFromRgb,
  hexFromArgb,
} from "@material/material-color-utilities";
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
  const file = get(fileAtom);
  if (!file) return null;
  const bitmap = await createImageBitmap(file);
  return getSwatches(bitmap, OPTIONS);
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

/** node-vibrant の Palette を取得する */
export const vibrantPaletteAtom = atom(async (get) => {
  const url = get(previewUrlAtom);
  if (!url) return null;
  return Vibrant.from(url).getPalette();
});

const MCU_DESIRED_SEEDS = 6;
const MCU_MAX_COLORS = 128;
const MCU_SAMPLE_QUALITY = 10;

/**
 * MCU QuantizerCelebi + Score で Hue 分散・高 Chroma 優先の seed を抽出する
 *
 * ImageBitmap → Canvas → ImageData → ARGB[] → quantize → score → hex[]
 */
export const mcuSeedColorsAtom = atom(async (get) => {
  const file = get(fileAtom);
  if (!file) return null;

  const bitmap = await createImageBitmap(file);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  const pixels: number[] = [];

  for (let i = 0; i < imageData.data.length; i += 4 * MCU_SAMPLE_QUALITY) {
    const r = imageData.data[i];
    const g = imageData.data[i + 1];
    const b = imageData.data[i + 2];
    const a = imageData.data[i + 3];
    if (a < 125) continue;
    pixels.push(argbFromRgb(r, g, b));
  }

  const quantized = QuantizerCelebi.quantize(pixels, MCU_MAX_COLORS);
  const scored = Score.score(quantized, {
    desired: MCU_DESIRED_SEEDS,
  });

  return scored.map((argb) => hexFromArgb(argb));
});
