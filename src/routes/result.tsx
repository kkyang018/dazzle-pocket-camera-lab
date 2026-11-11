import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AiMark, ApproxTag, ProMark } from "@/components/app/marks";
import { useApp } from "@/lib/app-state";
import { loadFonts } from "@/lib/templates/draw";
import {
  TEMPLATES, defaultOptions, getTemplate, recommendTemplate, takeCount, usable,
  type TemplateId, type TemplateOptions,
} from "@/lib/templates";
import { developed, exportSource, saveCanvas } from "@/lib/templates/sources";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/result")({
  head: () => ({
    meta: [
      { title: "成品模板 · Dazz Lab" },
      { name: "description", content: "把相册里的照片做成半格胶片、拍立得手记、文艺单张、动态景深或旅行画报。" },
      { property: "og:title", content: "成品模板 · Dazz Lab" },
      { property: "og:description", content: "半格胶片、拍立得手记、文艺单张、动态景深、旅行画报。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResultPage,
});

const EXPORT_W = 2400;

function ResultPage() {
  const { album, selection, showHint } = useApp();
  const items = useMemo(() => selection.map((id) => album.find((a) => a.id === id)).filter((a) => !!a), [album, selection]);
  const lead = items[0] ?? null;
  const rec = recommendTemplate(items.length, lead?.category ?? null);
  const [tid, setTid] = useState<TemplateId>(rec);
  const [opts, setOpts] = useState<TemplateOptions>(() => defaultOptions(lead?.cameraName ?? null));
  const [imgs, setImgs] = useState<HTMLCanvasElement[] | null>(null);
  const [saving, setSaving] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const t = getTemplate(tid);
  const ids = items.map((i) => i.id).join(",");

  useEffect(() => {
    let alive = true;
    setImgs(null);
    Promise.all([loadFonts(), ...items.map((i) => developed(i))]).then(([, ...c]) => alive && setImgs(c as HTMLCanvasElement[]));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  // 实时预览：任何选项变化都同步重绘
  useEffect(() => {
    const c = canvas.current;
    if (!c || !imgs || !usable(t, imgs.length)) return;
    const raf = requestAnimationFrame(() => {
      const [w, h] = t.size;
      c.width = w;
      c.height = h;
      t.draw(c.getContext("2d")!, w, h, imgs.slice(0, takeCount(t, imgs.length)), opts);
    });
    return () => cancelAnimationFrame(raf);
  }, [imgs, opts, t]);

  const set = <K extends keyof TemplateOptions>(k: K, v: TemplateOptions[K]) => setOpts((o) => ({ ...o, [k]: v }));
  const pick = (id: TemplateId) => {
    const next = getTemplate(id);
    if (!usable(next, items.length)) return showHint(`${next.name}需要 ${next.min} 张照片`);
    if (next.pro) showHint("Pro 功能 · 试用中", "pro");
    setTid(id);
    setOpts((o) => ({ ...o, paper: 0 }));
  };

  async function save() {
    setSaving(true);
    try {
      const n = takeCount(t, items.length);
      const full = await Promise.all(items.slice(0, n).map(exportSource));
      const [w, h] = t.size;
      const out = document.createElement("canvas");
      out.width = EXPORT_W;
      out.height = Math.round((EXPORT_W * h) / w);
      t.draw(out.getContext("2d")!, out.width, out.height, full, opts);
      const r = await saveCanvas(out, `dazzlab-${t.id}-${Date.now()}.jpg`);
      if (r === "downloaded") showHint("已保存");
    } catch {
      showHint("保存失败，再试一次");
    } finally {
      setSaving(false);
    }
  }

  const n = takeCount(t, items.length);

  return (
    <main className="theme-paper flex min-h-[calc(100dvh-4rem)] flex-col px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-6">
      <header className="flex items-center justify-between">
        <Link to="/album" className="-ml-2 flex items-center gap-0.5 px-2 py-1 font-mono text-[11px] text-muted-foreground">
          <ChevronLeft className="size-4" /> 相册
        </Link>
        <h1 className="font-serif text-lg font-bold">成品</h1>
        <span className="w-12 text-right font-mono text-[10px] text-muted-foreground">{items.length} 张</span>
      </header>

      {!items.length ? (
        <div className="mt-24 text-center">
          <p className="font-serif">还没有选照片</p>
          <Link to="/album" className="mt-4 inline-block rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground">去相册选择</Link>
        </div>
      ) : (
        <>
          <nav aria-label="模板" className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {TEMPLATES.map((x) => {
              const ok = usable(x, items.length);
              return (
                <button key={x.id} type="button" onClick={() => pick(x.id)} aria-pressed={x.id === tid}
                  className={cn("relative shrink-0 rounded-2xl border px-3 py-2 text-left transition-colors",
                    x.id === tid ? "border-foreground bg-foreground text-background" : "border-border bg-card",
                    !ok && "opacity-40")}>
                  <span className="block font-serif text-[13px] font-bold">{x.name}</span>
                  <span className="block font-mono text-[9px] opacity-60">{x.en} · {x.min === x.max ? x.min : `${x.min}–${x.max}`}张</span>
                  <span className="absolute -top-1.5 -right-1 flex gap-0.5">
                    {x.id === rec && <AiMark className="size-3.5" label="AI 推荐" />}
                    {x.pro && <ProMark className="size-3.5" />}
                  </span>
                </button>
              );
            })}
          </nav>

          <section className="mt-3">
            <div className="relative overflow-hidden bg-muted shadow-sm" style={{ aspectRatio: `${t.size[0]} / ${t.size[1]}` }}>
              <canvas ref={canvas} className="size-full" aria-label={`${t.name}预览`} />
              {!imgs && <Loader2 className="absolute inset-0 m-auto size-6 animate-spin text-muted-foreground" />}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <p className="font-mono text-[10px] text-muted-foreground">
                {n < items.length ? `只用前 ${n} 张` : `${t.en}`}{t.id === rec && " · AI 按张数和相机推荐"}
              </p>
              {items.some((i) => i.photo.origin === "album") && <ApproxTag />}
            </div>
          </section>

          <section className="mt-3 space-y-3 rounded-2xl bg-card p-3">
            {t.fields.includes("caption") && (
              <Field label="打字机文字">
                <input value={opts.caption} onChange={(e) => set("caption", e.target.value)} maxLength={60}
                  className="w-full bg-transparent text-[15px] outline-none [font-family:'Special_Elite',serif]" placeholder="first light, slow afternoon" />
              </Field>
            )}
            {t.fields.includes("note") && (
              <Field label="手写文字">
                <textarea value={opts.note} onChange={(e) => set("note", e.target.value)} rows={2} maxLength={90}
                  className="w-full resize-none bg-transparent text-[14px] outline-none" placeholder="写一句给这张照片的话" />
              </Field>
            )}
            {t.fields.includes("date") && (
              <Field label={t.id === "polaroid" ? "日期印章" : "机身日期"}>
                <div className="flex items-center gap-2">
                  <input type="date" value={opts.date} onChange={(e) => e.target.value && set("date", e.target.value)}
                    className="bg-transparent font-mono text-[13px] outline-none" />
                  <button type="button" onClick={() => set("date", defaultOptions(null).date)} className="ml-auto rounded-full border border-border px-2 py-0.5 text-[11px]">今天</button>
                </div>
              </Field>
            )}
            {t.fields.includes("paper") && t.papers && (
              <Field label="底纸">
                <div className="flex gap-2">
                  {t.papers.map((p, i) => (
                    <button key={p.label} type="button" onClick={() => set("paper", i)} aria-pressed={opts.paper === i}
                      className={cn("flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px]", opts.paper === i ? "border-foreground" : "border-border")}>
                      <span className="size-3.5 rounded-full border border-border" style={{ background: p.color }} />{p.label}
                    </button>
                  ))}
                </div>
              </Field>
            )}
            {(t.fields.includes("swap") || t.fields.includes("edge")) && (
              <div className="flex gap-2">
                {t.fields.includes("swap") && (
                  <button type="button" onClick={() => set("swap", !opts.swap)} className="rounded-full border border-border px-3 py-1 text-[12px]">
                    {t.id === "halfframe" ? "左右互换" : "换背景图"}
                  </button>
                )}
                {t.fields.includes("edge") && (
                  <button type="button" onClick={() => set("edge", !opts.edge)} aria-pressed={opts.edge}
                    className={cn("rounded-full border px-3 py-1 text-[12px]", opts.edge ? "border-foreground" : "border-border")}>
                    片边信息
                  </button>
                )}
              </div>
            )}
          </section>

          <button type="button" onClick={save} disabled={saving || !imgs}
            className="mt-4 flex items-center justify-center gap-2 rounded-full bg-primary py-3 font-medium text-primary-foreground disabled:opacity-60">
            {saving && <Loader2 className="size-4 animate-spin" />}保存到相册
          </button>
          <p className="mt-2 text-center font-mono text-[10px] text-muted-foreground">用原图重新渲染 · JPG · 只在本机处理</p>
        </>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block border-b border-hairline pb-2 last:border-0">
      <span className="mb-1 block font-mono text-[10px] tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
