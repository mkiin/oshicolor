/**
 * AI Vision カラー抽出スクリプト
 *
 * キャラクターイラストから象徴色 3 色 + theme_tone + neutral bg/fg を抽出する。
 * Google GenAI SDK + valibot Structured Output で型安全な JSON を取得。
 *
 * Usage: node scripts/test-vision-ai.ts debug/img/{game}/{char}.png [...]
 */

import { GoogleGenAI } from "@google/genai";
import { toJsonSchema } from "@valibot/to-json-schema";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import * as v from "valibot";

// ============================================================
// Schema (valibot)
// ============================================================

const HexColor = v.pipe(
  v.string(),
  v.regex(/^#[0-9a-fA-F]{6}$/),
  v.description("Hex color code, e.g. #ff0000"),
);

const ColorImpressionSchema = v.object({
  hex: HexColor,
  reason: v.pipe(
    v.string(),
    v.description("Why this color was chosen from the character's design"),
  ),
});

const VisionResultSchema = v.object({
  impression: v.pipe(
    v.object({
      primary: v.pipe(
        ColorImpressionSchema,
        v.description("The single most iconic/symbolic color of the character"),
      ),
      secondary: v.pipe(
        ColorImpressionSchema,
        v.description("The second most iconic color"),
      ),
      tertiary: v.pipe(
        ColorImpressionSchema,
        v.description("Third color from the character's design"),
      ),
    }),
    v.description(
      "The character's iconic colors extracted from the illustration (not background)",
    ),
  ),
  theme_tone: v.pipe(
    v.picklist(["dark", "light"]),
    v.description(
      "Choose the background tone that makes the character's colors look natural and comfortable for long reading sessions. Most characters suit dark. Choose light only when the character's palette is overwhelmingly pale or pastel.",
    ),
  ),
  neutral: v.pipe(
    v.object({
      bg_base_hex: v.pipe(
        HexColor,
        v.description(
          "Very dark bg for dark theme (OKLCH L≈0.14, C≈0.015) or very light for light theme (L≈0.95), tinted with the character's dominant hue",
        ),
      ),
      fg_base_hex: v.pipe(
        HexColor,
        v.description(
          "Light text for dark theme (OKLCH L≈0.87, C≈0.012) or dark text for light theme (L≈0.20)",
        ),
      ),
    }),
    v.description("Neutral background and foreground colors for the editor"),
  ),
});

type VisionResult = v.InferOutput<typeof VisionResultSchema>;

// ============================================================
// Config
// ============================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is not set. Run: source .env");
  process.exit(1);
}

const IMAGE_PATHS = process.argv.slice(2);
const OUTPUT_DIR = "debug/palette-v01";
const MODEL = "gemini-3-flash-preview";

const PROMPT = `This is a character illustration. Analyze the character's colors for a Neovim color scheme.

Rules:
- impression: the CHARACTER's iconic colors (not background). primary = single most symbolic color
- theme_tone: "dark" if the character's overall palette feels dark/cool/deep, "light" if bright/warm/pastel
- neutral.bg_base_hex: a very dark color (for dark theme) or very light color (for light theme), subtly tinted with the character's dominant hue. Approximate OKLCH: L=0.14, C=0.015 for dark; L=0.95, C=0.015 for light
- neutral.fg_base_hex: the opposite — light text for dark theme, dark text for light theme. Approximate OKLCH: L=0.87, C=0.012 for dark; L=0.20, C=0.012 for light
- Be precise with HEX values — estimate them as accurately as possible from what you see`;

// ============================================================
// SVG generation
// ============================================================

const textColor = (hex: string): string => {
  const h = hex.replace("#", "");
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 128 ? "#000000" : "#ffffff";
};

const SVG_WIDTH = 480;
const SWATCH_H = 50;
const NEUTRAL_H = 40;
const PADDING = 16;
const GAP = 4;

function generateSvg(name: string, data: VisionResult): string {
  const { impression, theme_tone, neutral } = data;

  const colors = [
    { label: "primary", ...impression.primary },
    { label: "secondary", ...impression.secondary },
    {
      label: "tertiary",
      hex: impression.tertiary?.hex ?? "#000000",
      reason: impression.tertiary?.reason ?? "—",
    },
  ];

  const innerW = SVG_WIDTH - PADDING * 2;
  const swatchW = (innerW - GAP * 2) / 3;
  const neutralW = (innerW - GAP) / 2;

  let y = PADDING;
  let body = "";

  body += `  <text x="${PADDING}" y="${y + 14}" fill="#aaaaaa" font-size="14" font-weight="bold">${name}</text>\n`;
  y += 26;

  for (let i = 0; i < colors.length; i++) {
    const c = colors[i];
    const x = PADDING + i * (swatchW + GAP);
    const tc = textColor(c.hex);
    body += `  <rect x="${x}" y="${y}" width="${swatchW}" height="${SWATCH_H}" fill="${c.hex}" rx="3"/>\n`;
    body += `  <text x="${x + 6}" y="${y + 15}" fill="${tc}" font-size="9" font-weight="bold" opacity="0.8">${c.label}</text>\n`;
    body += `  <text x="${x + swatchW / 2}" y="${y + SWATCH_H - 8}" fill="${tc}" font-size="10" text-anchor="middle">${c.hex}</text>\n`;
  }
  y += SWATCH_H + GAP;

  const neutralColors = [
    { label: "bg", hex: neutral.bg_base_hex },
    { label: "fg", hex: neutral.fg_base_hex },
  ];
  for (let i = 0; i < neutralColors.length; i++) {
    const c = neutralColors[i];
    const x = PADDING + i * (neutralW + GAP);
    const tc = textColor(c.hex);
    body += `  <rect x="${x}" y="${y}" width="${neutralW}" height="${NEUTRAL_H}" fill="${c.hex}" rx="3"/>\n`;
    body += `  <text x="${x + 6}" y="${y + 14}" fill="${tc}" font-size="9" font-weight="bold" opacity="0.8">${c.label}</text>\n`;
    body += `  <text x="${x + neutralW / 2}" y="${y + NEUTRAL_H - 8}" fill="${tc}" font-size="10" text-anchor="middle">${c.hex}</text>\n`;
  }
  y += NEUTRAL_H + GAP;

  body += `  <text x="${PADDING}" y="${y + 13}" fill="#666666" font-size="11">theme: <tspan font-weight="bold" fill="#aaaaaa">${theme_tone}</tspan></text>\n`;
  y += 22;

  const totalH = y + PADDING;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${totalH}" style="background:#111111; font-family:ui-monospace,monospace;">`,
    body,
    `</svg>`,
  ].join("\n");
}

// ============================================================
// Main
// ============================================================

const gameFromImagePath = (imagePath: string): string =>
  basename(dirname(imagePath));

async function processImage(ai: GoogleGenAI, imagePath: string) {
  const imageBuffer = readFileSync(imagePath);
  const ext = imagePath.split(".").pop()?.toLowerCase() ?? "png";
  const mimeType =
    ext === "webp"
      ? "image/webp"
      : ext === "jpg" || ext === "jpeg"
        ? "image/jpeg"
        : "image/png";
  const imageBase64 = imageBuffer.toString("base64");
  const imageName = basename(imagePath).replace(/\.[^.]+$/, "");

  console.log(
    `\n========== ${imageName} (${(imageBuffer.length / 1024).toFixed(0)} KB) ==========\n`,
  );

  const start = performance.now();

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { text: PROMPT },
          { inlineData: { mimeType, data: imageBase64 } },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: toJsonSchema(VisionResultSchema),
    },
  });

  const elapsed = Math.round(performance.now() - start);
  const text = response.text ?? "";

  console.log(`  ${elapsed}ms`);
  console.log(text);

  // Parse & validate
  const parsed = v.parse(VisionResultSchema, JSON.parse(text));

  // Save JSON
  const game = gameFromImagePath(imagePath);
  const jsonDir = join(OUTPUT_DIR, game, "json");
  mkdirSync(jsonDir, { recursive: true });

  const jsonPath = join(jsonDir, `${imageName}.json`);
  writeFileSync(jsonPath, JSON.stringify(parsed, null, 2));
  console.log(`Saved: ${jsonPath}`);
}

async function main() {
  if (IMAGE_PATHS.length === 0) {
    console.log(
      "Usage: node scripts/test-vision-ai.ts debug/img/{game}/{char}.png [...]",
    );
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  for (const imagePath of IMAGE_PATHS) {
    try {
      await processImage(ai, imagePath);
    } catch (e) {
      console.error(`Failed: ${imagePath}`, e);
    }
  }
}

main();
