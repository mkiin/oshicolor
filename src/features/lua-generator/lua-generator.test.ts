import { describe, expect, it } from "vitest";
import type { HighlightBundle } from "@/features/highlight-mapper/highlight-mapper.types";
import { generateLuaColorscheme } from "./lua-generator";

const MOCK_BUNDLE: HighlightBundle = {
  seeds: ["#ff6688", "#4488cc"],
  neutral: {
    popup: "#16162a",
    bg: "#1a1a2e",
    surface: "#1e1e34",
    cursorline: "#22223a",
    visual: "#2a2a44",
    dim: "#4a4a5e",
    border: "#3a3a4e",
    comment: "#5a5a6e",
    fg: "#c8c8d8",
  },
  diagnostic: {
    error: "#e55561",
    warn: "#e2b86b",
    info: "#4fa6ed",
    hint: "#48b0bd",
  },
  highlights: {
    Normal: { fg: "#c8c8d8", bg: "#1a1a2e" },
    Comment: { fg: "#5a5a6e", italic: true },
    Keyword: { fg: "#c678dd" },
    Function: { fg: "#61afef", bold: true },
    DiagnosticUnderlineError: { undercurl: true },
  },
};

describe("generateLuaColorscheme", () => {
  it("ヘッダーに colors_name とリセット処理を含む", () => {
    const lua = generateLuaColorscheme(MOCK_BUNDLE, "my-theme");

    expect(lua).toContain('vim.g.colors_name = "my-theme"');
    expect(lua).toContain('vim.cmd("hi clear")');
    expect(lua).toContain('vim.o.background = "dark"');
    expect(lua).toContain("vim.o.termguicolors = true");
  });

  it("デフォルトテーマ名は oshicolor", () => {
    const lua = generateLuaColorscheme(MOCK_BUNDLE);

    expect(lua).toContain('vim.g.colors_name = "oshicolor"');
  });

  it("fg と bg を持つグループを正しく出力する", () => {
    const lua = generateLuaColorscheme(MOCK_BUNDLE);

    expect(lua).toContain(
      'hi(0, "Normal", { fg = "#c8c8d8", bg = "#1a1a2e" })',
    );
  });

  it("italic を持つグループを正しく出力する", () => {
    const lua = generateLuaColorscheme(MOCK_BUNDLE);

    expect(lua).toContain(
      'hi(0, "Comment", { fg = "#5a5a6e", italic = true })',
    );
  });

  it("bold を持つグループを正しく出力する", () => {
    const lua = generateLuaColorscheme(MOCK_BUNDLE);

    expect(lua).toContain('hi(0, "Function", { fg = "#61afef", bold = true })');
  });

  it("undercurl のみのグループを正しく出力する", () => {
    const lua = generateLuaColorscheme(MOCK_BUNDLE);

    expect(lua).toContain(
      'hi(0, "DiagnosticUnderlineError", { undercurl = true })',
    );
  });

  it("全ハイライトグループが出力に含まれる", () => {
    const lua = generateLuaColorscheme(MOCK_BUNDLE);

    for (const group of Object.keys(MOCK_BUNDLE.highlights)) {
      expect(lua).toContain(`"${group}"`);
    }
  });
});
