import type react from "react";

type NeovimStatusLineProps = {
    mode: "NORMAL" | "INSERT" | "VISUAL";
    fileName: string;
    language: string;
    lineCount: number;
    bg: string;
    fg: string;
    accent: string;
};

const NeovimStatusLine: react.FC = () => {
    return <div></div>;
};
