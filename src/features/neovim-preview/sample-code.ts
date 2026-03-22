export const SAMPLE_TYPESCRIPT = `// Theme preview component
import { useState } from "react";

type Theme = {
  name: string;
  colors: Record<string, string>;
  isDark: boolean;
};

const DEFAULT_COUNT = 16;

const createTheme = (name: string): Theme => {
  const colors = extractColors(name);
  return { name, colors, isDark: true };
};

export function ThemeEditor({ theme }: { theme: Theme }) {
  const [count, setCount] = useState(DEFAULT_COUNT);
  const label = \`\${theme.name} (\${count} colors)\`;

  if (!theme.isDark) {
    return <div className="light">{label}</div>;
  }

  return (
    <div className="dark">
      <h1>{label}</h1>
      <button onClick={() => setCount(count + 1)}>Add</button>
    </div>
  );
}`;

export const SAMPLE_PYTHON = `# Color palette generator
from dataclasses import dataclass
from typing import Optional

@dataclass
class Color:
    r: int
    g: int
    b: int
    name: Optional[str] = None

    @property
    def hex(self) -> str:
        return f"#{self.r:02x}{self.g:02x}{self.b:02x}"

    def is_dark(self) -> bool:
        luminance = 0.299 * self.r + 0.587 * self.g + 0.114 * self.b
        return luminance < 128

MAX_COLORS = 16

def generate_palette(seed: Color, count: int = MAX_COLORS) -> list[Color]:
    """Generate a tonal palette from a seed color."""
    palette = []
    for i in range(count):
        tone = i / (count - 1)
        adjusted = Color(
            r=int(seed.r * tone),
            g=int(seed.g * tone),
            b=int(seed.b * tone),
        )
        palette.append(adjusted)
    return palette`;

export const SAMPLE_LUA = `-- Neovim colorscheme setup
local M = {}

local DEFAULT_OPTIONS = {
  transparent = false,
  italic_comments = true,
  dim_inactive = false,
}

---@param colors table<string, string>
---@param opts? table
function M.setup(colors, opts)
  opts = vim.tbl_deep_extend("force", DEFAULT_OPTIONS, opts or {})

  -- Set editor highlights
  local highlights = {
    Normal = { fg = colors.fg, bg = colors.bg },
    Comment = { fg = colors.comment, italic = opts.italic_comments },
    Keyword = { fg = colors.keyword, bold = true },
    String = { fg = colors.string },
    Function = { fg = colors.fn },
    Type = { fg = colors.type },
    Number = { fg = colors.number },
    Constant = { fg = colors.constant },
  }

  for group, attrs in pairs(highlights) do
    vim.api.nvim_set_hl(0, group, attrs)
  end

  if opts.transparent then
    vim.api.nvim_set_hl(0, "Normal", { bg = "NONE" })
  end

  return true
end

return M`;

export const SAMPLE_CODES = {
  typescript: { code: SAMPLE_TYPESCRIPT, fileName: "theme-editor.tsx" },
  python: { code: SAMPLE_PYTHON, fileName: "palette.py" },
  lua: { code: SAMPLE_LUA, fileName: "colorscheme.lua" },
} as const;

export type SampleLang = keyof typeof SAMPLE_CODES;
