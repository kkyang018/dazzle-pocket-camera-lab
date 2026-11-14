import { useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Aperture, ChevronRight, ImagePlus, Images, Loader2 } from "lucide-react";
import { useApp } from "@/lib/app-state";
import { cameraName, getCamera } from "@/lib/cameras";
import { useT } from "@/lib/i18n";
import { photoFromFile, photoFromSample } from "@/lib/photo";
import { cn } from "@/lib/utils";
import { LangToggle } from "@/components/app/lang-toggle";
import { SAMPLES as samples } from "@/lib/samples";

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
  const { setPhoto, setRewashId, album, lang, photo, cameraId, lastPath } = useApp();
  const t = useT();
  // 手上还有一张没冲完的照片：给一个"继续"入口，回到上次停的那一步（选相机 / 暗房）
  const current = getCamera(cameraId);
  const resumeTo = lastPath.step === "/darkroom" && current ? "/darkroom" : "/cameras";
  // 新手引导：印样台里还没有自己的照片时显示，也可以手动关掉（只在本次打开有效）
  const [guideClosed, setGuideClosed] = useState(false);
  const showGuide = !guideClosed && !album.some((a) => a.id > 0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function choose(load: () => Promise<Parameters<typeof setPhoto>[0]>, key: string) {
    setBusy(key);
    setError(false);
    try {
      setPhoto(await load());
      setRewashId(null); // 新照片：显影后新加一张，不覆盖印样台里的旧照片
      navigate({ to: "/cameras" });
    } catch {
      setError(true);
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
          <LangToggle />
        </div>
        <h1 className="mt-6 font-serif text-[40px] leading-none font-black tracking-tight">Dazz Lab</h1>
        <p className={cn("mt-3 text-muted-foreground", lang === "en" ? "font-mono text-[11px] tracking-wide" : "font-serif text-sm")}>{t("选一张照片，再挑一台相机冲洗它。", "Pick a photo, then choose a camera to develop it.")}</p>
        {showGuide && (
          <div className="guide-card relative mt-4 rounded-2xl border border-hairline bg-surface/60 px-3 pt-3 pb-2.5">
            {/* 三步之间的连线，一颗光点沿线走，走到哪一步哪一步亮 */}
            <div aria-hidden className="pointer-events-none absolute top-[26px] right-[17%] left-[17%] h-px bg-hairline">
              <span className="guide-dot absolute top-1/2 left-0 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_8px_2px_var(--primary)]" />
            </div>
            <ol aria-label={t("怎么用", "How it works")} className="relative grid grid-cols-3">
              {([[ImagePlus, t("选照片", "Pick a photo")], [Aperture, t("挑相机显影", "Develop it")], [Images, t("印样台做成品", "Make prints")]] as const).map(([Icon, label], i) => (
                <li key={i} className="guide-in flex flex-col items-center gap-1.5" style={{ animationDelay: `${0.15 + i * 0.22}s` }}>
                  <span className="guide-step grid size-7 place-items-center rounded-full border border-hairline bg-background" style={{ animationDelay: `${0.95 + i * 1.8}s` }}>
                    <Icon className="size-3.5" strokeWidth={1.8} />
                  </span>
                  <span className="font-serif text-[11px] whitespace-nowrap text-foreground/85">{label}</span>
                </li>
              ))}
            </ol>
            <button type="button" onClick={() => setGuideClosed(true)} aria-label={t("关闭引导", "Close guide")}
              className="absolute top-1.5 right-2.5 text-[13px] leading-none text-muted-foreground">×</button>
          </div>
        )}
      </header>

      <div className="flex flex-1 flex-col justify-center py-8">
        {photo && (
          <Link
            to={resumeTo}
            className="animate-rise mb-4 flex items-center gap-3 rounded-2xl border border-hairline bg-surface/70 p-2.5 pr-3 transition-transform active:scale-[0.98]"
          >
            <img src={photo.src} alt="" className="size-12 shrink-0 rounded-lg object-cover ring-1 ring-hairline" />
            <span className="min-w-0 flex-1">
              <span className="block font-serif text-[15px] font-bold">{t("继续冲洗这张", "Continue developing")}</span>
              <span className="block truncate font-mono text-[10px] tracking-wide text-muted-foreground">
                {resumeTo === "/darkroom" && current
                  ? t(`回到暗房 · ${cameraName(current, lang)}`, `Back to the darkroom · ${cameraName(current, lang)}`)
                  : t("回到选相机", "Back to cameras")}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        )}
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
          <span className="font-serif text-2xl font-bold">{t("选一张照片", "Choose a photo")}</span>
          <span className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-70">From album</span>
          <span className="film-perforation absolute inset-x-0 bottom-3 h-2 opacity-60" aria-hidden />
        </button>

        {error && (
          <p role="alert" className="mt-3 text-center text-xs text-destructive">
            {t("这张照片读不出来，换一张试试", "Couldn't read this photo — try another one")}
          </p>
        )}

        <section aria-labelledby="samples-label" className="animate-rise mt-9 [animation-delay:160ms]">
          <div className="mb-3 flex items-baseline justify-between px-1">
            <h2 id="samples-label" className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
              {t("没有照片？用示例试试", "No photo? Try a sample")}
            </h2>
            <span className="font-mono text-[10px] text-muted-foreground">{String(samples.length).padStart(2, "0")}</span>
          </div>
          <ul className="grid grid-cols-4 gap-2">
            {samples.map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void choose(() => photoFromSample(s), s.key)}
                  aria-label={t(`使用示例照片：${s.name}`, `Use sample photo: ${s.nameEn}`)}
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
                  <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-background/80 to-transparent px-1.5 pt-6 pb-1.5 text-left">
                    <span className="truncate text-[10px] text-foreground">{t(s.name, s.nameEn)}</span>
                    <span className="font-mono text-[8px] text-muted-foreground">{s.tag}</span>
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
    </main>
  );
}
