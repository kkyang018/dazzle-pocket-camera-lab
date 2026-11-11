import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/preview")({
  head: () => ({
    meta: [
      { title: "成品预览 · Dazz Lab" },
      { name: "description", content: "预览套用模板后的复古相机成品。" },
      { property: "og:title", content: "成品预览 · Dazz Lab" },
      { property: "og:description", content: "预览套用模板后的复古相机成品。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PreviewPage,
});

function PreviewPage() {
  return (
    <main className="theme-paper flex min-h-[calc(100dvh-4rem)] flex-col px-5 pt-[max(env(safe-area-inset-top),1rem)]">
      <Link to="/result" className="-ml-2 flex items-center gap-0.5 self-start px-2 py-1 font-mono text-[11px] text-muted-foreground">
        <ChevronLeft className="size-4" />
        回模板
      </Link>
      <p className="mt-24 text-center font-serif">成品预览页即将开放</p>
    </main>
  );
}
