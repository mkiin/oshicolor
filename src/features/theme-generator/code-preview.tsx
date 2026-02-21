import { useState } from "react";
import type { HighlightMap } from "./types";

type CodePreviewProps = {
    highlightMap: HighlightMap;
};

type TokenKind =
    | "keyword"
    | "type"
    | "string"
    | "function"
    | "number"
    | "comment"
    | "special"
    | "operator"
    | "normal";

type Token = { kind: TokenKind; text: string };
type Line = Token[];

// TypeScript サンプルコードのトークン列（行ごと）
const CODE_LINES: Line[] = [
    [{ kind: "comment", text: "// Character palette extractor" }],
    [],
    [
        { kind: "keyword", text: "import" },
        { kind: "normal", text: " { " },
        { kind: "function", text: "oklch" },
        { kind: "normal", text: ", " },
        { kind: "function", text: "formatHex" },
        { kind: "normal", text: " } " },
        { kind: "keyword", text: "from" },
        { kind: "normal", text: " " },
        { kind: "string", text: '"culori"' },
        { kind: "normal", text: ";" },
    ],
    [],
    [
        { kind: "keyword", text: "type" },
        { kind: "normal", text: " " },
        { kind: "type", text: "ColorPoint" },
        { kind: "normal", text: " = {" },
    ],
    [
        { kind: "normal", text: "  id" },
        { kind: "operator", text: ":" },
        { kind: "normal", text: " " },
        { kind: "type", text: "number" },
        { kind: "normal", text: ";" },
    ],
    [
        { kind: "normal", text: "  color" },
        { kind: "operator", text: ":" },
        { kind: "normal", text: " " },
        { kind: "type", text: "string" },
        { kind: "normal", text: ";" },
    ],
    [
        { kind: "normal", text: "  percent" },
        { kind: "operator", text: "?:" },
        { kind: "normal", text: " " },
        { kind: "type", text: "number" },
        { kind: "normal", text: ";" },
    ],
    [{ kind: "normal", text: "};" }],
    [],
    [
        { kind: "keyword", text: "const" },
        { kind: "normal", text: " " },
        { kind: "special", text: "PALETTE_SIZE" },
        { kind: "normal", text: " = " },
        { kind: "number", text: "12" },
        { kind: "normal", text: ";" },
    ],
    [],
    [
        { kind: "keyword", text: "const" },
        { kind: "normal", text: " " },
        { kind: "function", text: "extractPalette" },
        { kind: "normal", text: " = (" },
    ],
    [
        { kind: "normal", text: "  imageData" },
        { kind: "operator", text: ":" },
        { kind: "normal", text: " " },
        { kind: "type", text: "ImageData" },
        { kind: "normal", text: "," },
    ],
    [
        { kind: "normal", text: "  count" },
        { kind: "operator", text: ":" },
        { kind: "normal", text: " " },
        { kind: "type", text: "number" },
        { kind: "normal", text: " = " },
        { kind: "special", text: "PALETTE_SIZE" },
        { kind: "normal", text: "," },
    ],
    [
        { kind: "normal", text: "): " },
        { kind: "type", text: "ColorPoint" },
        { kind: "normal", text: "[] => {" },
    ],
    [
        { kind: "normal", text: "  " },
        { kind: "keyword", text: "const" },
        { kind: "normal", text: " colors = " },
        { kind: "function", text: "processImage" },
        { kind: "normal", text: "(imageData);" },
    ],
    [
        { kind: "normal", text: "  " },
        { kind: "keyword", text: "return" },
        { kind: "normal", text: " colors." },
        { kind: "function", text: "slice" },
        { kind: "normal", text: "(" },
        { kind: "number", text: "0" },
        { kind: "normal", text: ", count)." },
        { kind: "function", text: "map" },
        { kind: "normal", text: "((c, i) => ({" },
    ],
    [
        { kind: "normal", text: "    id: i + " },
        { kind: "number", text: "1" },
        { kind: "normal", text: "," },
    ],
    [
        { kind: "normal", text: "    color: " },
        { kind: "function", text: "formatHex" },
        { kind: "normal", text: "(c) ?? " },
        { kind: "string", text: '"#000000"' },
        { kind: "normal", text: "," },
    ],
    [
        { kind: "normal", text: "    percent: " },
        { kind: "type", text: "Math" },
        { kind: "normal", text: "." },
        { kind: "function", text: "round" },
        { kind: "normal", text: "(c.area * " },
        { kind: "number", text: "100" },
        { kind: "normal", text: ")," },
    ],
    [{ kind: "normal", text: "  }));" }],
    [{ kind: "normal", text: "};" }],
];

// カーソルが当たっている行（0-based）
const CURSOR_LINE_INDEX = 16;

const getTokenColor = (kind: TokenKind, map: HighlightMap): string => {
    const fg = map.Normal?.fg ?? "#c8c093";
    switch (kind) {
        case "keyword":
            return map.Keyword?.fg ?? fg;
        case "type":
            return map.Type?.fg ?? fg;
        case "string":
            return map.String?.fg ?? fg;
        case "function":
            return map.Function?.fg ?? fg;
        case "number":
            return map.Number?.fg ?? fg;
        case "comment":
            return map.Comment?.fg ?? "#727169";
        case "special":
            return map.Special?.fg ?? fg;
        case "operator":
            return map.Operator?.fg ?? fg;
        case "normal":
            return fg;
    }
};

/**
 * TypeScript コードのシンタックスハイライトプレビュー。
 * HighlightMap の色を各トークン種別に適用してエディタ風に表示する。
 */
/**
 * HighlightMap をデバッグ用のテキスト形式にフォーマットする
 */
const formatHighlightMap = (map: HighlightMap): string => {
    const maxGroupLen = Math.max(...Object.keys(map).map((k) => k.length));
    return Object.entries(map)
        .map(([group, attr]) => {
            const pad = group.padEnd(maxGroupLen, " ");
            const parts: string[] = [];
            if (attr.fg) parts.push(`fg: ${attr.fg}`);
            if (attr.bg) parts.push(`bg: ${attr.bg}`);
            if (attr.bold) parts.push("bold");
            if (attr.italic) parts.push("italic");
            if (attr.underline) parts.push("underline");
            return `${pad}  ${parts.join("  ")}`;
        })
        .join("\n");
};

export function CodePreview({ highlightMap }: CodePreviewProps) {
    const bg = highlightMap.Normal?.bg ?? "#1f1f28";
    const cursorLineBg = highlightMap.CursorLine?.bg;
    const lineNrFg = highlightMap.LineNr?.fg ?? "#545464";
    const cursorLineNrFg = highlightMap.CursorLineNr?.fg ?? lineNrFg;

    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = () => {
        const text = formatHighlightMap(highlightMap);
        navigator.clipboard.writeText(text).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    return (
        <div
            className="rounded-xl overflow-hidden border border-white/5"
            style={{ backgroundColor: bg }}
        >
            {/* タイトルバー */}
            <div
                className="px-4 py-2 flex items-center gap-2 border-b border-white/5"
                style={{ backgroundColor: `${bg}cc` }}
            >
                <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-white/10" />
                    <span className="w-3 h-3 rounded-full bg-white/10" />
                    <span className="w-3 h-3 rounded-full bg-white/10" />
                </div>
                <span
                    className="text-xs ml-2 font-mono"
                    style={{ color: lineNrFg }}
                >
                    extractor.ts
                </span>
                <button
                    type="button"
                    onClick={handleCopy}
                    className="ml-auto text-xs px-2 py-0.5 rounded transition-colors"
                    style={{
                        color: isCopied ? "#98bb6c" : lineNrFg,
                        backgroundColor: "transparent",
                    }}
                >
                    {isCopied ? "copied!" : "copy colors"}
                </button>
            </div>

            {/* コード本体 */}
            <div className="py-3 overflow-x-auto">
                {CODE_LINES.map((line, lineIdx) => {
                    const isCursorLine = lineIdx === CURSOR_LINE_INDEX;
                    return (
                        <div
                            // biome-ignore lint/suspicious/noArrayIndexKey: 静的なコードリストのため安全
                            key={lineIdx}
                            className="px-4 flex items-center"
                            style={{
                                backgroundColor: isCursorLine
                                    ? cursorLineBg
                                    : undefined,
                                minHeight: "1.5rem",
                            }}
                        >
                            {/* 行番号 */}
                            <span
                                className="select-none shrink-0 text-right font-mono text-xs mr-5"
                                style={{
                                    color: isCursorLine
                                        ? cursorLineNrFg
                                        : lineNrFg,
                                    minWidth: "1.5ch",
                                }}
                            >
                                {lineIdx + 1}
                            </span>

                            {/* トークン */}
                            <span className="font-mono text-xs whitespace-pre">
                                {line.length === 0
                                    ? " "
                                    : line.map((token, tokenIdx) => (
                                          <span
                                              // biome-ignore lint/suspicious/noArrayIndexKey: 静的なトークンリストのため安全
                                              key={tokenIdx}
                                              style={{
                                                  color: getTokenColor(
                                                      token.kind,
                                                      highlightMap,
                                                  ),
                                                  fontWeight:
                                                      token.kind === "keyword"
                                                          ? "bold"
                                                          : undefined,
                                                  fontStyle:
                                                      token.kind === "comment"
                                                          ? "italic"
                                                          : undefined,
                                              }}
                                          >
                                              {token.text}
                                          </span>
                                      ))}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
