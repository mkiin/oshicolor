import { describe, expect, it } from "vitest";

import {
  contrastRatioOfHex,
  contrastRatioOfTones,
  darkerTone,
  lighterTone,
  lighterToneUnsafe,
  darkerToneUnsafe,
  toneFromHex,
  toneFromY,
  yFromTone,
} from "../../../src/shared/lib/contrast";

describe("yFromTone / toneFromY", () => {
  it("境界値が正しい", () => {
    expect(yFromTone(0)).toBeCloseTo(0, 5);
    expect(yFromTone(100)).toBeCloseTo(100, 5);
    expect(toneFromY(0)).toBeCloseTo(0, 5);
    expect(toneFromY(100)).toBeCloseTo(100, 5);
  });

  it("MCU のテスト値と一致する", () => {
    expect(yFromTone(50)).toBeCloseTo(18.4186518, 5);
    expect(yFromTone(90)).toBeCloseTo(76.3033539, 5);
    expect(toneFromY(18.4186518)).toBeCloseTo(50, 4);
  });

  it("往復変換で一致する", () => {
    for (let tone = 0; tone <= 100; tone += 10) {
      const y = yFromTone(tone);
      expect(toneFromY(y)).toBeCloseTo(tone, 8);
    }
  });
});

describe("contrastRatioOfTones", () => {
  it("白と黒のコントラスト比は 21:1", () => {
    expect(contrastRatioOfTones(100, 0)).toBeCloseTo(21, 1);
  });

  it("同一色のコントラスト比は 1:1", () => {
    expect(contrastRatioOfTones(50, 50)).toBeCloseTo(1, 5);
  });

  it("順序に依存しない", () => {
    expect(contrastRatioOfTones(80, 20)).toBeCloseTo(
      contrastRatioOfTones(20, 80),
      5,
    );
  });
});

describe("lighterTone / darkerTone", () => {
  it("暗い Tone に対して 4.5:1 を満たす明るい Tone を返す", () => {
    const bgTone = 10;
    const result = lighterTone(bgTone, 4.5);
    expect(result).toBeGreaterThan(bgTone);
    expect(contrastRatioOfTones(result, bgTone)).toBeGreaterThanOrEqual(4.49);
  });

  it("明るい Tone に対して 4.5:1 を満たす暗い Tone を返す", () => {
    const bgTone = 90;
    const result = darkerTone(bgTone, 4.5);
    expect(result).toBeLessThan(bgTone);
    expect(contrastRatioOfTones(bgTone, result)).toBeGreaterThanOrEqual(4.49);
  });

  it("達成不可の場合は -1 を返す", () => {
    expect(lighterTone(100, 4.5)).toBe(-1);
    expect(darkerTone(0, 4.5)).toBe(-1);
  });

  it("Unsafe 版は達成不可でもフォールバックする", () => {
    expect(lighterToneUnsafe(100, 4.5)).toBe(100);
    expect(darkerToneUnsafe(0, 4.5)).toBe(0);
  });
});

describe("contrastRatioOfHex", () => {
  it("白と黒のコントラスト比は 21:1", () => {
    expect(contrastRatioOfHex("#ffffff", "#000000")).toBeCloseTo(21, 1);
  });

  it("WCAG AA を判定できる", () => {
    // Acheron テスト結果: primary=#6b4fbb on bg=#16161e → FAIL
    expect(contrastRatioOfHex("#6b4fbb", "#16161e")).toBeLessThan(4.5);
    // Contrast-aware: primary=#c397ff on bg=#1a1625 → PASS
    expect(contrastRatioOfHex("#c397ff", "#1a1625")).toBeGreaterThanOrEqual(
      4.5,
    );
  });
});

describe("toneFromHex", () => {
  it("黒は Tone 0 付近", () => {
    expect(toneFromHex("#000000")).toBeCloseTo(0, 1);
  });

  it("白は Tone 100 付近", () => {
    expect(toneFromHex("#ffffff")).toBeCloseTo(100, 1);
  });

  it("中間グレーは Tone 50 付近", () => {
    const tone = toneFromHex("#777777");
    expect(tone).toBeGreaterThan(40);
    expect(tone).toBeLessThan(60);
  });
});
