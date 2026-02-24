import type { PrismTheme } from "prism-react-renderer";
import type react from "react";

type NeovimCodeBlockProps = {
    code: string;
    language: string;
    prismTheme: PrismTheme; // ← NeovimPreview 内で colors から変換して渡す
    bg: string;
};

const NeovimCodeBlock: react.FC<NeovimCodeBlockProps> = () => {
    return <div></div>;
};

export { NeovimCodeBlock };
