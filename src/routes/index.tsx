import { analyzeColorMutationAtom } from "@/features/color-analyzer";
import {
  type ThemeMood,
  DiagnosticPaletteView,
  EditorPaletteView,
  SeedView,
  SyntaxPaletteView,
  moodAtom,
  paletteAtom,
  AsyncVisionResultAtom,
} from "@/features/palette-generator";
import { VimPreview } from "@/features/vim-preview";
import { Dropzone, ImagePreview } from "@/shared/components/ui/dropzone";
import { ErrorBoundary } from "@/shared/components/ui/error-boundary";
import { Spinner } from "@/shared/components/ui/spinner";
import { createFileRoute } from "@tanstack/react-router";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Suspense, startTransition, useState } from "react";

export const Route = createFileRoute("/")({
  component: RouteComponent,
  ssr: false,
});

const MOOD_OPTIONS: { value: ThemeMood; label: string; desc: string }[] = [
  { value: "dark", label: "Dark", desc: "深く鮮やか" },
  { value: "light-pastel", label: "Light Pastel", desc: "柔らかく淡い" },
  { value: "light", label: "Light", desc: "くっきり明瞭" },
];

function RouteComponent() {
  const { mutateAsync } = useAtomValue(analyzeColorMutationAtom);
  const setVisionResult = useSetAtom(AsyncVisionResultAtom);
  const setMood = useSetAtom(moodAtom);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFilesAccepted = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setMood(null);
    setVisionResult(mutateAsync(file));
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <h1 className="text-xl font-bold">oshicolor</h1>

      <Dropzone
        accept={{ "image/*": [] }}
        onFilesAccepted={handleFilesAccepted}
      />

      {previewUrl && (
        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
          <div className="overflow-hidden rounded-lg bg-neutral-100">
            <ImagePreview
              url={previewUrl}
              className="h-full w-full object-contain"
            />
          </div>
          <ErrorBoundary
            fallback={(error) => (
              <p className="text-sm text-red-400">エラー: {error.message}</p>
            )}
          >
            <Suspense
              fallback={
                <div className="flex items-center gap-2 text-sm text-neutral-400">
                  <Spinner className="h-4 w-4" />
                  AI がキャラクターの色を分析中…
                </div>
              }
            >
              <AnalysisResults />
            </Suspense>
          </ErrorBoundary>
        </div>
      )}
    </div>
  );
}

function AnalysisResults() {
  const visionResult = useAtomValue(AsyncVisionResultAtom);
  const palette = useAtomValue(paletteAtom);
  const [currentMood, setMood] = useAtom(moodAtom);

  if (!visionResult) return null;

  const handleMoodSelect = (mood: ThemeMood) => {
    startTransition(() => {
      setMood(mood);
    });
  };

  return (
    <div className="space-y-6">
      <SeedView />

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-neutral-300">Theme Mood</h3>
        <div className="flex gap-2">
          {MOOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleMoodSelect(opt.value)}
              className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                currentMood === opt.value
                  ? "border-white bg-white/10 text-white"
                  : "border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
              }`}
            >
              <div className="font-medium">{opt.label}</div>
              <div className="text-xs opacity-60">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {palette && (
        <>
          <VimPreview palette={palette} variant="compact" />
          <EditorPaletteView />
          <SyntaxPaletteView />
          <DiagnosticPaletteView />
        </>
      )}
    </div>
  );
}
