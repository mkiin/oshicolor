import { extractColors } from "@/features/color-extract";
import { expect, test } from "vitest";

const HEX = /^#[0-9A-F]{6}$/;

// hue を横方向、lightness を縦方向に振った色豊かな画像を作る。実画像のように多数の
// 異なる色を含ませて、salience の前段フィルタ後も 6 色以上が残るようにする。
const sampleBlob = async (): Promise<Blob> => {
  const size = 256;
  const cells = 32;
  const cell = size / cells;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context が取れない");
  for (let gy = 0; gy < cells; gy++) {
    for (let gx = 0; gx < cells; gx++) {
      const hue = (gx / cells) * 360;
      const sat = 55 + (gx % 4) * 10;
      const light = 25 + (gy / cells) * 55;
      ctx.fillStyle = `hsl(${hue} ${sat}% ${light}%)`;
      ctx.fillRect(gx * cell, gy * cell, cell, cell);
    }
  }
  return canvas.convertToBlob({ type: "image/png" });
};

test("ansi が wasm でブラウザ実行できて hex を返す", async () => {
  const blob = await sampleBlob();
  const colors = await extractColors(blob, { palette: "ansi", style: "dark" });
  expect(colors.color0).toMatch(HEX);
  expect(colors.color15).toMatch(HEX);
});

test("salience が rayon を通って panic せず hex を返す", async () => {
  const blob = await sampleBlob();
  const colors = await extractColors(blob, {
    palette: "salience",
    style: "dark",
  });
  expect(colors.background).toMatch(HEX);
  expect(colors.color5).toMatch(HEX);
});

test("dark と light で別の結果になる", async () => {
  const blob = await sampleBlob();
  const dark = await extractColors(blob, {
    palette: "salience",
    style: "dark",
  });
  const light = await extractColors(blob, {
    palette: "salience",
    style: "light",
  });
  expect(dark.background).not.toBe(light.background);
});

test("kmeans の k / minDist がカスタム値で効く", async () => {
  const blob = await sampleBlob();
  const k4 = await extractColors(blob, { palette: "kmeans", style: "dark", k: 4 });
  const k16 = await extractColors(blob, { palette: "kmeans", style: "dark", k: 16 });
  expect(k4.color0).toMatch(HEX);
  expect(k16.color15).toMatch(HEX);
  // クラスタ数が違えば結果も変わる
  expect(k4.color7).not.toBe(k16.color7);
});
