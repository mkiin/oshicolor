import { analyzeColor } from "@/features/color-analyzer/repositories/analyze-color.functions";
import {
  type ThemeMood,
  DiagnosticPaletteView,
  EditorPaletteView,
  SeedView,
  SyntaxPaletteView,
  moodAtom,
  paletteAtom,
  visionResultAtom,
} from "@/features/palette-generator";
import { Dropzone, ImagePreview } from "@/shared/components/ui/dropzone";
import { Spinner } from "@/shared/components/ui/spinner";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useState } from "react";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

/** File → Base64 変換 */
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result.split(",")[1]);
      }
    });
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });

/** File → MIME type */
const fileMimeType = (file: File): string => file.type || "image/png";

const MOOD_OPTIONS: { value: ThemeMood; label: string; desc: string }[] = [
  { value: "dark", label: "Dark", desc: "深く鮮やか" },
  { value: "light-pastel", label: "Light Pastel", desc: "柔らかく淡い" },
  { value: "light", label: "Light", desc: "くっきり明瞭" },
];

function RouteComponent() {
  const setVisionResult = useSetAtom(visionResultAtom);
  const setMood = useSetAtom(moodAtom);
  const palette = useAtomValue(paletteAtom);
  const visionResult = useAtomValue(visionResultAtom);
  const currentMood = useAtomValue(moodAtom);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const imageBase64 = await fileToBase64(file);
      const mimeType = fileMimeType(file);
      return analyzeColor({ data: { imageBase64, mimeType } });
    },
    onSuccess: (data) => {
      setVisionResult(data);
      setMood(null);
    },
  });

  const handleFilesAccepted = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(file));
      mutation.mutate(file);
    },
    [mutation, previewUrl],
  );

  const handleMoodSelect = useCallback(
    (mood: ThemeMood) => {
      setMood(mood);
    },
    [setMood],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <h1 className="text-xl font-bold">oshicolor</h1>

      <Dropzone
        accept={{ "image/*": [] }}
        onFilesAccepted={handleFilesAccepted}
      />

      {mutation.isPending && (
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <Spinner className="h-4 w-4" />
          AI がキャラクターの色を分析中…
        </div>
      )}

      {mutation.isError && (
        <p className="text-sm text-red-400">エラー: {mutation.error.message}</p>
      )}

      {previewUrl && (
        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
          <div className="overflow-hidden rounded-lg bg-neutral-900">
            <ImagePreview
              url={previewUrl}
              className="h-full w-full object-contain"
            />
          </div>
          <div className="space-y-6">
            <SeedView />

            {visionResult && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-neutral-300">
                  Theme Mood
                </h3>
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
            )}

            {palette && (
              <>
                <EditorPaletteView />
                <SyntaxPaletteView />
                <DiagnosticPaletteView />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
