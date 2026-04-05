import type { TreeNode } from "@/features/vim-preview/types/vim-preview.types";

export type VimNeoTreeProps = {
  tree: TreeNode[];
  bg: string;
  fg: string;
  directoryFg: string;
  activeBg: string;
  gitModifiedFg: string;
  indentMarkerFg: string;
};

export const VimNeoTree: React.FC<VimNeoTreeProps> = ({
  tree,
  bg,
  fg,
  directoryFg,
  activeBg,
  gitModifiedFg,
  indentMarkerFg,
}) => {
  return (
    <div
      className="w-44 shrink-0 overflow-hidden border-r font-mono text-xs leading-5 select-none"
      style={{ backgroundColor: bg, color: fg, borderColor: indentMarkerFg }}
    >
      {/* Neo-tree ヘッダー */}
      <div className="px-2 py-0.5 font-bold opacity-60">Neo-tree</div>
      {tree.map((node) => (
        <TreeNodeRow
          key={node.name}
          node={node}
          depth={0}
          parentPrefixes={[]}
          isLast={true}
          directoryFg={directoryFg}
          activeBg={activeBg}
          gitModifiedFg={gitModifiedFg}
          indentMarkerFg={indentMarkerFg}
          fg={fg}
        />
      ))}
    </div>
  );
};

type TreeNodeRowProps = {
  node: TreeNode;
  depth: number;
  parentPrefixes: string[];
  isLast: boolean;
  directoryFg: string;
  activeBg: string;
  gitModifiedFg: string;
  indentMarkerFg: string;
  fg: string;
};

const DIR_OPEN = "";
const DIR_CLOSED = "";
const FILE_ICON = " ";

const TreeNodeRow: React.FC<TreeNodeRowProps> = ({
  node,
  depth,
  parentPrefixes,
  isLast,
  directoryFg,
  activeBg,
  gitModifiedFg,
  indentMarkerFg,
  fg,
}) => {
  const isDir = node.kind === "directory";
  const children = isDir && node.expanded ? (node.children ?? []) : [];

  // ツリーラインプレフィックス（ルートノードは除く）
  const connector = depth === 0 ? "" : isLast ? "└ " : "├ ";
  const prefix = parentPrefixes.join("");

  // 子ノード用のプレフィックス
  const childPrefixes = [
    ...parentPrefixes,
    depth === 0 ? "" : isLast ? "  " : "│ ",
  ];

  // アイコン
  const icon = isDir
    ? node.expanded
      ? DIR_OPEN
      : DIR_CLOSED
    : FILE_ICON;

  return (
    <>
      <div
        className="flex whitespace-nowrap"
        style={{
          backgroundColor: node.active ? activeBg : undefined,
        }}
      >
        {/* インデントガイド + コネクタ */}
        <span style={{ color: indentMarkerFg }}>
          {prefix}
          {connector}
        </span>

        {/* アイコン */}
        <span style={{ color: isDir ? directoryFg : fg }}>{icon} </span>

        {/* 名前 */}
        <span style={{ color: isDir ? directoryFg : fg }}>{node.name}</span>

        {/* Git ステータス */}
        {node.gitStatus && (
          <span className="ml-1" style={{ color: gitModifiedFg }}>
            [{node.gitStatus}]
          </span>
        )}
      </div>

      {/* 子ノード */}
      {children.map((child, idx) => (
        <TreeNodeRow
          key={child.name}
          node={child}
          depth={depth + 1}
          parentPrefixes={childPrefixes}
          isLast={idx === children.length - 1}
          directoryFg={directoryFg}
          activeBg={activeBg}
          gitModifiedFg={gitModifiedFg}
          indentMarkerFg={indentMarkerFg}
          fg={fg}
        />
      ))}
    </>
  );
};
