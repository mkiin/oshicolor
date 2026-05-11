import type { BufferTab, EditorState } from "./types/vim-preview.types";

export const TSX_CODE = `import { useState, useCallback } from "react";

type CounterProps = {
  title: string;
  initialCount?: number;
};

export const Counter: React.FC<CounterProps> = ({
  title,
  initialCount = 0,
}) => {
  const [count, setCount] = useState(initialCount);

  const handleIncrement = useCallback(() => {
    setCount((prev) => prev + 1);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      <span className="text-4xl tabular-nums">{count}</span>
      <button
        onClick={handleIncrement}
        className="rounded-lg bg-blue-500 px-4 py-2 text-white"
      >
        Increment
      </button>
    </div>
  );
};`;

export const ZIG_CODE = `const std = @import("std");

pub fn main() !void {
    const stdout = std.io.getStdOut().writer();
    var i: usize = 1;
    while (i <= 16) : (i += 1) {
        if (i % 15 == 0) {
            try stdout.writeAll("ZiggZagg\\n");
        } else if (i % 3 == 0) {
            try stdout.writeAll("Zigg\\n");
        } else if (i % 5 == 0) {
            try stdout.writeAll("Zagg\\n");
        } else {
            try stdout.print("{d}\\n", .{i});
        }
    }
}`;

export const TSX_EDITOR_STATE: EditorState = {
  cursorLine: 14,
  cursorCol: 4,
  mode: "NORMAL",
};

export const ZIG_EDITOR_STATE: EditorState = {
  cursorLine: 13,
  cursorCol: 12,
  mode: "VISUAL",
  visualSelection: {
    startLine: 13,
    startCol: 12,
    endLine: 13,
    endCol: 41,
  },
};

export const BUFFER_TABS: BufferTab[] = [
  { name: "counter.tsx", active: false },
  { name: "main.zig", active: true },
];

export const TSX_BUFFER_TABS: BufferTab[] = [
  { name: "counter.tsx", active: true },
  { name: "main.zig", active: false },
];
