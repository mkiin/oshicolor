import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const IMAGE_PATHS = process.argv.slice(2);
const OUTPUT_DIR = "debug/palette-v01";

const PROMPT = `This is a character illustration. Analyze the character's colors for a Neovim color scheme.

Respond with ONLY valid JSON (no markdown fences, no extra text):

{
  "impression": {
    "primary": { "hex": "#xxxxxx", "reason": "why this is the most iconic/symbolic color" },
    "secondary": { "hex": "#xxxxxx", "reason": "why this is the second most iconic" },
    "tertiary": { "hex": "#xxxxxx", "reason": "third color, or null if only 2 dominant colors" }
  },
  "theme_tone": "dark or light",
  "neutral": {
    "bg_base_hex": "#xxxxxx",
    "fg_base_hex": "#xxxxxx"
  }
}

Rules:
- impression: the CHARACTER's iconic colors (not background). primary = single most symbolic color
- theme_tone: "dark" if the character's overall palette feels dark/cool/deep, "light" if bright/warm/pastel
- neutral.bg_base_hex: a very dark color (for dark theme) or very light color (for light theme), subtly tinted with the character's dominant hue. Approximate OKLCH: L=0.14, C=0.015 for dark; L=0.95, C=0.015 for light
- neutral.fg_base_hex: the opposite — light text for dark theme, dark text for light theme. Approximate OKLCH: L=0.87, C=0.012 for dark; L=0.20, C=0.012 for light
- Be precise with HEX values — estimate them as accurately as possible from what you see`;

const GEMINI_MODELS = ["gemini-flash-latest"];

type Result = {
  model: string;
  response?: string;
  error?: string;
  elapsed: number;
  tokens?: { input: number; output: number; total: number };
};

async function runGemini(model: string, imageBase64: string): Promise<Result> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    contents: [
      {
        parts: [
          { text: PROMPT },
          {
            inline_data: {
              mime_type: "image/png",
              data: imageBase64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      maxOutputTokens: 4096,
    },
  };

  const start = performance.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const elapsed = Math.round(performance.now() - start);

  if (!res.ok) {
    const text = await res.text();
    return { model, error: `${res.status} ${text}`, elapsed };
  }

  const json = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    };
  };

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  const usage = json.usageMetadata;
  const tokens = usage
    ? {
        input: usage.promptTokenCount ?? 0,
        output: usage.candidatesTokenCount ?? 0,
        total: usage.totalTokenCount ?? 0,
      }
    : undefined;

  return { model, response: text, elapsed, tokens };
}

type VisionResult = {
  impression: {
    primary: { hex: string; reason: string };
    secondary: { hex: string; reason: string };
    tertiary: { hex: string; reason: string | null };
  };
  theme_tone: "dark" | "light";
  neutral: {
    bg_base_hex: string;
    fg_base_hex: string;
  };
};

/** hex の明るさから text 色を決定する */
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
    { label: "tertiary", hex: impression.tertiary?.hex ?? "#000000", reason: impression.tertiary?.reason ?? "—" },
  ];

  const innerW = SVG_WIDTH - PADDING * 2;
  const swatchW = (innerW - GAP * 2) / 3;
  const neutralW = (innerW - GAP) / 2;

  let y = PADDING;
  let body = "";

  // キャラ名
  body += `  <text x="${PADDING}" y="${y + 14}" fill="#aaaaaa" font-size="14" font-weight="bold">${name}</text>\n`;
  y += 26;

  // impression 3色
  for (let i = 0; i < colors.length; i++) {
    const c = colors[i];
    const x = PADDING + i * (swatchW + GAP);
    const tc = textColor(c.hex);
    body += `  <rect x="${x}" y="${y}" width="${swatchW}" height="${SWATCH_H}" fill="${c.hex}" rx="3"/>\n`;
    body += `  <text x="${x + 6}" y="${y + 15}" fill="${tc}" font-size="9" font-weight="bold" opacity="0.8">${c.label}</text>\n`;
    body += `  <text x="${x + swatchW / 2}" y="${y + SWATCH_H - 8}" fill="${tc}" font-size="10" text-anchor="middle">${c.hex}</text>\n`;
  }
  y += SWATCH_H + GAP;

  // neutral bg / fg
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

  // theme_tone ラベル
  body += `  <text x="${PADDING}" y="${y + 13}" fill="#666666" font-size="11">theme: <tspan font-weight="bold" fill="#aaaaaa">${theme_tone}</tspan></text>\n`;
  y += 22;

  const totalH = y + PADDING;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${totalH}" style="background:#111111; font-family:ui-monospace,monospace;">`,
    body,
    `</svg>`,
  ].join("\n");
}

/** image パスからゲーム名を取得 (debug/img/{game}/{char}.png → game) */
const gameFromImagePath = (imagePath: string): string => basename(dirname(imagePath));

async function processImage(imagePath: string) {
  const imageBuffer = readFileSync(imagePath);
  const imageBase64 = imageBuffer.toString("base64");
  const imageName = basename(imagePath, ".png");

  console.log(
    `\n========== ${imageName} (${(imageBuffer.length / 1024).toFixed(0)} KB) ==========\n`,
  );

  const results: Result[] = [];

  for (const model of GEMINI_MODELS) {
    console.log(`--- ${model} ---`);
    const result = await runGemini(model, imageBase64);
    results.push(result);
    if (result.tokens) {
      console.log(
        `  tokens: in=${result.tokens.input} out=${result.tokens.output} total=${result.tokens.total}`,
      );
    }
    console.log(result.error ?? result.response);
    console.log(`(${result.elapsed}ms)\n`);
  }

  const game = gameFromImagePath(imagePath);
  const gameDir = join(OUTPUT_DIR, game);
  mkdirSync(gameDir, { recursive: true });

  const output = {
    image: imagePath,
    timestamp: new Date().toISOString(),
    results: results.map((r) => ({
      model: r.model,
      elapsed: r.elapsed,
      tokens: r.tokens ?? null,
      error: r.error ?? null,
      response: r.response ?? null,
    })),
  };
  const outPath = join(gameDir, `${imageName}.json`);
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Saved: ${outPath}`);

  // SVG 生成（最初の成功レスポンスから）
  const successResult = results.find((r) => r.response);
  if (successResult?.response) {
    try {
      const cleaned = successResult.response
        .replace(/^```json\s*/, "")
        .replace(/```\s*$/, "")
        .trim();
      const parsed = JSON.parse(cleaned) as VisionResult;
      if (parsed.neutral?.bg_base_hex && parsed.theme_tone) {
        const svgPath = join(gameDir, `${imageName}.vision.svg`);
        writeFileSync(svgPath, generateSvg(imageName, parsed));
        console.log(`Saved: ${svgPath}`);
      }
    } catch (e) {
      console.error(`SVG generation failed: ${e}`);
    }
  }
}

async function main() {
  if (IMAGE_PATHS.length === 0) {
    console.log("Usage: node test-vision-ai.ts <image1> [image2] ...");
    process.exit(1);
  }

  for (const imagePath of IMAGE_PATHS) {
    await processImage(imagePath);
  }
}

main();
