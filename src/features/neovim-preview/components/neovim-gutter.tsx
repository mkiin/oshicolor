// プレビューコンポーネントの行番号・サインカラムUI
import type React from "react";

type NeovimGutterProps = {
    lineCount: number;
    curerntLine?: number;
    bg: string;
    fg: string;
    comment: string;
};

const NeovimGutter: React.FC<NeovimGutterProps> = () => {
    return <div></div>;
};

export { NeovimGutter };
