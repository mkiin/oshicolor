import { analyzeColor } from "@/features/color-analyzer/repositories/analyze-color.functions";
import {
  PaletteView,
  paletteResultAtom,
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
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    });
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });

/** File → MIME type */
const fileMimeType = (file: File): string => file.type || "image/png";

function RouteComponent() {
  const setVisionResult = useSetAtom(visionResultAtom);
  const palette = useAtomValue(paletteResultAtom);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const imageBase64 = await fileToBase64(file);
      const mimeType = fileMimeType(file);
      return analyzeColor({ data: { imageBase64, mimeType } });
    },
    onSuccess: (data) => {
      setVisionResult(data);
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
          {palette && <PaletteView palette={palette} />}
        </div>
      )}
    </div>
  );
}
