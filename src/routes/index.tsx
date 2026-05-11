import { Dropzone, ImagePreview } from "@/shared/components/ui/dropzone";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/")({
  component: RouteComponent,
  ssr: false,
});

function RouteComponent() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFilesAccepted = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
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
          <div className="text-sm text-neutral-400">
            パレット生成機能は準備中
          </div>
        </div>
      )}
    </div>
  );
}
