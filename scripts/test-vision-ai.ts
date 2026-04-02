import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const IMAGE_PATHS = process.argv.slice(2);
const OUTPUT_DIR = "debug/vision-ai";

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

  mkdirSync(OUTPUT_DIR, { recursive: true });
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
  const outPath = join(OUTPUT_DIR, `${imageName}.json`);
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Saved: ${outPath}`);
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
