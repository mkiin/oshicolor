import { createFileRoute } from "@tanstack/react-router";
import { ImageDropze } from "@/components/ui/dropzone";

export const Route = createFileRoute("/")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <div className="">
            <ImageDropze />
        </div>
    );
}
