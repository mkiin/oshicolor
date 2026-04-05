/**
 * V02: AI 5色 (accent 3 + bg + fg) に最も近い ghostty テーマを検索する
 *
 * アルゴリズム:
 * - 距離計算は Oklab ユークリッド距離（OKLCH の色相 wrap-around 問題を回避）
 * - bg/fg の重みを 5 倍（画面最大面積）
 * - AI 3色のスロット割り当ては固定しない（6P3 = 120 通り総当たり）
 *
 * Usage: node scripts/find-nearest-themes.ts
 */

import * as culori from "culori";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const THEME_DIR = "sample-repo/ghostty-theme";

const W_BG = 5;
const W_FG = 5;

/** ネタテーマ・極端な配色のテーマを除外 */
const EXCLUDED_THEMES = new Set([
  "HaX0R Blue",
  "HaX0R Gr33N",
  "HaX0R R3D",
  "Hot Dog Stand",
  "Hot Dog Stand (Mustard)",
  "Retro",
  "Retro Legends",
  "Black Metal",
  "Black Metal (Bathory)",
  "Black Metal (Burzum)",
  "Black Metal (Dark Funeral)",
  "Black Metal (Gorgoroth)",
  "Black Metal (Immortal)",
  "Black Metal (Khold)",
  "Black Metal (Marduk)",
  "Black Metal (Mayhem)",
  "Black Metal (Nile)",
  "Black Metal (Venom)",
  "Red Alert",
  "Red Planet",
  "Red Sands",
  "Sakura",
  "Scarlet Protocol",
  "Cyberpunk Scarlet Protocol",
  "Toy Chest",
  "Unikitty",
]);

// --- Oklab utils ---

type Oklab = { l: number; a: number; b: number };
type Oklch = { l: number; c: number; h: number };

function hexToOklab(hex: string): Oklab | null {
  const result = culori.oklab(hex);
  if (!result) return null;
  return { l: result.l ?? 0, a: result.a ?? 0, b: result.b ?? 0 };
}

function hexToOklch(hex: string): Oklch | null {
  const result = culori.oklch(hex);
  if (!result) return null;
  return { l: result.l ?? 0, c: result.c ?? 0, h: result.h ?? 0 };
}

function oklabDist(a: Oklab, b: Oklab): number {
  const dL = a.l - b.l;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

// --- ghostty theme parser ---

type GhosttyTheme = {
  name: string;
  palette: Record<number, string>;
  background: string;
  foreground: string;
};

function parseTheme(name: string, content: string): GhosttyTheme | null {
  const palette: Record<number, string> = {};
  let background = "";
  let foreground = "";

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    const paletteMatch = trimmed.match(/^palette\s*=\s*(\d+)=(.+)$/);
    if (paletteMatch) {
      palette[Number(paletteMatch[1])] = paletteMatch[2].trim();
      continue;
    }
    const bgMatch = trimmed.match(/^background\s*=\s*(.+)$/);
    if (bgMatch) background = bgMatch[1].trim();
    const fgMatch = trimmed.match(/^foreground\s*=\s*(.+)$/);
    if (fgMatch) foreground = fgMatch[1].trim();
  }

  if (!background || !foreground || Object.keys(palette).length < 8)
    return null;
  return { name, palette, background, foreground };
}

function loadThemes(): GhosttyTheme[] {
  const files = readdirSync(THEME_DIR);
  const themes: GhosttyTheme[] = [];
  for (const file of files) {
    if (EXCLUDED_THEMES.has(file)) continue;
    const content = readFileSync(join(THEME_DIR, file), "utf-8");
    const theme = parseTheme(file, content);
    if (theme) themes.push(theme);
  }
  return themes;
}

// --- ANSI slot names ---

const SLOT_NAMES: Record<number, string> = {
  1: "red",
  2: "green",
  3: "yellow",
  4: "blue",
  5: "magenta",
  6: "cyan",
};

// --- nearest theme search (V02 algorithm) ---

type CharacterInput = {
  name: string;
  game: string;
  primary: string;
  secondary: string;
  tertiary: string;
  bg: string;
  fg: string;
  theme_tone: "dark" | "light";
};

type NearestResult = {
  theme: GhosttyTheme;
  score: number;
  bgDist: number;
  fgDist: number;
  accentDist: number;
  /** AI 3色がどの palette スロット (1-6) に割り当てられたか */
  assignment: [number, number, number];
  /** テーマから借りるスロット (assignment に含まれないもの) */
  borrowedSlots: number[];
};

function findNearest(
  char: CharacterInput,
  themes: GhosttyTheme[],
  topN: number,
): NearestResult[] {
  const aiAccents = [char.primary, char.secondary, char.tertiary].map(
    hexToOklab,
  );
  const aiBg = hexToOklab(char.bg);
  const aiFg = hexToOklab(char.fg);
  if (aiAccents.some((a) => !a) || !aiBg || !aiFg) return [];

  // theme_tone でフィルタ
  const filtered = themes.filter((t) => {
    const bgOklab = hexToOklab(t.background);
    if (!bgOklab) return false;
    return char.theme_tone === "dark" ? bgOklab.l < 0.5 : bgOklab.l >= 0.5;
  });

  const results: NearestResult[] = [];
  const slots = [1, 2, 3, 4, 5, 6];

  for (const theme of filtered) {
    const themeBg = hexToOklab(theme.background)!;
    const themeFg = hexToOklab(theme.foreground)!;
    const themePalette = slots.map((i) => ({
      slot: i,
      oklab: hexToOklab(theme.palette[i])!,
    }));
    if (themePalette.some((p) => !p.oklab)) continue;

    const bgDist = oklabDist(aiBg!, themeBg);
    const fgDist = oklabDist(aiFg!, themeFg);

    // 120 通りの総当たり
    let minAccentDist = Infinity;
    let bestAssignment: [number, number, number] = [1, 2, 3];

    for (let ii = 0; ii < 6; ii++) {
      for (let jj = 0; jj < 6; jj++) {
        if (jj === ii) continue;
        for (let kk = 0; kk < 6; kk++) {
          if (kk === ii || kk === jj) continue;
          const d =
            oklabDist(aiAccents[0]!, themePalette[ii].oklab) +
            oklabDist(aiAccents[1]!, themePalette[jj].oklab) +
            oklabDist(aiAccents[2]!, themePalette[kk].oklab);
          if (d < minAccentDist) {
            minAccentDist = d;
            bestAssignment = [
              themePalette[ii].slot,
              themePalette[jj].slot,
              themePalette[kk].slot,
            ];
          }
        }
      }
    }

    const score = bgDist * W_BG + fgDist * W_FG + minAccentDist;
    const borrowedSlots = slots.filter((s) => !bestAssignment.includes(s));

    results.push({
      theme,
      score,
      bgDist,
      fgDist,
      accentDist: minAccentDist,
      assignment: bestAssignment,
      borrowedSlots,
    });
  }

  results.sort((a, b) => a.score - b.score);
  return results.slice(0, topN);
}

// --- AI 出力データ ---

const CHARACTERS: CharacterInput[] = [
  {
    name: "Albedo",
    game: "genshin",
    primary: "#d6ad60",
    secondary: "#4553a0",
    tertiary: "#ece8e1",
    bg: "#252320",
    fg: "#e5e2de",
    theme_tone: "dark",
  },
  {
    name: "Amber",
    game: "genshin",
    primary: "#C23126",
    secondary: "#4B332C",
    tertiary: "#DDA35D",
    bg: "#231E1D",
    fg: "#E8E0DE",
    theme_tone: "dark",
  },
  {
    name: "Acheron",
    game: "starrail",
    primary: "#5d54a4",
    secondary: "#a11b21",
    tertiary: "#2d2d31",
    bg: "#1a1920",
    fg: "#e0dfe6",
    theme_tone: "dark",
  },
  {
    name: "Hyacine",
    game: "starrail",
    primary: "#971d2b",
    secondary: "#f9b7bc",
    tertiary: "#7ce2e4",
    bg: "#fcf4f5",
    fg: "#382d2e",
    theme_tone: "light",
  },
];

// --- main ---

const themes = loadThemes();
console.log(`Loaded ${themes.length} ghostty themes\n`);

const TOP_N = 5;

for (const char of CHARACTERS) {
  console.log("=".repeat(80));
  console.log(`${char.name} (${char.game}) — ${char.theme_tone}`);
  console.log(
    `  AI accent: ${char.primary}  ${char.secondary}  ${char.tertiary}`,
  );
  console.log(`  AI bg=${char.bg}  fg=${char.fg}`);
  console.log();

  const results = findNearest(char, themes, TOP_N);

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const t = r.theme;

    console.log(
      `  #${i + 1} ${t.name.padEnd(30)} score=${r.score.toFixed(3)}  (bg=${r.bgDist.toFixed(3)}×${W_BG} fg=${r.fgDist.toFixed(3)}×${W_FG} accent=${r.accentDist.toFixed(3)})`,
    );

    // AI 色がどのスロットに入ったか
    const aiLabels = ["primary", "secondary", "tertiary"];
    for (let a = 0; a < 3; a++) {
      const slot = r.assignment[a];
      const aiHex = [char.primary, char.secondary, char.tertiary][a];
      const themeHex = t.palette[slot];
      console.log(
        `     ${aiLabels[a].padEnd(10)} → p${slot}(${SLOT_NAMES[slot].padEnd(7)})  AI=${aiHex}  theme=${themeHex}`,
      );
    }

    // borrowed 色
    const borrowed = r.borrowedSlots
      .map((s) => `p${s}(${SLOT_NAMES[s]})=${t.palette[s]}`)
      .join("  ");
    console.log(`     borrowed: ${borrowed}`);
    console.log(`     theme bg=${t.background}  fg=${t.foreground}`);
    console.log();
  }
}
