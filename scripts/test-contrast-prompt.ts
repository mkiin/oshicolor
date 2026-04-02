import { readFileSync } from "node:fs";
import { basename } from "node:path";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const IMAGE_PATH = process.argv[2] || "debug/img/starrail/Acheron.png";

const PROMPT_CURRENT = `This is a character illustration. Analyze the character's colors for a Neovim color scheme.

Respond with ONLY valid JSON (no markdown fences, no extra text):

{
  "impression": {
    "primary": { "hex": "#xxxxxx", "reason": "why this is the most iconic/symbolic color" },
    "secondary": { "hex": "#xxxxxx", "reason": "why this is the second most iconic" },
    "tertiary": { "hex": "#xxxxxx", "reason": "third color" }
  },
  "theme_tone": "dark or light",
  "neutral": {
    "bg_base_hex": "#xxxxxx",
    "fg_base_hex": "#xxxxxx"
  }
}

Rules:
- impression: the CHARACTER's iconic colors (not background). primary = single most symbolic color
- tertiary is always required — find a third color even if subtle
- theme_tone: "dark" if the character's overall palette feels dark/cool/deep, "light" if bright/warm/pastel
- neutral.bg_base_hex: a very dark color (for dark theme) or very light color (for light theme), subtly tinted with the character's dominant hue. Approximate OKLCH: L=0.14, C=0.015 for dark; L=0.95, C=0.015 for light
- neutral.fg_base_hex: the opposite — light text for dark theme, dark text for light theme. Approximate OKLCH: L=0.87, C=0.012 for dark; L=0.20, C=0.012 for light
- Be precise with HEX values — estimate them as accurately as possible from what you see`;

const PROMPT_CONTRAST = `This is a character illustration. Analyze the character's colors for a Neovim color scheme.

Respond with ONLY valid JSON (no markdown fences, no extra text):

{
  "impression": {
    "primary": { "hex": "#xxxxxx", "reason": "why this is the most iconic/symbolic color" },
    "secondary": { "hex": "#xxxxxx", "reason": "why this is the second most iconic" },
    "tertiary": { "hex": "#xxxxxx", "reason": "third color" }
  },
  "theme_tone": "dark or light",
  "neutral": {
    "bg_base_hex": "#xxxxxx",
    "fg_base_hex": "#xxxxxx"
  }
}

Rules:
- impression: the CHARACTER's iconic colors (not background). primary = single most symbolic color
- tertiary is always required — find a third color even if subtle
- theme_tone: "dark" if the character's overall palette feels dark/cool/deep, "light" if bright/warm/pastel
- neutral.bg_base_hex: a very dark color (for dark theme) or very light color (for light theme), subtly tinted with the character's dominant hue. Approximate OKLCH: L=0.14, C=0.015 for dark; L=0.95, C=0.015 for light
- neutral.fg_base_hex: the opposite — light text for dark theme, dark text for light theme. Approximate OKLCH: L=0.87, C=0.012 for dark; L=0.20, C=0.012 for light
- IMPORTANT: All impression colors MUST have a WCAG AA contrast ratio of at least 4.5:1 against the bg_base_hex. If the character's iconic color is too dark or too similar to the background, adjust its lightness while preserving the hue and saturation. The colors will be used as syntax highlight colors on the editor background, so readability is critical.
- Be precise with HEX values — estimate them as accurately as possible from what you see`;

// Simple relative luminance + contrast ratio calculation
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

async function runGemini(prompt: string, imageBase64: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inline_data: { mime_type: "image/png", data: imageBase64 } },
        ],
      },
    ],
    generationConfig: { maxOutputTokens: 4096 },
  };

  const start = performance.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const elapsed = Math.round(performance.now() - start);

  if (!res.ok) {
    return { error: `${res.status} ${await res.text()}`, elapsed };
  }

  const json = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  return { text, elapsed };
}

function analyzeResult(label: string, text: string) {
  console.log(`\n--- ${label} ---`);
  console.log(text);

  try {
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const data = JSON.parse(cleaned);
    const bg = data.neutral?.bg_base_hex;
    if (!bg) {
      console.log("  (bg not found, skip contrast check)");
      return;
    }

    console.log(`\n  Contrast ratios against bg (${bg}):`);
    for (const [key, val] of Object.entries(data.impression)) {
      const hex = (val as { hex: string }).hex;
      const ratio = contrastRatio(hex, bg);
      const pass = ratio >= 4.5 ? "PASS" : "FAIL";
      console.log(`    ${key}: ${hex} → ${ratio.toFixed(2)}:1 [${pass}]`);
    }
    const fgRatio = contrastRatio(data.neutral.fg_base_hex, bg);
    console.log(
      `    fg:   ${data.neutral.fg_base_hex} → ${fgRatio.toFixed(2)}:1 [${fgRatio >= 4.5 ? "PASS" : "FAIL"}]`,
    );
  } catch {
    console.log("  (JSON parse failed)");
  }
}

async function main() {
  const imageBuffer = readFileSync(IMAGE_PATH);
  const imageBase64 = imageBuffer.toString("base64");
  const imageName = basename(IMAGE_PATH, ".png");

  console.log(
    `Image: ${imageName} (${(imageBuffer.length / 1024).toFixed(0)} KB)`,
  );

  const [current, contrast] = await Promise.all([
    runGemini(PROMPT_CURRENT, imageBase64),
    runGemini(PROMPT_CONTRAST, imageBase64),
  ]);

  if (current.error) {
    console.log(`Current ERROR: ${current.error}`);
  } else {
    analyzeResult(`Current prompt (${current.elapsed}ms)`, current.text!);
  }

  if (contrast.error) {
    console.log(`Contrast ERROR: ${contrast.error}`);
  } else {
    analyzeResult(
      `Contrast-aware prompt (${contrast.elapsed}ms)`,
      contrast.text!,
    );
  }
}

main();
