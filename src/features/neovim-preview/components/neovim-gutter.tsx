// プレビューコンポーネントの行番号・サインカラムUI
import { useAtomValue } from "jotai";
import type React from "react";
import {
    colorTokensAtom,
    lineCountAtom,
    showLineNumberAtom,
} from "@/features/neovim-preview/stores/atoms";

export const NeovimGutter: React.FC = () => {
    const { bg, comment } = useAtomValue(colorTokensAtom);
    const lineCount = useAtomValue(lineCountAtom);
    const showLineNumber = useAtomValue(showLineNumberAtom);

    if (!showLineNumber) return null;

    return (
        <div
            style={{
                backgroundColor: bg,
                color: comment,
                padding: "0.5rem 0.75rem 0.5rem 0.5rem",
                textAlign: "right",
                fontFamily: "monospace",
                fontSize: "13px",
                lineHeight: "1.5",
                userSelect: "none",
                // 行数の桁数に応じて最小幅を確保する
                minWidth: `${String(lineCount).length + 2}ch`,
            }}
        >
            {Array.from({ length: lineCount }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: 行番号には安定したIDがないためインデックスを使用する
                <div key={i + 1}>{i + 1}</div>
            ))}
        </div>
    );
};
