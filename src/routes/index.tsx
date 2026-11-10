import { createFileRoute } from "@tanstack/react-router";
import { LocalProcessingNote } from "@/components/app/local-note";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lab · Dazz Lab 复古相机" },
      { name: "description", content: "在 Dazz Lab 挑一台复古相机，把相册照片送进本机暗房。" },
      { property: "og:title", content: "Lab · Dazz Lab 复古相机" },
      { property: "og:description", content: "挑一台复古相机，把相册照片送进本机暗房。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LabPage,
});

function LabPage() {
  return (
    <main className="bg-vignette flex min-h-[calc(100dvh-5rem)] flex-col px-5 pt-[max(env(safe-area-inset-top),1.25rem)]">
      <header className="animate-rise">
        <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
          <span className="flex items-center gap-1.5">
            <span className="animate-blink size-1.5 rounded-full bg-primary" aria-hidden />
            Darkroom
          </span>
          <span>No. 00</span>
        </div>
        <h1 className="mt-6 font-serif text-[40px] leading-none font-black tracking-tight">
          Dazz Lab
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">选一台相机，进暗房，出成品。</p>
      </header>

      <div className="film-perforation mt-8 h-3" aria-hidden />

      <section
        aria-label="相机架"
        className="animate-rise mt-4 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-hairline bg-surface/40 px-6 py-16 text-center [animation-delay:120ms]"
      >
        <span className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground">00 / 00</span>
        <p className="mt-3 font-serif text-lg">相机架还空着</p>
        <p className="mt-1.5 text-xs text-muted-foreground">相机即将上架</p>
      </section>

      <div className="film-perforation mt-4 h-3" aria-hidden />

      <LocalProcessingNote className="py-5" />
    </main>
  );
}
