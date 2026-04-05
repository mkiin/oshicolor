import { VimPreview } from "@/features/vim-preview";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/preview")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="mx-auto max-w-5xl p-8">
      <h1 className="mb-6 text-xl font-bold">Vim Preview</h1>
      <VimPreview variant="full" theme="tokyo-night" />
    </div>
  );
}
