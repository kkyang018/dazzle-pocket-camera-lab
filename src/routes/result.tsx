import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { puzzleStyle, soloLines } from "@/lib/ai/vision.functions";
import { ChevronLeft, Loader2, Shuffle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AiMark, ApproxTag, ProMark } from "@/components/app/marks";
import { useApp } from "@/lib/app-state";
import { loadFonts } from "@/lib/templates/draw";
import {
  TEMPLATES, blockReason, defaultOptions, getTemplate, puzzleCrop, puzzleRects, puzzleSticker, recommendTemplate, takeCount, usable,
  type PolaroidFormat, type PuzzleAI, type SoloStroke, type StickerFamily, type TemplateId, type TemplateOptions,
} from "@/lib/templates";
import { developed, exportSource, saveCanvas } from "@/lib/templates/sources";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/result")({
  head: () => ({
    meta: [
      { title: "成品模板 · Dazz Lab" },
      { name: "description", content: "把相册里的照片做成手绘单张、半格胶片、拍立得或拼图贴纸成品。" },
      { property: "og:title", content: "成品模板 · Dazz Lab" },
      { property: "og:description", content: "手绘单张、半格胶片、拍立得、拼图贴纸。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResultPage,
});

const EXPORT_LONG = 4000;
const FORMATS: { id: PolaroidFormat; label: string }[] = [
  { id: "mini", label: "Mini" }, { id: "square", label: "Square" }, { id: "wide", label: "Wide" },
];
const FAMILIES: { id: StickerFamily; label: string }[] = [
  { id: "dot", label: "波点" }, { id: "star", label: "星星" }, { id: "heart", label: "爱心" }, { id: "spiral", label: "漩涡" },
  { id: "spark", label: "火花" }, { id: "flower", label: "小花" }, { id: "firework", label: "烟花" },
];
/** 发给 AI 的小图（长边 512） */
function thumb(c: HTMLCanvasElement) {
  const s = Math.min(1, 512 / Math.max(c.width, c.height));
  const t = document.createElement("canvas");
  t.width = Math.round(c.width * s); t.height = Math.round(c.height * s);
  t.getContext("2d")!.drawImage(c, 0, 0, t.width, t.height);
  return t.toDataURL("image/jpeg", 0.8);
}
const COLORS = ["#E9D18B", "#F2A38B", "#9CC7E0", "#F3E3B5"];

function ResultPage() {
  const { album, selection, showHint } = useApp();
  const items = useMemo(() => selection.map((id) => album.find((a) => a.id === id)).filter((a) => !!a), [album, selection]);
  const cats = useMemo(() => items.map((i) => i.category), [items]);
  const lead = items[0] ?? null;
  const rec = recommendTemplate(items.length, lead?.category ?? null);
  const [tid, setTid] = useState<TemplateId>(rec);
  const [opts, setOpts] = useState<TemplateOptions>(() => defaultOptions(lead?.place ?? null));
  useEffect(() => { if (lead?.place) setOpts((o) => (o.caption ? o : { ...o, caption: lead.place! })); }, [lead?.place]);
  const [imgs, setImgs] = useState<HTMLCanvasElement[] | null>(null);
  const [saving, setSaving] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; side: number; start: [number, number]; rw: number; rh: number } | null>(null);
  const [soloAI, setSoloAI] = useState<Record<string, SoloStroke[] | "pending" | "err">>({});
  const [puzAI, setPuzAI] = useState<Record<string, PuzzleAI | "pending" | "err">>({});
  const callSolo = useServerFn(soloLines);
  const callPuzzle = useServerFn(puzzleStyle);
  const t = getTemplate(tid);
  const ok = usable(t, cats);
  const ids = items.map((i) => i.id).join(",");

  useEffect(() => {
    let alive = true;
    setImgs(null);
    Promise.all([loadFonts(), ...items.map((i) => developed(i))]).then(([, ...c]) => alive && setImgs(c as HTMLCanvasElement[]));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  // AI 看图：手绘单张配线、拼图选贴纸/配色/主体位置；结果按照片组缓存
  const soloKey = `${ids}:${opts.seed}`;
  useEffect(() => {
    if (!imgs || tid !== "solo" || soloAI[soloKey]) return;
    setSoloAI((m) => ({ ...m, [soloKey]: "pending" }));
    callSolo({ data: { image: thumb(imgs[0]!), variant: opts.seed } })
      .then((r) => { setSoloAI((m) => ({ ...m, [soloKey]: r.ok ? r.data : "err" })); if (!r.ok) showHint(r.error); })
      .catch(() => { setSoloAI((m) => ({ ...m, [soloKey]: "err" })); showHint("AI 配线失败，先用本地效果"); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgs, tid, soloKey]);
  useEffect(() => {
    if (!imgs || tid !== "puzzle" || puzAI[ids] || imgs.length < 3) return;
    setPuzAI((m) => ({ ...m, [ids]: "pending" }));
    callPuzzle({ data: { images: imgs.slice(0, 4).map(thumb) } })
      .then((r) => { setPuzAI((m) => ({ ...m, [ids]: r.ok ? r.data : "err" })); if (!r.ok) showHint(r.error); })
      .catch(() => { setPuzAI((m) => ({ ...m, [ids]: "err" })); showHint("AI 配贴纸失败，先用本地效果"); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgs, tid, ids]);
  useEffect(() => { setOpts((o) => ({ ...o, pcrops: [null, null, null, null] })); }, [ids]);
  const sState = soloAI[soloKey], pState = puzAI[ids];
  const aiBusy = (tid === "solo" && sState === "pending") || (tid === "puzzle" && pState === "pending");
  const full = useMemo<TemplateOptions>(() => ({
    ...opts,
    soloLines: sState === "pending" ? "pending" : Array.isArray(sState) ? sState : null,
    puzzleAI: pState && typeof pState === "object" ? pState : null,
  }), [opts, sState, pState]);

  const [w, h] = t.size(opts);
  useEffect(() => {
    const c = canvas.current;
    if (!c || !imgs || !ok) return;
    const raf = requestAnimationFrame(() => {
      c.width = w;
      c.height = h;
      t.draw(c.getContext("2d")!, w, h, imgs.slice(0, takeCount(t, imgs.length)), full);
    });
    return () => cancelAnimationFrame(raf);
  }, [imgs, full, t, ok, w, h]);

  const set = <K extends keyof TemplateOptions>(k: K, v: TemplateOptions[K]) => setOpts((o) => ({ ...o, [k]: v }));
  const pick = (id: TemplateId) => {
    const next = getTemplate(id);
    const why = blockReason(next, cats);
    if (why) return showHint(`${next.name}：${why}`);
    if (next.pro) showHint("Pro 功能 · 试用中", "pro");
    setTid(id);
  };

  // 半格：左右拖动；拼图：拖动每张照片调整取景
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const k = r.width / w;
    if (t.id === "halfframe") {
      const side = e.clientX - r.left < r.width / 2 ? 0 : 1;
      drag.current = { x: e.clientX, y: e.clientY, side, start: [opts.crops[side], 0.5], rw: r.width / 2, rh: r.height };
    } else if (t.id === "puzzle" && imgs) {
      const px = (e.clientX - r.left) / k, py = (e.clientY - r.top) / k;
      const rects = puzzleRects(w, h, Math.min(imgs.length, 4));
      const i = rects.findIndex((q) => px >= q.x && px <= q.x + q.w && py >= q.y && py <= q.y + q.h);
      if (i < 0) return;
      drag.current = { x: e.clientX, y: e.clientY, side: i, start: puzzleCrop(full, i), rw: rects[i]!.w * k, rh: rects[i]!.h * k };
    } else return;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d) return;
    const c01 = (v: number) => Math.max(0, Math.min(1, v));
    if (t.id === "halfframe") {
      const v = c01(d.start[0] - ((e.clientX - d.x) / d.rw) * 1.4);
      setOpts((o) => { const crops = [...o.crops] as [number, number]; crops[d.side] = v; return { ...o, crops }; });
    } else {
      const v: [number, number] = [c01(d.start[0] - ((e.clientX - d.x) / d.rw) * 1.6), c01(d.start[1] - ((e.clientY - d.y) / d.rh) * 1.6)];
      setOpts((o) => { const pcrops = [...o.pcrops]; pcrops[d.side] = v; return { ...o, pcrops }; });
    }
  };
  const onUp = () => { drag.current = null; };

  async function save() {
    setSaving(true);
    try {
      const n = takeCount(t, items.length);
      const srcs = await Promise.all(items.slice(0, n).map(exportSource));
      const s = EXPORT_LONG / Math.max(w, h);
      const out = document.createElement("canvas");
      out.width = Math.round(w * s);
      out.height = Math.round(h * s);
      t.draw(out.getContext("2d")!, out.width, out.height, srcs, full);
      const r = await saveCanvas(out, `dazzlab-${t.id}-${Date.now()}.jpg`);
      if (r === "downloaded") showHint("已保存");
    } catch {
      showHint("保存失败，再试一次");
    } finally {
      setSaving(false);
    }
  }

  const n = takeCount(t, items.length);
  const auto = imgs && t.id === "puzzle" ? puzzleSticker(imgs, { ...full, sticker: null, stickerColor: null }) : null;
  const chip = (on: boolean) => cn("rounded-full border px-3 py-1 text-[12px]", on ? "border-foreground bg-foreground text-background" : "border-border");

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
          <nav aria-label="模板" className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pt-1.5 pb-1 [scrollbar-width:none]">
            {TEMPLATES.map((x) => {
              const able = usable(x, cats);
              return (
                <button key={x.id} type="button" onClick={() => pick(x.id)} aria-pressed={x.id === tid}
                  className={cn("relative shrink-0 rounded-2xl border px-3 py-2 text-left transition-colors",
                    x.id === tid ? "border-foreground bg-foreground text-background" : "border-border bg-card",
                    !able && "opacity-40")}>
                  <span className="block font-serif text-[13px] font-bold">{x.name}</span>
                  <span className="block font-mono text-[9px] opacity-60">{x.instantOnly ? "仅拍立得" : `${x.min === x.max ? x.min : `${x.min}–${x.max}`}张`}</span>
                  <span className="absolute -top-1.5 -right-1 flex gap-0.5">
                    {(x.id === rec || x.ai) && <AiMark className="size-3.5" label={x.id === rec ? "AI 推荐" : "AI 配色"} />}
                    {x.pro && <ProMark className="size-3.5" />}
                  </span>
                </button>
              );
            })}
          </nav>

          <section className="mt-3">
            {ok ? (
              <div className="relative mx-auto overflow-hidden bg-muted shadow-sm" style={{ aspectRatio: `${w} / ${h}`, maxHeight: "60dvh" }}>
                <canvas ref={canvas} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
                  className={cn("size-full", t.id === "halfframe" && "touch-none cursor-ew-resize", t.id === "puzzle" && "touch-none cursor-grab")} aria-label={`${t.name}预览`} />
                {!imgs && <Loader2 className="absolute inset-0 m-auto size-6 animate-spin text-muted-foreground" />}
                {imgs && aiBusy && (
                  <span className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 font-mono text-[10px] backdrop-blur-sm">
                    <AiMark className="size-3" />{t.id === "solo" ? "AI 看图配线中" : "AI 看图配贴纸中"}<Loader2 className="size-3 animate-spin" />
                  </span>
                )}
              </div>
            ) : (
              <div className="grid aspect-[3/4] place-items-center rounded-xl bg-muted px-8 text-center text-[13px] text-muted-foreground">
                {t.name}{blockReason(t, cats)}，换一个模板试试
              </div>
            )}
            <div className="mt-2 flex items-center justify-between">
              <p className="font-mono text-[10px] text-muted-foreground">
                {t.id === "halfframe" ? "左右拖动照片调整裁切 · 竖拍效果更好" : t.id === "puzzle" ? "拖动每张照片调整取景" : n < items.length ? `只用前 ${n} 张` : t.en}
                {t.id === rec && " · AI 推荐"}
              </p>
              {items.some((i) => i.photo.origin === "album") && <ApproxTag />}
            </div>
          </section>

          <section className="mt-3 space-y-3 rounded-2xl bg-card p-3">
            {t.id === "solo" && (
              <Field label="手绘线条">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[12px] text-muted-foreground"><AiMark className="size-3.5" />AI 看照片内容配线</span>
                  <button type="button" onClick={() => set("seed", opts.seed + 1)} disabled={aiBusy} className={cn(chip(false), "ml-auto flex items-center gap-1 disabled:opacity-50")}><Shuffle className="size-3" />换一组</button>
                </div>
              </Field>
            )}
            {t.id === "halfframe" && (
              <div className="flex gap-2">
                <button type="button" onClick={() => set("swap", !opts.swap)} className={chip(false)}>左右互换</button>
                <button type="button" onClick={() => set("crops", [0.5, 0.5])} className={chip(false)}>裁切居中</button>
              </div>
            )}
            {t.id === "polaroid" && (
              <>
                <Field label="相纸尺寸">
                  <div className="flex gap-2">{FORMATS.map((f) => <button key={f.id} type="button" onClick={() => set("format", f.id)} className={chip(opts.format === f.id)}>{f.label}</button>)}</div>
                </Field>
                <Field label="边框">
                  <div className="flex gap-2">{["白边", "黑边"].map((l, i) => <button key={l} type="button" onClick={() => set("frame", i)} className={chip(opts.frame === i)}>{l}</button>)}</div>
                </Field>
                <Field label="日期印章">
                  <div className="flex items-center gap-2">
                    <input type="date" value={opts.date} onChange={(e) => e.target.value && set("date", e.target.value)} className="bg-transparent font-mono text-[13px] outline-none" />
                    <button type="button" onClick={() => set("date", defaultOptions().date)} className="ml-auto rounded-full border border-border px-2 py-0.5 text-[11px]">今天</button>
                  </div>
                </Field>
                <Field label="地点 · 打字机字">
                  <input value={opts.caption} onChange={(e) => set("caption", e.target.value)} maxLength={40}
                    className="w-full bg-transparent text-[15px] outline-none [font-family:'Special_Elite',serif]" placeholder="照片里没有地点信息，手动写一个" />
                </Field>
              </>
            )}
            {t.id === "puzzle" && (
              <>
                <Field label="贴纸（每张只用一种）">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => set("sticker", null)} className={cn(chip(opts.sticker === null), "flex items-center gap-1")}><AiMark className="size-3" />自动{auto ? ` · ${FAMILIES.find((f) => f.id === auto.family)?.label}` : ""}</button>
                    {FAMILIES.map((f) => <button key={f.id} type="button" onClick={() => set("sticker", f.id)} className={chip(opts.sticker === f.id)}>{f.label}</button>)}
                  </div>
                </Field>
                <Field label="颜色">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => set("stickerColor", null)} className={cn(chip(opts.stickerColor === null), "flex items-center gap-1")}>
                      <AiMark className="size-3" />看图配色{auto && <span className="size-3 rounded-full border border-border" style={{ background: auto.color }} />}
                    </button>
                    {COLORS.map((c) => <button key={c} type="button" aria-label={c} onClick={() => set("stickerColor", c)}
                      className={cn("size-6 rounded-full border-2", opts.stickerColor === c ? "border-foreground" : "border-transparent")} style={{ background: c }} />)}
                  </div>
                </Field>
                <div className="flex gap-2"><button type="button" onClick={() => set("seed", opts.seed + 1)} className={cn(chip(false), "flex items-center gap-1")}><Shuffle className="size-3" />重新散布</button>
                <button type="button" onClick={() => set("pcrops", [null, null, null, null])} className={chip(false)}>取景复位</button></div>
              </>
            )}
          </section>

          <button type="button" onClick={save} disabled={saving || !imgs || !ok}
            className="mt-4 flex items-center justify-center gap-2 rounded-full bg-primary py-3 font-medium text-primary-foreground disabled:opacity-60">
            {saving && <Loader2 className="size-4 animate-spin" />}保存到相册
          </button>
          <Link to="/album" className="mt-2 text-center text-[12px] text-muted-foreground underline-offset-2 hover:underline">回相册再做一张</Link>
          <p className="mt-2 text-center font-mono text-[10px] text-muted-foreground">用原图重新渲染 · JPG · 只在本机处理</p>
        </>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block border-b border-hairline pb-2 last:border-0">
      <span className="mb-1 block font-mono text-[10px] tracking-wider text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
