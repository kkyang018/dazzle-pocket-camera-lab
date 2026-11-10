import { useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ImagePlus, Loader2 } from "lucide-react";
import { LocalProcessingNote } from "@/components/app/local-note";
import { useApp } from "@/lib/app-state";
import { photoFromFile, photoFromSample } from "@/lib/photo";
import { cn } from "@/lib/utils";
import sampleStreet from "@/assets/sample-street.jpg";
import samplePortrait from "@/assets/sample-portrait.jpg";
import sampleCafe from "@/assets/sample-cafe.jpg";

const samples = [
  { key: "street", src: sampleStreet, name: "海边小镇", tag: "01" },
  { key: "portrait", src: samplePortrait, name: "公园笑脸", tag: "02" },
  { key: "cafe", src: sampleCafe, name: "窗边咖啡", tag: "03" },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lab · Dazz Lab 复古相机" },
      { name: "description", content: "在 Dazz Lab 选一张照片，送进复古相机的本机暗房。" },
      { property: "og:title", content: "Lab · Dazz Lab 复古相机" },
      { property: "og:description", content: "选一张照片，送进复古相机的本机暗房。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LabPage,
});

function LabPage() {
  const { setPhoto } = useApp();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(load: () => Promise<Parameters<typeof setPhoto>[0]>, key: string) {
    setBusy(key);
    setError(null);
    try {
      setPhoto(await load());
      navigate({ to: "/cameras" });
    } catch {
      setError("这张照片读不出来，换一张试试");
    } finally {
      setBusy(null);
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 允许再次选同一张
    if (file) void choose(() => photoFromFile(file), "album");
  }

  return (
    <main className="bg-vignette flex min-h-[calc(100dvh-5rem)] flex-col px-5 pt-[max(env(safe-area-inset-top),1.25rem)]">
      <header className="animate-rise">
        <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
          <span className="flex items-center gap-1.5">
            <span className="animate-blink size-1.5 rounded-full bg-primary" aria-hidden />
            Darkroom
          </span>
          <span>Step 01</span>
        </div>
        <h1 className="mt-6 font-serif text-[40px] leading-none font-black tracking-tight">Dazz Lab</h1>
        <p className="mt-3 text-sm text-muted-foreground">选一张照片，再挑一台相机冲洗它。</p>
      </header>

      <div className="flex flex-1 flex-col justify-center py-8">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={onFile}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy !== null}
          className="animate-rise group relative flex h-48 w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-[28px] bg-primary text-primary-foreground shadow-glow-amber transition-transform [animation-delay:80ms] active:scale-[0.98] disabled:opacity-80"
        >
          <span className="film-perforation absolute inset-x-0 top-3 h-2 opacity-60" aria-hidden />
          <span className="flex size-14 items-center justify-center rounded-full bg-primary-foreground/10 ring-1 ring-primary-foreground/20">
            {busy === "album" ? (
              <Loader2 className="size-7 animate-spin" strokeWidth={1.8} />
            ) : (
              <ImagePlus className="size-7" strokeWidth={1.8} />
            )}
          </span>
          <span className="font-serif text-2xl font-bold">选一张照片</span>
          <span className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-70">From album</span>
          <span className="film-perforation absolute inset-x-0 bottom-3 h-2 opacity-60" aria-hidden />
        </button>

        {error && (
          <p role="alert" className="mt-3 text-center text-xs text-destructive">
            {error}
          </p>
        )}

        <section aria-labelledby="samples-label" className="animate-rise mt-9 [animation-delay:160ms]">
          <div className="mb-3 flex items-baseline justify-between px-1">
            <h2 id="samples-label" className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
              没有照片？用示例试试
            </h2>
            <span className="font-mono text-[10px] text-muted-foreground">03</span>
          </div>
          <ul className="grid grid-cols-3 gap-2.5">
            {samples.map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void choose(() => photoFromSample(s), s.key)}
                  aria-label={`使用示例照片：${s.name}`}
                  className={cn(
                    "group relative block aspect-[3/4] w-full overflow-hidden rounded-xl bg-surface ring-1 ring-hairline transition-transform active:scale-95",
                    busy === s.key && "ring-2 ring-primary",
                  )}
                >
                  <img
                    src={s.src}
                    alt=""
                    width={300}
                    height={400}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                  <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-background/80 to-transparent px-2 pt-6 pb-1.5 text-left">
                    <span className="text-[11px] text-foreground">{s.name}</span>
                    <span className="font-mono text-[9px] text-muted-foreground">{s.tag}</span>
                  </span>
                  {busy === s.key && (
                    <span className="absolute inset-0 flex items-center justify-center bg-background/40">
                      <Loader2 className="size-5 animate-spin text-foreground" />
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <LocalProcessingNote className="pb-5" />
    </main>
  );
}
