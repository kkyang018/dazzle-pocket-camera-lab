import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useEffect, useRef } from "react";
import { usePhotoBase } from "@/hooks/use-photo-base";
import { useApp } from "@/lib/app-state";
import { renderWithPreset } from "@/lib/render";

export const Route = createFileRoute("/result")({
  head: () => ({
    meta: [
      { title: "成品 · Dazz Lab" },
      { name: "description", content: "显影完成的复古相机照片成品。" },
      { property: "og:title", content: "成品 · Dazz Lab" },
      { property: "og:description", content: "显影完成的复古相机照片成品。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResultPage,
});

function ResultPage() {
  const { photo, look } = useApp();
  const base = usePhotoBase(photo);
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!base || !look || !ref.current) return;
    const out = renderWithPreset(base.canvas, look);
    ref.current.width = out.width;
    ref.current.height = out.height;
    ref.current.getContext("2d")!.drawImage(out, 0, 0);
  }, [base, look]);

  return (
    <main className="theme-paper flex min-h-[calc(100dvh-4rem)] flex-col px-5 pt-[max(env(safe-area-inset-top),1rem)]">
      <header className="flex items-center justify-between">
        <Link to="/darkroom" className="-ml-2 flex items-center gap-0.5 px-2 py-1 font-mono text-[11px] text-muted-foreground">
          <ChevronLeft className="size-4" />
          回暗房
        </Link>
        <h1 className="font-serif text-lg font-bold">成品</h1>
        <span className="w-14" />
      </header>
      {photo && look ? (
        <canvas ref={ref} className="mx-auto mt-6 max-h-[55dvh] max-w-full shadow-[0_18px_40px_-14px_rgb(0_0_0/0.4)]" />
      ) : (
        <p className="mt-20 text-center font-serif">还没有显影好的照片</p>
      )}
      <p className="mt-6 text-center font-mono text-[11px] text-muted-foreground">成品模板页即将开放</p>
    </main>
  );
}
