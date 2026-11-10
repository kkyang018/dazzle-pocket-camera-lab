import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/cameras")({
  head: () => ({
    meta: [
      { title: "相机陈列 · Dazz Lab" },
      { name: "description", content: "为你的照片挑一台复古相机。" },
      { property: "og:title", content: "相机陈列 · Dazz Lab" },
      { property: "og:description", content: "为你的照片挑一台复古相机。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CamerasPage,
});

function CamerasPage() {
  const { photo } = useApp();

  if (!photo) {
    return (
      <main className="flex min-h-[calc(100dvh-5rem)] flex-col items-center justify-center px-8 text-center">
        <p className="font-serif text-lg">还没有选照片</p>
        <p className="mt-1.5 text-xs text-muted-foreground">先回 Lab 选一张，再来挑相机</p>
        <Link
          to="/"
          className="mt-6 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
        >
          去选照片
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-[calc(100dvh-5rem)] flex-col px-5 pt-[max(env(safe-area-inset-top),1.25rem)]">
      <header className="animate-rise">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="-ml-2 flex items-center gap-0.5 rounded-full px-2 py-1 font-mono text-[11px] text-muted-foreground"
          >
            <ChevronLeft className="size-4" />
            换照片
          </Link>
          <span className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Step 02</span>
        </div>
        <h1 className="mt-5 font-serif text-[32px] leading-none font-bold">相机陈列</h1>
      </header>

      <figure className="animate-rise mt-6 flex items-center gap-3 rounded-2xl border border-hairline bg-surface p-2.5 [animation-delay:80ms]">
        <img
          src={photo.src}
          alt="已选照片"
          className="size-16 shrink-0 rounded-lg object-cover"
          width={64}
          height={64}
        />
        <figcaption className="min-w-0">
          <span className="block truncate text-sm">{photo.name}</span>
          <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
            {photo.width} × {photo.height} · {photo.origin === "album" ? "相册" : "示例"}
          </span>
        </figcaption>
      </figure>

      <section
        aria-label="相机架"
        className="animate-rise mt-4 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-hairline bg-surface/40 px-6 py-16 text-center [animation-delay:160ms]"
      >
        <span className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground">00 / 00</span>
        <p className="mt-3 font-serif text-lg">相机即将上架</p>
        <p className="mt-1.5 text-xs text-muted-foreground">下一步会在这里挑一台相机</p>
      </section>

      <div className="h-6" />
    </main>
  );
}
