import type { BufferTab } from "@/features/vim-preview/types/vim-preview.types";

export type VimBufferlineProps = {
  tabs: BufferTab[];
  bg: string;
  fg: string;
  activeBg: string;
  activeFg: string;
};

export const VimBufferline: React.FC<VimBufferlineProps> = ({
  tabs,
  bg,
  fg,
  activeBg,
  activeFg,
}) => {
  return (
    <div
      className="flex text-xs leading-6 select-none"
      style={{ backgroundColor: bg, color: fg }}
    >
      {tabs.map((tab) => (
        <div
          key={tab.name}
          className="flex items-center gap-1.5 border-r px-3"
          style={
            tab.active
              ? {
                  backgroundColor: activeBg,
                  color: activeFg,
                  borderColor: activeBg,
                }
              : { borderColor: bg }
          }
        >
          <span className="opacity-60">{tab.active ? "●" : "○"}</span>
          <span>{tab.name}</span>
        </div>
      ))}
      {/* 残りのスペースを埋める */}
      <div className="flex-1" />
    </div>
  );
};
