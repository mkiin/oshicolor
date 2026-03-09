import { createFileRoute } from "@tanstack/react-router";
import { oklch } from "culori";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { Vibrant } from "node-vibrant/browser";
import { useEffect, useState } from "react";
import { Dropzone, ImagePreview } from "@/components/ui/dropzone";

export const Route = createFileRoute("/")({
    component: RouteComponent,
});

const fileAtom = atom<File | null>(null);

const previewUrlAtom = atom((get) => {
    const file = get(fileAtom);
    return file ? URL.createObjectURL(file) : null;
});

// --- 定数 ---

const HUE_BAND_SIZE = 36;
const HUE_CLUSTER_COUNT = 10;
const MIN_LIGHTNESS = 0.08;
const MAX_LIGHTNESS = 0.92;
const MIN_CHROMA = 0.03;
/** サブクラスターとして認める最小支持度比率（ベース比）。これ未満はノイズとして除外 */
const SUB_MIN_SUPPORT_RATIO = 0.1;

// --- 型 ---

type OklchColor = {
    hex: string;
    population: number;
    l: number;
    c: number;
    h: number;
};

type HueCluster = {
    /** 色相帯インデックス (0–9) */
    bandIndex: number;
    colors: OklchColor[];
    /** 支持度 = Σ(proportion × chroma) */
    support: number;
};

type AccentCandidate = OklchColor & {
    /** chroma × 正規化色相距離 */
    accentScore: number;
    /** ベースとの色相距離（度） */
    hueDistDeg: number;
};

type RawSwatch = { hex: string; population: number };

type ExtractionResult = {
    /** 支持度降順クラスター（[0]=ベース, [1]=サブ） */
    clusters: HueCluster[];
    /** アクセント候補。accentScore 降順。[0] が選択色、isFallback=true なら chroma フォールバック */
    accentCandidates: AccentCandidate[];
    isFallback: boolean;
    /** フィルタ済み全色（population 降順） */
    filteredColors: OklchColor[];
    /** MMCQの生出力（フィルター前、population 降順） */
    rawColors: RawSwatch[];
};

// --- アルゴリズム ---

/** 円環上の色相距離を 0–1 に正規化して返す */
const normalizedHueDist = (a: number, b: number): number => {
    const diff = Math.abs(a - b);
    return Math.min(diff, 360 - diff) / 180;
};

/**
 * node-vibrant の MMCQ raw colors（スコアリング前）を受け取り、
 * ベース/サブクラスターとアクセントカラーを返す。
 */
const extractColors = (
    swatches: { rgb: [number, number, number]; hex: string; population: number }[],
): ExtractionResult => {
    const totalPopulation = swatches.reduce((sum, s) => sum + s.population, 0);
    const rawColors = [...swatches]
        .sort((a, b) => b.population - a.population)
        .map(({ hex, population }) => ({ hex, population }));

    if (totalPopulation === 0) return { clusters: [], accentCandidates: [], isFallback: false, filteredColors: [], rawColors };

    // OKLCH変換 & フィルタリング
    const filtered: OklchColor[] = [];
    for (const swatch of swatches) {
        const [r, g, b] = swatch.rgb;
        const ok = oklch({ mode: "rgb", r: r / 255, g: g / 255, b: b / 255 });
        if (!ok) continue;
        const { l, c, h } = ok;
        if (h === undefined || Number.isNaN(h)) continue;
        if (l < MIN_LIGHTNESS || l > MAX_LIGHTNESS) continue;
        if (c < MIN_CHROMA) continue;
        filtered.push({ hex: swatch.hex, population: swatch.population, l, c, h });
    }

    if (filtered.length === 0) return { clusters: [], accentCandidates: [], isFallback: false, filteredColors: [], rawColors };

    // 36° 帯でクラスタリング（ベース/サブ用）
    const clusters: HueCluster[] = Array.from({ length: HUE_CLUSTER_COUNT }, (_, i) => ({
        bandIndex: i,
        colors: [],
        support: 0,
    }));
    for (const color of filtered) {
        const proportion = color.population / totalPopulation;
        const bandIndex = Math.floor(color.h / HUE_BAND_SIZE) % HUE_CLUSTER_COUNT;
        const cluster = clusters[bandIndex];
        if (!cluster) continue;
        cluster.colors.push(color);
        cluster.support += proportion * color.c;
    }
    const sortedClusters = clusters
        .filter((c) => c.colors.length > 0)
        .sort((a, b) => b.support - a.support);

    // サブ候補: 隣接バンドかつ支持度がノイズレベルのクラスターをスキップして次を探す
    // 候補が見つからない場合は支持度2位をそのまま使う
    const baseSupport = sortedClusters[0]?.support ?? 0;
    const subCluster =
        sortedClusters.slice(1).find(
            (c) => c.support >= baseSupport * SUB_MIN_SUPPORT_RATIO,
        ) ?? sortedClusters[1];
    const validClusters = [
        ...sortedClusters.slice(0, 1),
        ...(subCluster ? [subCluster] : []),
    ];

    const sortedFilteredColors = [...filtered].sort((a, b) => b.population - a.population);

    // アクセント候補のスコアリング
    const baseCluster = validClusters[0];
    if (!baseCluster) return { clusters: validClusters, accentCandidates: [], isFallback: false, filteredColors: sortedFilteredColors, rawColors };

    // ベース・サブの代表色相
    const baseRepColor = baseCluster.colors.reduce((best, c) =>
        c.population > best.population ? c : best,
    );
    const baseHue = baseRepColor.h;

    const subHue = validClusters[1]
        ? validClusters[1].colors.reduce((best, c) => (c.population > best.population ? c : best)).h
        : null;

    // score = chroma × dist_from_base × dist_from_sub
    // サブがない場合は dist_from_base のみ
    const accentCandidates: AccentCandidate[] = filtered
        .map((color) => {
            const diff = Math.abs(color.h - baseHue);
            const hueDistDeg = Math.min(diff, 360 - diff);
            const distFromBase = hueDistDeg / 180;
            const distFromSub =
                subHue !== null
                    ? Math.min(Math.abs(color.h - subHue), 360 - Math.abs(color.h - subHue)) / 180
                    : 1;
            const accentScore = color.c * distFromBase * distFromSub;
            return { ...color, accentScore, hueDistDeg };
        })
        .sort((a, b) => b.accentScore - a.accentScore);

    return { clusters: validClusters, accentCandidates, isFallback: false, filteredColors: sortedFilteredColors, rawColors };
};

// --- コンポーネント ---

const copyHexList = (hexes: string[]) =>
    navigator.clipboard.writeText(hexes.join("\n"));

type CopyButtonProps = { hexes: string[] };

const CopyButton: React.FC<CopyButtonProps> = ({ hexes }) => (
    <button
        type="button"
        onClick={() => copyHexList(hexes)}
        className="text-[10px] font-mono text-gray-400 hover:text-white px-1 border border-gray-700 rounded"
    >
        copy
    </button>
);

type SwatchProps = { color: OklchColor };

const Swatch: React.FC<SwatchProps> = ({ color }) => (
    <div
        title={`${color.hex}  pop=${color.population}  L=${color.l.toFixed(2)} C=${color.c.toFixed(2)} H=${color.h.toFixed(0)}`}
        className="w-8 h-8 rounded"
        style={{ backgroundColor: color.hex }}
    />
);

type HueClusterViewProps = {
    clusters: HueCluster[];
};

const CLUSTER_ROLE_LABELS = ["ベース", "サブ"] as const;

const HueClusterView: React.FC<HueClusterViewProps> = ({ clusters }) => (
    <div className="space-y-3">
        {clusters.slice(0, 2).map((cluster, i) => {
            const hueStart = cluster.bandIndex * HUE_BAND_SIZE;
            const hueEnd = hueStart + HUE_BAND_SIZE;
            const role = CLUSTER_ROLE_LABELS[i] ?? `#${i + 1}`;
            return (
                <div key={cluster.bandIndex} className="space-y-1">
                    <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-500 font-mono">
                            {role} — {hueStart}°–{hueEnd}° 支持度:{" "}
                            {cluster.support.toFixed(4)}
                        </p>
                        <CopyButton hexes={cluster.colors.map((c) => c.hex)} />
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {cluster.colors.map((color) => (
                            <Swatch key={color.hex} color={color} />
                        ))}
                    </div>
                </div>
            );
        })}
    </div>
);

type AllColorsViewProps = {
    rawColors: RawSwatch[];
    filteredColors: OklchColor[];
};

const AllColorsView: React.FC<AllColorsViewProps> = ({ rawColors, filteredColors }) => (
    <div className="space-y-3">
        <div className="space-y-1">
            <div className="flex items-center gap-2">
                <p className="text-xs text-gray-500 font-mono">生出力 ({rawColors.length})</p>
                <CopyButton hexes={rawColors.map((c) => c.hex)} />
            </div>
            <div className="flex flex-wrap gap-1">
                {rawColors.map((c) => (
                    <div
                        key={c.hex}
                        title={`${c.hex}  pop=${c.population}`}
                        className="w-8 h-8 rounded"
                        style={{ backgroundColor: c.hex }}
                    />
                ))}
            </div>
        </div>
        <div className="space-y-1">
            <div className="flex items-center gap-2">
                <p className="text-xs text-gray-500 font-mono">フィルター後 ({filteredColors.length})</p>
                <CopyButton hexes={filteredColors.map((c) => c.hex)} />
            </div>
            <div className="flex flex-wrap gap-1">
                {filteredColors.map((c) => (
                    <Swatch key={c.hex} color={c} />
                ))}
            </div>
        </div>
    </div>
);

type AccentViewProps = {
    candidates: AccentCandidate[];
    isFallback: boolean;
};

const AccentView: React.FC<AccentViewProps> = ({ candidates, isFallback }) => {
    if (candidates.length === 0) return null;
    return (
        <div className="space-y-1">
            <div className="flex items-center gap-2">
                <p className="text-xs text-gray-500 font-mono">
                    アクセント候補
                    {isFallback && (
                        <span className="ml-1 text-yellow-500">(fallback)</span>
                    )}
                </p>
                <CopyButton hexes={candidates.map((c) => c.hex)} />
            </div>
            <div className="flex flex-wrap gap-1">
                {candidates.map((c, i) => (
                    <div key={c.hex} className="flex flex-col items-center gap-0.5">
                        <div
                            title={`${c.hex}  score=${c.accentScore.toFixed(3)}  dist=${c.hueDistDeg.toFixed(0)}°  C=${c.c.toFixed(2)}`}
                            className={`w-8 h-8 rounded ${i === 0 ? "ring-2 ring-white ring-offset-1 ring-offset-black" : ""}`}
                            style={{ backgroundColor: c.hex }}
                        />
                        <span className="text-[9px] font-mono text-gray-400">
                            {c.accentScore.toFixed(2)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

function RouteComponent() {
    const setFile = useSetAtom(fileAtom);
    const previewUrl = useAtomValue(previewUrlAtom);
    const [result, setResult] = useState<ExtractionResult | null>(null);
    const [isExtracting, setIsExtracting] = useState(false);

    useEffect(() => {
        if (!previewUrl) {
            setResult(null);
            return;
        }

        setIsExtracting(true);
        const v = new Vibrant(previewUrl, { colorCount: 64 });
        v.getPalette()
            .then(() => {
                const rawColors = v.result?.colors ?? [];
                setResult(extractColors(rawColors));
            })
            .catch(console.error)
            .finally(() => setIsExtracting(false));
    }, [previewUrl]);

    return (
        <div className="p-8 max-w-lg mx-auto space-y-4">
            <h1 className="text-xl font-bold">画像アップロード</h1>
            <Dropzone
                accept={{ "image/*": [] }}
                onFilesAccepted={(files) => setFile(files[0] ?? null)}
            />
            <ImagePreview url={previewUrl} />
            {isExtracting && (
                <p className="text-sm text-gray-400">抽出中...</p>
            )}
            {result && (
                <>
                    <HueClusterView clusters={result.clusters} />
                    <AccentView
                        candidates={result.accentCandidates}
                        isFallback={result.isFallback}
                    />
                    <AllColorsView rawColors={result.rawColors} filteredColors={result.filteredColors} />
                </>
            )}
        </div>
    );
}
