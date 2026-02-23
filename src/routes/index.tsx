import { createFileRoute } from "@tanstack/react-router";
import { converter } from "culori";
import { useRef, useState } from "react";
import {
    buildCharacterPaletteDebugText,
    type CharacterPalette,
    deriveCharacterPalette,
    type SyntaxRole,
} from "@/features/color-extractor/palette-from-vibrant";
import {
    buildDebugText,
    extractColorsVibrant,
    type HueGroup,
    type VibrantResult,
    type VibrantSlot,
} from "@/features/color-extractor/vibrant-extractor";

export const Route = createFileRoute("/")({ component: App });

const toOklch = converter("oklch");

const getOklch = (hex: string) => {
    const lch = toOklch(hex);
    return {
        l: lch?.l?.toFixed(2) ?? "—",
        c: lch?.c?.toFixed(3) ?? "—",
        h: lch?.h?.toFixed(0) ?? "—",
    };
};

const SLOT_LABELS: Record<VibrantSlot, string> = {
    Vibrant: "Vibrant",
    DarkVibrant: "Dark Vibrant",
    LightVibrant: "Light Vibrant",
    Muted: "Muted",
    DarkMuted: "Dark Muted",
    LightMuted: "Light Muted",
};

// ── Hue グループ表示 ──────────────────────────────────────────────────────────

function HueGroupDisplay({ hueGroups }: { hueGroups: HueGroup[] }) {
    return (
        <div className="space-y-1">
            {hueGroups.map(({ label, swatches }) => (
                <div key={label} className="flex items-center gap-2">
                    <span
                        className="text-[9px] w-14 shrink-0"
                        style={{ color: "#666" }}
                    >
                        {label}
                    </span>
                    <span
                        className="text-[9px] w-7 shrink-0"
                        style={{ color: "#444" }}
                    >
                        {swatches.length}色
                    </span>
                    <div className="flex gap-0.5 flex-wrap">
                        {swatches.map(({ hex }) => (
                            <div
                                key={hex}
                                className="w-[18px] h-[18px] rounded-sm shrink-0"
                                style={{ backgroundColor: hex }}
                                title={hex}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Neovim エディタフレーム ────────────────────────────────────────────────────

/** 行番号セル。key を同一行に収めて biome-ignore が効くようにするためのラッパー */
function LineNumCell({ lineNum }: { lineNum: number }) {
    return (
        <div
            className="text-right pr-2 text-[11px] leading-[19px]"
            style={{ color: "rgba(255,255,255,0.1)" }}
        >
            {lineNum}
        </div>
    );
}

type NeovimFrameProps = {
    title: string;
    lines: React.ReactNode[];
    palette: CharacterPalette;
};

function NeovimFrame({ title, lines, palette }: NeovimFrameProps) {
    return (
        <div
            className="rounded-lg overflow-hidden border shadow-2xl"
            style={{ borderColor: "#222" }}
        >
            {/* タイトルバー */}
            <div
                className="h-[30px] flex items-center px-2.5 border-b"
                style={{ backgroundColor: "#0a090a", borderColor: "#222" }}
            >
                <div className="flex gap-1.5">
                    {(["error", "const", "string"] as const).map((key) => (
                        <span
                            key={key}
                            className="w-2.5 h-2.5 rounded-full"
                            style={{
                                backgroundColor: palette[key],
                                opacity: 0.6,
                            }}
                        />
                    ))}
                </div>
                <span
                    className="flex-1 text-center text-[10px]"
                    style={{ color: "#444" }}
                >
                    {title}
                </span>
            </div>

            {/* エディタ本体 */}
            <div
                className="flex"
                style={{ backgroundColor: palette.bg, color: palette.fg }}
            >
                {/* 行番号 */}
                <div
                    className="w-10 py-2 border-r shrink-0 select-none"
                    style={{ borderColor: "rgba(255,255,255,0.03)" }}
                >
                    {lines.map((_, i) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: 行番号は行の順序と一致するため適切
                        <LineNumCell key={`ln-${i}`} lineNum={i + 1} />
                    ))}
                </div>

                {/* コード */}
                <div className="flex-1 p-2 font-mono text-xs leading-[19px] overflow-x-auto whitespace-pre">
                    {lines.map((line, i) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: 行番号は行の順序と一致するため適切
                        <div key={`code-${i}`}>{line}</div>
                    ))}
                </div>
            </div>

            {/* ステータスバー */}
            <div
                className="h-[22px] flex items-center text-[9px] border-t"
                style={{ backgroundColor: "#0a090a", borderColor: "#222" }}
            >
                <div
                    className="px-2 h-full flex items-center font-bold tracking-widest"
                    style={{
                        backgroundColor: palette.accent,
                        color: palette.bg,
                    }}
                >
                    NORMAL
                </div>
                <span className="px-2" style={{ color: "#444" }}>
                    {title}
                    {"  "}utf-8
                </span>
            </div>
        </div>
    );
}

// ── Rust コードブロック ────────────────────────────────────────────────────────

function RustCodeBlock({ palette }: { palette: CharacterPalette }) {
    const kw = (t: string) => (
        <span style={{ color: palette.kw, fontStyle: "italic" }}>{t}</span>
    );
    const fn_ = (t: string) => (
        <span style={{ color: palette.fn, fontWeight: "bold" }}>{t}</span>
    );
    const ty = (t: string) => <span style={{ color: palette.type }}>{t}</span>;
    const nu = (t: string) => <span style={{ color: palette.const }}>{t}</span>;
    const cm = (t: string) => (
        <span style={{ color: palette.comment, fontStyle: "italic" }}>{t}</span>
    );
    const ac = (t: string) => (
        <span style={{ color: palette.accent }}>{t}</span>
    );
    const fi = (t: string) => <span style={{ color: palette.field }}>{t}</span>;
    const pa = (t: string) => <span style={{ color: palette.op }}>{t}</span>;
    const pp = (t: string) => (
        <span style={{ color: palette.special }}>{t}</span>
    );

    const lines: React.ReactNode[] = [
        cm("// Character palette — derived from artwork"),
        <>
            {kw("use")} std::collections::{ty("HashMap")}
            {";"}
        </>,
        " ",
        <>
            {pp("#[derive(")} {ty("Debug")}, {ty("Clone")}
            {pp("])")}
        </>,
        <>
            {kw("pub struct")} {ty("Palette")} {"{"}
        </>,
        <>
            {"    "}
            {fi("name")}: {ty("String")},
        </>,
        <>
            {"    "}
            {fi("signature_hue")}: {nu("f64")},
        </>,
        <>
            {"    "}
            {fi("colors")}: {ty("Vec")}&lt;{ty("Swatch")}&gt;,
        </>,
        "}",
        " ",
        <>
            {kw("impl")} {ty("Palette")} {"{"}
        </>,
        <>
            {"    "}
            {kw("pub fn")} {fn_("new")}({pa("name")}: &amp;{ty("str")},{" "}
            {pa("hue")}: {nu("f64")}) -&gt; {ty("Self")} {"{"}
        </>,
        <>
            {"        "}
            {ty("Self")} {"{"}
        </>,
        <>
            {"            "}
            {fi("name")}: {pa("name")}.{fn_("to_string")}(),
        </>,
        <>
            {"            "}
            {fi("signature_hue")}: {pa("hue")},
        </>,
        <>
            {"            "}
            {fi("colors")}: {ty("Vec")}::{fn_("new")}(),
        </>,
        <>
            {"        "}
            {"}"}
        </>,
        <>
            {"    "}
            {"}"}
        </>,
        " ",
        <>
            {"    "}
            {kw("pub fn")} {fn_("accent")}(&amp;{ac("self")}) -&gt;{" "}
            {ty("Option")}&lt;&amp;{ty("Swatch")}&gt; {"{"}
        </>,
        <>
            {"        "}
            {ac("self")}.{fi("colors")}.{fn_("iter")}()
        </>,
        <>
            {"            "}.{fn_("filter")}(|{pa("s")}| {pa("s")}.
            {fi("chroma")} &gt; {nu("0.15")})
        </>,
        <>
            {"            "}.{fn_("max_by")}(|{pa("a")}, {pa("b")}| {"{"}
        </>,
        <>
            {"                "}
            {pa("a")}.{fi("weight")}.{fn_("partial_cmp")}(&amp;{pa("b")}.
            {fi("weight")})
        </>,
        <>
            {"                    "}.{fn_("unwrap_or")}({ty("Ordering")}::
            {nu("Equal")})
        </>,
        <>
            {"            "}
            {"}"});
        </>,
        <>
            {"    "}
            {"}"}
        </>,
        " ",
        <>
            {"    "}
            {kw("pub fn")} {fn_("derive_syntax")}(&amp;{ac("self")},{" "}
            {pa("offset")}: {nu("f64")}) -&gt; {ty("Hsl")} {"{"}
        </>,
        <>
            {"        "}
            {kw("let")} hue = ({ac("self")}.{fi("signature_hue")} +{" "}
            {pa("offset")}) % {nu("360.0")}
            {";"}
        </>,
        <>
            {"        "}
            {kw("let")} sat = {ac("self")}.{fi("avg_sat")}.{fn_("clamp")}(
            {nu("0.1")}, {nu("0.35")});
        </>,
        <>
            {"        "}
            {ty("Hsl")}::{fn_("new")}(hue, sat, {nu("0.58")})
        </>,
        <>
            {"    "}
            {"}"}
        </>,
        "}",
    ];

    return <NeovimFrame title="palette.rs" lines={lines} palette={palette} />;
}

// ── TypeScript コードブロック ──────────────────────────────────────────────────

function TypeScriptCodeBlock({ palette }: { palette: CharacterPalette }) {
    const kw = (t: string) => (
        <span style={{ color: palette.kw, fontStyle: "italic" }}>{t}</span>
    );
    const fn_ = (t: string) => (
        <span style={{ color: palette.fn, fontWeight: "bold" }}>{t}</span>
    );
    const ty = (t: string) => <span style={{ color: palette.type }}>{t}</span>;
    const nu = (t: string) => <span style={{ color: palette.const }}>{t}</span>;
    const st = (t: string) => (
        <span style={{ color: palette.string }}>{t}</span>
    );
    const ac = (t: string) => (
        <span style={{ color: palette.accent }}>{t}</span>
    );
    const fi = (t: string) => <span style={{ color: palette.field }}>{t}</span>;
    const pa = (t: string) => <span style={{ color: palette.op }}>{t}</span>;
    const tg = (t: string) => <span style={{ color: palette.fn }}>{t}</span>;
    const at = (t: string) => (
        <span style={{ color: palette.special }}>{t}</span>
    );

    const lines: React.ReactNode[] = [
        <>
            {kw("import")} {"{ useState, useCallback }"} {kw("from")}{" "}
            {st('"react"')}
            {";"}
        </>,
        <>
            {kw("import type")} {"{ "}
            {ty("FC")}, {ty("ReactNode")}
            {" }"} {kw("from")} {st('"react"')}
            {";"}
        </>,
        " ",
        <>
            {kw("interface")} {ty("PaletteProps")} {"{"}
        </>,
        <>
            {"  "}
            {fi("colors")}: {ty("Record")}&lt;{ty("string")}, {ty("string")}
            &gt;;
        </>,
        <>
            {"  "}
            {fi("accent")}: {ty("string")}
            {";"}
        </>,
        <>
            {"  "}
            {fi("onSelect")}?: ({pa("hex")}: {ty("string")}) {"=>"} {ty("void")}
            ;
        </>,
        "}",
        " ",
        <>
            {kw("const")} {nu("MAX_COLORS")} = {nu("48")}
            {";"}
        </>,
        " ",
        <>
            {kw("export const")} {fn_("PaletteView")}: {ty("FC")}&lt;
            {ty("PaletteProps")}&gt; = ({"{ colors, accent, onSelect }"}) {"=>"}{" "}
            {"{"}
        </>,
        <>
            {"  "}
            {kw("const")} [{fi("copied")}, {fn_("setCopied")}] ={" "}
            {fn_("useState")}&lt;{ty("string")} | {ty("null")}&gt;(null);
        </>,
        " ",
        <>
            {"  "}
            {kw("const")} {fn_("handleClick")} = {fn_("useCallback")}((
            {pa("hex")}: {ty("string")}) {"=>"} {"{"}
        </>,
        <>
            {"    "}navigator.clipboard.{fn_("writeText")}({pa("hex")});
        </>,
        <>
            {"    "}
            {fn_("setCopied")}({pa("hex")});
        </>,
        <>
            {"    "}onSelect?.({pa("hex")});
        </>,
        <>
            {"  "}
            {"}"}, [onSelect]);
        </>,
        " ",
        <>
            {"  "}
            {kw("return")} (
        </>,
        <>
            {"    "}&lt;{tg("div")} {at("className")}={st('"palette-grid"')}&gt;
        </>,
        <>
            {"      "}
            {"{"}
            {ty("Object")}.{fn_("entries")}(colors).{fn_("map")}(([{pa("name")},{" "}
            {pa("hex")}]) {"=>"} (
        </>,
        <>
            {"        "}&lt;{tg("button")}
        </>,
        <>
            {"          "}
            {at("key")}={"{"}
            {pa("name")}
            {"}"}
        </>,
        <>
            {"          "}
            {at("onClick")}={"{ "}() {"=>"} {fn_("handleClick")}({pa("hex")})
            {" }"}
        </>,
        <>
            {"          "}
            {at("style")}={"{{ background: "}
            {pa("hex")}
            {"}}"}
            {"}"}
        </>,
        <>{"        "}&gt;</>,
        <>
            {"          "}
            {"{"}
            {pa("name")}
            {"}"}
        </>,
        <>
            {"        "}&lt;/{tg("button")}&gt;
        </>,
        <>
            {"      "})){"}"}
        </>,
        <>
            {"    "}&lt;/{tg("div")}&gt;
        </>,
        <>{"  "});</>,
        <>{ac("}")};</>,
    ];

    return (
        <NeovimFrame title="PaletteView.tsx" lines={lines} palette={palette} />
    );
}

// ── 生成パレットプレビュー ────────────────────────────────────────────────────

const SYNTAX_ORDER: SyntaxRole[] = [
    "fn",
    "kw",
    "field",
    "string",
    "type",
    "op",
    "const",
    "special",
];

type CharacterPalettePreviewProps = {
    palette: CharacterPalette;
    vibrantResult: VibrantResult;
};

function CharacterPalettePreview({
    palette,
    vibrantResult,
}: CharacterPalettePreviewProps) {
    const sectionTitle = (label: string) => (
        <p
            className="text-[10px] uppercase tracking-widest pb-1 border-b"
            style={{ color: "#666", borderColor: "#222" }}
        >
            {label}
        </p>
    );

    return (
        <div className="space-y-5">
            {/* パラメータ */}
            <div
                className="flex flex-wrap gap-x-4 gap-y-1 text-[10px]"
                style={{ color: "#555" }}
            >
                <span>
                    syntaxChroma:{" "}
                    <span style={{ color: "#aaa" }}>
                        {palette.syntaxChroma.toFixed(3)}
                    </span>
                </span>
                <span>
                    vibrant.C:{" "}
                    <span style={{ color: "#aaa" }}>
                        {palette.vibrantC.toFixed(3)}
                    </span>
                </span>
            </div>

            {/* node-vibrant 6色 */}
            <div className="space-y-2">
                {sectionTitle("node-vibrant 6色")}
                <div className="flex gap-1 flex-wrap">
                    {vibrantResult.colors.map(({ hex, slot }) => {
                        const { c } = getOklch(hex);
                        return (
                            <div
                                key={slot}
                                className="rounded overflow-hidden w-[130px]"
                                style={{ backgroundColor: "#151316" }}
                            >
                                <div
                                    className="h-10 w-full"
                                    style={{ backgroundColor: hex }}
                                />
                                <div
                                    className="p-1.5 space-y-0.5 text-[9px]"
                                    style={{ color: "#777" }}
                                >
                                    <p>{SLOT_LABELS[slot]}</p>
                                    <p className="font-mono">{hex}</p>
                                    <p>C={c}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ベースカラー */}
            <div className="space-y-2">
                {sectionTitle("Base colors")}
                <div className="flex gap-1 flex-wrap">
                    {(["bg", "fg", "accent", "comment", "error"] as const).map(
                        (key) => (
                            <div
                                key={key}
                                className="rounded overflow-hidden flex-1 min-w-[80px]"
                                style={{ backgroundColor: "#151316" }}
                            >
                                <div
                                    className="h-9 w-full"
                                    style={{ backgroundColor: palette[key] }}
                                />
                                <div
                                    className="p-1.5 text-[9px]"
                                    style={{ color: "#777" }}
                                >
                                    <p>{key}</p>
                                    <p className="font-mono">{palette[key]}</p>
                                </div>
                            </div>
                        ),
                    )}
                </div>
            </div>

            {/* syntax カラー */}
            <div className="space-y-2">
                {sectionTitle("Syntax colors")}
                <div className="grid grid-cols-4 gap-1">
                    {SYNTAX_ORDER.map((role) => {
                        const hex = palette[role];
                        const { l, c, h } = getOklch(hex);
                        const src = palette.source[role];
                        const srcLabel =
                            src === "accent"
                                ? "accent"
                                : src === "image"
                                  ? "画像"
                                  : "生成";
                        const srcStyle =
                            src === "image"
                                ? {
                                      backgroundColor: "#1a3a1a",
                                      color: "#6a9a6a",
                                  }
                                : src === "accent"
                                  ? {
                                        backgroundColor: "#2a1a3a",
                                        color: "#9a6aaa",
                                    }
                                  : {
                                        backgroundColor: "#1a1a2a",
                                        color: "#6a6a9a",
                                    };
                        return (
                            <div
                                key={role}
                                className="rounded overflow-hidden"
                                style={{ backgroundColor: "#151316" }}
                            >
                                <div
                                    className="h-9 w-full"
                                    style={{ backgroundColor: hex }}
                                />
                                <div className="p-1.5 space-y-0.5">
                                    <div className="flex items-center justify-between gap-1">
                                        <span
                                            className="text-[9px]"
                                            style={{ color: "#777" }}
                                        >
                                            {role}
                                        </span>
                                        <span
                                            className="text-[8px] px-1 rounded"
                                            style={srcStyle}
                                        >
                                            {srcLabel}
                                        </span>
                                    </div>
                                    <p
                                        className="text-[9px] font-mono"
                                        style={{ color: "#ccc" }}
                                    >
                                        {hex}
                                    </p>
                                    <p
                                        className="text-[8px] font-mono"
                                        style={{ color: "#555" }}
                                    >
                                        L={l} C={c} H={h}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Neovim プレビュー — Rust */}
            <div className="space-y-2">
                {sectionTitle("Neovim preview — Rust")}
                <RustCodeBlock palette={palette} />
            </div>

            {/* Neovim プレビュー — TypeScript / React */}
            <div className="space-y-2">
                {sectionTitle("Neovim preview — TypeScript / React")}
                <TypeScriptCodeBlock palette={palette} />
            </div>

            {/* Hue グループ */}
            <div className="space-y-2">
                {sectionTitle(`Hue groups (${vibrantResult.swatchCount}色)`)}
                <HueGroupDisplay hueGroups={vibrantResult.hueGroups} />
            </div>
        </div>
    );
}

// ── App ───────────────────────────────────────────────────────────────────────

export function App() {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [vibrantResult, setVibrantResult] = useState<VibrantResult | null>(
        null,
    );
    const [characterPalette, setCharacterPalette] =
        useState<CharacterPalette | null>(null);
    const [isExtracting, setIsExtracting] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = (file: File) => {
        if (!file.type.startsWith("image/")) return;
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        setVibrantResult(null);
        setCharacterPalette(null);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleReset = () => {
        setPreviewUrl(null);
        setVibrantResult(null);
        setCharacterPalette(null);
        if (inputRef.current) inputRef.current.value = "";
    };

    const handleCopy = () => {
        if (!vibrantResult) return;
        const parts = [buildDebugText(vibrantResult)];
        if (characterPalette) {
            parts.push(buildCharacterPaletteDebugText(characterPalette));
        }
        navigator.clipboard.writeText(parts.join("\n\n")).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    const handleExtract = () => {
        if (!previewUrl) return;
        setIsExtracting(true);
        extractColorsVibrant(previewUrl).then((result) => {
            setVibrantResult(result);
            setCharacterPalette(deriveCharacterPalette(result));
            setIsExtracting(false);
        });
    };

    return (
        <div
            className="min-h-screen flex justify-center p-8"
            style={{ backgroundColor: "#050405", color: "#ccc" }}
        >
            <div className="w-full max-w-2xl space-y-6">
                {/* タイトル */}
                <div className="text-center">
                    <h1 className="text-xl font-bold">
                        <span style={{ color: "#fff" }}>oshi</span>
                        <span
                            style={{
                                color: characterPalette?.accent ?? "#9333ea",
                            }}
                        >
                            color
                        </span>
                    </h1>
                    <p className="text-[10px] mt-0.5" style={{ color: "#666" }}>
                        Character-motif Neovim colorscheme generator
                    </p>
                </div>

                {/* ドロップゾーン */}
                {!previewUrl && (
                    <button
                        type="button"
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onClick={() => inputRef.current?.click()}
                        className="w-full border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors"
                        style={{
                            borderColor: isDragging ? "#7c3aed" : "#374151",
                            backgroundColor: isDragging ? "#1e0b2e" : "#111827",
                        }}
                    >
                        <p className="text-sm" style={{ color: "#9ca3af" }}>
                            画像をドラッグ&ドロップ、またはクリックして選択
                        </p>
                        <p
                            className="text-xs mt-1"
                            style={{ color: "#4b5563" }}
                        >
                            JPG / PNG / WebP
                        </p>
                    </button>
                )}

                <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleChange}
                />

                {/* プレビューと操作ボタン */}
                {previewUrl && (
                    <div className="space-y-3">
                        <img
                            src={previewUrl}
                            alt="preview"
                            className="w-full rounded-xl object-contain max-h-72"
                        />
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={handleExtract}
                                disabled={isExtracting}
                                className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{
                                    backgroundColor: "#7c3aed",
                                    color: "#fff",
                                }}
                            >
                                {isExtracting ? "抽出中..." : "カラーを抽出"}
                            </button>
                            <button
                                type="button"
                                onClick={handleReset}
                                className="px-4 py-2.5 rounded-lg text-sm transition-colors"
                                style={{
                                    backgroundColor: "#1f2937",
                                    color: "#d1d5db",
                                }}
                            >
                                リセット
                            </button>
                            {vibrantResult && (
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    className="px-4 py-2.5 rounded-lg text-xs transition-colors"
                                    style={{
                                        backgroundColor: "#1f2937",
                                        color: "#9ca3af",
                                    }}
                                >
                                    {isCopied
                                        ? "コピー済み ✓"
                                        : "デバッグコピー"}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* 生成パレットプレビュー */}
                {characterPalette && vibrantResult && (
                    <CharacterPalettePreview
                        palette={characterPalette}
                        vibrantResult={vibrantResult}
                    />
                )}
            </div>
        </div>
    );
}
