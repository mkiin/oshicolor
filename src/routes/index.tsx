import { ColorExtractPanel } from "@/features/color-extract";
import { Dropzone } from "@/shared/components/ui/dropzone";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/")({
  component: RouteComponent,
  ssr: false,
});

function RouteComponent() {
  const [file, setFile] = useState<File | null>(null);

  const handleFilesAccepted = (files: File[]) => {
    const accepted = files[0];
    if (accepted) setFile(accepted);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">oshicolor</h1>
        <p className="text-muted-foreground text-sm">
          画像からカラースキームを抽出する
        </p>
      </header>

      <Dropzone
        accept={{ "image/*": [] }}
        onFilesAccepted={handleFilesAccepted}
      />

      {file ? (
        <ColorExtractPanel image={file} />
      ) : (
        <div className="text-muted-foreground flex min-h-48 items-center justify-center rounded-lg border border-dashed text-sm">
          画像をアップロードするとパレットが出ます
        </div>
      )}
    </div>
  );
}
