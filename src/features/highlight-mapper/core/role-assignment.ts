import type { Candidate } from "./candidate-pool";
import type { OklchValues } from "./oklch-utils";

/** syntax ロール名（割り当て優先順） */
export const SYNTAX_ROLES = [
  "accent",
  "keyword",
  "function",
  "string",
  "operator",
  "type",
  "number",
] as const;

export type SyntaxRole = (typeof SYNTAX_ROLES)[number];

/** ロール → hex のマッピング */
export type RoleMap = Record<SyntaxRole, string>;

/**
 * hue の角度差（0〜180）
 */
const hueDiff = (h1: number, h2: number): number => {
  const raw = Math.abs(h1 - h2);
  return raw > 180 ? 360 - raw : raw;
};

/**
 * 既に選択された色群との hue の最小距離
 */
const minHueDiffFromSelected = (
  oklch: OklchValues,
  selected: OklchValues[],
): number => {
  if (selected.length === 0) return 180;
  return Math.min(...selected.map((s) => hueDiff(oklch.h, s.h)));
};

/**
 * 候補プールからスコアリングでロールに色を割り当てる
 *
 * accent: neutral hue との差 × C で最高スコア
 * keyword: accent との hue 差 × C で最高スコア
 * 以降: 既選択との hue 分散を最大化
 *
 * 候補プール < ロール数の場合: 末尾のロールは直前のロールの色をフォールバック
 */
export const assignRoles = (
  candidates: Candidate[],
  neutralHue: number,
): RoleMap => {
  const remaining = [...candidates];
  const selected: { oklch: OklchValues; hex: string }[] = [];
  const roleMap = {} as Record<SyntaxRole, string>;

  const pickBest = (
    scoreFn: (c: Candidate) => number,
  ): Candidate | undefined => {
    if (remaining.length === 0) return undefined;
    let bestIdx = 0;
    let bestScore = scoreFn(remaining[0]);
    for (let i = 1; i < remaining.length; i++) {
      const score = scoreFn(remaining[i]);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    return remaining.splice(bestIdx, 1)[0];
  };

  for (const role of SYNTAX_ROLES) {
    let picked: Candidate | undefined;

    if (role === "accent") {
      picked = pickBest(
        (c) => (hueDiff(c.oklch.h, neutralHue) / 180) * c.oklch.c,
      );
    } else if (role === "keyword") {
      const accentOklch = selected[0]?.oklch;
      picked = pickBest((c) => {
        const hDiff = accentOklch ? hueDiff(c.oklch.h, accentOklch.h) / 180 : 1;
        return hDiff * c.oklch.c;
      });
    } else {
      picked = pickBest(
        (c) =>
          minHueDiffFromSelected(
            c.oklch,
            selected.map((s) => s.oklch),
          ) / 180,
      );
    }

    if (picked) {
      roleMap[role] = picked.hex;
      selected.push({ oklch: picked.oklch, hex: picked.hex });
    } else {
      const lastHex = selected[selected.length - 1]?.hex ?? "#888888";
      roleMap[role] = lastHex;
    }
  }

  return roleMap;
};
