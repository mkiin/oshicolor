import type { TreeNode } from "./types/vim-preview.types";

export const SAMPLE_TREE: TreeNode[] = [
  {
    name: "oshicolor",
    kind: "directory",
    expanded: true,
    children: [
      {
        name: "src",
        kind: "directory",
        expanded: true,
        children: [
          {
            name: "components",
            kind: "directory",
            expanded: true,
            children: [
              { name: "counter.tsx", kind: "file", active: true },
              { name: "header.tsx", kind: "file" },
            ],
          },
          {
            name: "hooks",
            kind: "directory",
            expanded: true,
            children: [{ name: "use-theme.ts", kind: "file", gitStatus: "M" }],
          },
          { name: "app.tsx", kind: "file" },
          { name: "main.zig", kind: "file" },
        ],
      },
      { name: "package.json", kind: "file" },
      { name: "tsconfig.json", kind: "file" },
    ],
  },
];
