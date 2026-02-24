// NeovimのカラートークンオブジェクトをPrism React Rendererのトークンにマッピングする

// plain, stylesの2種類ある
// 更にstyles内にはtypes, style, laguagesの3プロパティが存在する。
// NeoVimカラートークン外の情報も必要になる。
import type { PrismTheme } from "prism-react-renderer";
import type { NeovimColorTokens } from "@/features/neovim-preview/types/index";

const buildPrismTheme = (colorTokens: NeovimColorTokens): PrismTheme => {
    return {
        plain: {
            color: colorTokens.fg,
            backgroundColor: colorTokens.bg,
        },
        styles: [
            // keyword
            {
                types: ["keyword", "control-flow", "module"],
                style: {
                    color: colorTokens.kw,
                },
            },
            // function
            {
                types: ["function", "function-variable"],
                style: {
                    color: colorTokens.fn,
                },
            },
            // field
            {
                types: ["property", "attr-name"],
                style: {
                    color: colorTokens.field,
                },
            },
            // string
            {
                types: ["string", "char", "template-string"],
                style: {
                    color: colorTokens.string,
                },
            },
            // type
            {
                types: ["class-name", "builtin", "namespace"],
                style: {
                    color: colorTokens.type,
                },
            },
            // op
            {
                types: ["operator", "punctuation"],
                style: {
                    color: colorTokens.kw,
                },
            },
            // const
            {
                types: ["constant", "number", "boolean"],
                style: {
                    color: colorTokens.const,
                },
            },
            // special
            {
                types: ["decorator", "annotation", "tag"],
                style: {
                    color: colorTokens.special,
                },
            },
            // comment
            {
                types: ["comment", "block-comment"],
                style: {
                    color: colorTokens.comment,
                },
            },
        ],
    };
};

export { buildPrismTheme };
