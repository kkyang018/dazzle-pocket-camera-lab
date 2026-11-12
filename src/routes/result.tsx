import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { soloPlan } from "@/lib/ai/vision.functions";
import { analyzeScene } from "@/lib/scene";
import { averageColor, cropInner } from "@/lib/solo/draw";
import { localPlan } from "@/lib/solo/plan";
import { faceInfo, personOutline } from "@/lib/solo/segment";
import type { SoloData } from "@/lib/solo/types";
import { MAX_ZOOM, clampCrop, collageRects, coverGeometry, slotCrop, type Crop } from "@/lib/collage";
import { ChevronLeft, Loader2, Shuffle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AiMark, ApproxTag, ProMark } from "@/components/app/marks";
import { useApp } from "@/lib/app-state";
import { loadFonts } from "@/lib/templates/draw";
import {
  TEMPLATES, blockReason, defaultOptions, getTemplate, recommendTemplate, takeCount, usable,
  type PolaroidFormat, type TemplateId, type TemplateOptions,
} from "@/lib/templates";
import { developed, exportSource, saveCanvas } from "@/lib/templates/sources";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/result")({
  head: () => ({
    meta: [
      { title: "成品模板 · Dazz Lab" },
      { name: "description", content: "把相册里的照片做成手绘单张、半格胶片、拍立得或拼图成品。" },
      { property: "og:title", content: "成品模板 · Dazz Lab" },
      { property: "og:description", content: "手绘单张、半格胶片、拍立得、拼图。" },
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
/** 发给 AI 的小图（长边 512） */
function thumb(c: HTMLCanvasElement) {
  const s = Math.min(1, 512 / Math.max(c.width, c.height));
  const t = document.createElement("canvas");
  t.width = Math.round(c.width * s); t.height = Math.round(c.height * s);
  t.getContext("2d")!.drawImage(c, 0, 0, t.width, t.height);
  return t.toDataURL("image/jpeg", 0.8);
}

function ResultPage() {
  const { album, selection, showHint } = useApp();
  const items = useMemo(() => selection.map((id) => album.find((a) => a.id === id)).filter((a) => !!a), [album, selection]);
  const cats = useMemo(() => items.map((i) => i.category), [items]);
  const lead = items[0] ?? null;
  // 推荐的模板用不了（比如混进了拍立得照片）时不标"AI 推荐"，默认打开第一个能用的
  const recRaw = recommendTemplate(items.length, lead?.category ?? null);
  const recOk = usable(getTemplate(recRaw), cats);
  const rec: TemplateId | null = recOk ? recRaw : null;
  const [tid, setTid] = useState<TemplateId>(() => rec ?? TEMPLATES.find((x) => usable(x, cats))?.id ?? recRaw);
  const [opts, setOpts] = useState<TemplateOptions>(() => defaultOptions(lead?.place ?? null));
  // 拍立得：相纸尺寸和边框跟随拍摄的相机，成品台只盖日期和地点两个章
  const paper = lead?.look?.frame;
  useEffect(() => {
    if (!paper) return;
    const dark = (() => { const m = /^#?(\w\w)(\w\w)(\w\w)/.exec(paper.color); return m ? parseInt(m[1]!, 16) + parseInt(m[2]!, 16) + parseInt(m[3]!, 16) < 300 : false; })();
    setOpts((o) => ({ ...o, format: paper.kind, frame: dark ? 1 : 0 }));
  }, [paper?.kind, paper?.color]);
  useEffect(() => { if (lead?.place) setOpts((o) => (o.caption ? o : { ...o, caption: lead.place! })); }, [lead?.place]);
  const [imgState, setImgs] = useState<{ key: string; list: HTMLCanvasElement[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; side: number; start: [number, number]; rw: number; rh: number } | null>(null);
  // 手绘单张：每组照片一份（人物描边 + 计划）；先出本地版，AI 回来后替换
  const [solo, setSolo] = useState<Record<string, SoloData>>({});
  const [soloBusy, setSoloBusy] = useState<Record<string, boolean>>({});
  // 拼图：每组照片的主体位置（人脸），用于初始取景
  const [focus, setFocus] = useState<Record<string, ({ center: [number, number]; area: number } | null)[]>>({});
  const [selSlot, setSelSlot] = useState<number | null>(null);
  const callSolo = useServerFn(soloPlan);
  const t = getTemplate(tid);
  const ok = usable(t, cats);
  const ids = items.map((i) => i.id).join(",");
  // 拍立得照片做手绘单张：保留整张相纸（其他模板自己画相纸/版式，用去掉相纸的照片）
  const soloFrame = tid === "solo" && lead?.category === "instant" ? (lead.look?.frame?.kind ?? null) : null;
  // 拍立得模板也直接用整张相纸，只在上面盖章
  const bare = !soloFrame && tid !== "polaroid";
  const imgKey = `${ids}|${bare}`;
  // 只用和当前设置匹配的那批图（切换模板时旧图可能还在）
  const imgs = imgState?.key === imgKey ? imgState.list : null;

  useEffect(() => {
    let alive = true;
    setImgs(null);
    Promise.all([loadFonts(), ...items.map((i) => developed(i, undefined, bare))]).then(([, ...c]) => alive && setImgs({ key: imgKey, list: c as HTMLCanvasElement[] }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgKey]);

  // 手绘单张：本机找人物轮廓 → 先用本地规则出一版 → AI 看图给主题/配色/图案后替换。
  // 结果按照片组缓存；"换一组"只重新排版，不再调 AI。
  useEffect(() => {
    const raw = imgs?.[0];
    if (!raw || tid !== "solo" || solo[ids] || soloBusy[ids]) return;
    // 拍立得只看相纸里的照片部分
    const img = cropInner(raw, soloFrame);
    let alive = true;
    setSoloBusy((m) => ({ ...m, [ids]: true }));
    void (async () => {
      const outline = await personOutline(img);
      const plan = localPlan(analyzeScene(img).stats, !!outline, averageColor(img));
      if (!alive) return;
      setSolo((m) => ({ ...m, [ids]: { plan, outline } }));
      try {
        const r = await callSolo({ data: { image: thumb(img), person: outline?.box ?? null } });
        if (!alive) return;
        if (r.ok) setSolo((m) => ({ ...m, [ids]: { plan: r.data, outline } }));
        else showHint(r.error);
      } catch {
        if (alive) showHint("AI 看图失败，先用本地效果");
      } finally {
        if (alive) setSoloBusy((m) => ({ ...m, [ids]: false }));
      }
    })();
    return () => { alive = false; setSoloBusy((m) => ({ ...m, [ids]: false })); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgs, tid, ids]);
  // 拼图：本机找每张照片的人脸，用于初始取景
  useEffect(() => {
    if (!imgs || tid !== "collage" || focus[ids]) return;
    let alive = true;
    void Promise.all(imgs.map((im) => faceInfo(im))).then((f) => alive && setFocus((m) => ({ ...m, [ids]: f })));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgs, tid, ids]);
  useEffect(() => { setOpts((o) => ({ ...o, ccrops: [null, null, null, null] })); setSelSlot(null); }, [ids]);
  const sState = solo[ids];
  const aiBusy = tid === "solo" && !!soloBusy[ids];
  const full = useMemo<TemplateOptions>(() => ({
    ...opts,
    solo: sState ?? null,
    soloFrame,
    cfocus: focus[ids]?.map((f) => f?.center ?? null) ?? [null, null, null, null],
    // 还没识别完时是 []，先按颜色挑背景；识别完再按"有没有人、人多大"重新挑
    cpeople: focus[ids]?.map((f) => f?.area ?? null) ?? [],
  }), [opts, sState, soloFrame, focus, ids]);
  const fullRef = useRef(full);
  fullRef.current = full;

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

  // ── 拼图取景：在槽位里拖动平移，双指 / 滚轮 / 滑杆缩放 ──
  const n = takeCount(t, items.length);
  const rects = useMemo(() => (t.id === "collage" ? collageRects(w, h, n) : []), [t.id, w, h, n]);
  const cropOf = (i: number): Crop | null => {
    const im = imgs?.[i], r = rects[i];
    const f = fullRef.current;
    return im && r ? slotCrop({ crops: f.ccrops, focus: f.cfocus, background: null }, im, r, i) : null;
  };
  const setCrop = (i: number, c: Crop) => setOpts((o) => { const ccrops = [...o.ccrops]; ccrops[i] = clampCrop(c); return { ...o, ccrops }; });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ slot: number; start: Crop; x: number; y: number; dist: number } | null>(null);
  const slotAt = (e: { clientX: number; clientY: number }, el: HTMLCanvasElement) => {
    const r = el.getBoundingClientRect(), k = r.width / w;
    const px = (e.clientX - r.left) / k, py = (e.clientY - r.top) / k;
    const i = rects.findIndex((q) => px >= q.x && px <= q.x + q.w && py >= q.y && py <= q.y + q.h);
    return i;
  };
  const restartGesture = () => {
    const g = gesture.current, pts = [...pointers.current.values()];
    if (!g || !pts.length) { gesture.current = null; return; }
    const start = cropOf(g.slot) ?? g.start;
    gesture.current = pts.length >= 2
      ? { slot: g.slot, start, x: 0, y: 0, dist: Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y) }
      : { slot: g.slot, start, x: pts[0]!.x, y: pts[0]!.y, dist: 0 };
  };

  // 半格：左右拖动；拼图：见上
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (t.id === "halfframe") {
      const side = e.clientX - r.left < r.width / 2 ? 0 : 1;
      drag.current = { x: e.clientX, y: e.clientY, side, start: [opts.crops[side], 0.5], rw: r.width / 2, rh: r.height };
    } else if (t.id === "collage" && imgs) {
      if (!gesture.current) {
        const i = slotAt(e, e.currentTarget);
        if (i < 0) return;
        setSelSlot(i);
        gesture.current = { slot: i, start: cropOf(i)!, x: e.clientX, y: e.clientY, dist: 0 };
      }
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      restartGesture();
    } else return;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (t.id === "collage") {
      const g = gesture.current;
      if (!g || !pointers.current.has(e.pointerId) || !imgs) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pts = [...pointers.current.values()];
      if (pts.length >= 2 && g.dist > 0) {
        const d = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
        setCrop(g.slot, { ...g.start, zoom: (g.start.zoom * d) / g.dist });
      } else {
        const k = e.currentTarget.getBoundingClientRect().width / w;
        const geo = coverGeometry(imgs[g.slot]!, rects[g.slot]!, g.start);
        const dx = (e.clientX - g.x) / k, dy = (e.clientY - g.y) / k;
        setCrop(g.slot, { ...g.start, cx: geo.ex > 0 ? g.start.cx - dx / geo.ex : 0.5, cy: geo.ey > 0 ? g.start.cy - dy / geo.ey : 0.5 });
      }
      return;
    }
    const d = drag.current;
    if (!d) return;
    const c01 = (v: number) => Math.max(0, Math.min(1, v));
    const v = c01(d.start[0] - ((e.clientX - d.x) / d.rw) * 1.4);
    setOpts((o) => { const crops = [...o.crops] as [number, number]; crops[d.side] = v; return { ...o, crops }; });
  };
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drag.current = null;
    if (t.id === "collage") { pointers.current.delete(e.pointerId); restartGesture(); }
  };
  // 滚轮缩放（需要非被动监听才能阻止页面滚动）
  useEffect(() => {
    const c = canvas.current;
    if (!c || t.id !== "collage") return;
    const onWheel = (e: WheelEvent) => {
      const i = slotAt(e, c);
      if (i < 0) return;
      e.preventDefault();
      setSelSlot(i);
      const cur = cropOf(i);
      if (cur) setCrop(i, { ...cur, zoom: cur.zoom * Math.exp(-e.deltaY * 0.0015) });
    };
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => c.removeEventListener("wheel", onWheel);
  });

  async function save() {
    setSaving(true);
    try {
      // 拼图每格最大约 1620px 宽，原图用长边 2400 就够清晰，省一半以上内存（手机导出更稳）
      const edge = t.id === "collage" ? 2400 : undefined;
      const srcs = await Promise.all(items.slice(0, n).map((i) => exportSource(i, bare, edge)));
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

  const selCrop = t.id === "collage" && selSlot != null && selSlot < n ? cropOf(selSlot) : null;
  const chip = (on: boolean) => cn("rounded-full border px-3 py-1 text-[12px]", on ? "border-foreground bg-foreground text-background" : "border-border");

  return (
    <main className="theme-paper flex min-h-[calc(100dvh-4rem)] flex-col px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-6">
      <header className="flex items-center justify-between">
        <Link to="/album" className="-ml-2 flex items-center gap-0.5 px-2 py-1 font-mono text-[11px] text-muted-foreground">
          <ChevronLeft className="size-4" /> 印样台
        </Link>
        <h1 className="font-serif text-lg font-bold">成品</h1>
        <span className="w-12 text-right font-mono text-[10px] text-muted-foreground">{items.length} 张</span>
      </header>

      {!items.length ? (
        <div className="mt-24 text-center">
          <p className="font-serif">还没有选照片</p>
          <Link to="/album" className="mt-4 inline-block rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground">去印样台选片</Link>
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
                    {x.pro && <ProMark inline className="size-3.5" />}
                  </span>
                </button>
              );
            })}
          </nav>

          <section className="mt-3">
            {ok ? (
              <div className="relative mx-auto overflow-hidden bg-muted shadow-sm" style={{ aspectRatio: `${w} / ${h}`, maxHeight: "60dvh" }}>
                <canvas ref={canvas} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
                  className={cn("size-full", t.id === "halfframe" && "touch-none cursor-ew-resize", t.id === "collage" && "touch-none cursor-grab")} aria-label={`${t.name}预览`} />
                {!imgs && <Loader2 className="absolute inset-0 m-auto size-6 animate-spin text-muted-foreground" />}
                {imgs && aiBusy && (
                  <span className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 font-mono text-[10px] backdrop-blur-sm">
                    <AiMark className="size-3" />AI 看图选图案中<Loader2 className="size-3 animate-spin" />
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
                {t.id === "halfframe" ? "左右拖动照片调整裁切 · 竖拍效果更好" : t.id === "collage" ? "拖动照片调整取景 · 双指或滚轮缩放" : t.en}
                {t.id === rec && " · AI 推荐"}
              </p>
              {items.some((i) => i.photo.origin === "album") && <ApproxTag />}
            </div>
          </section>

          <section className="mt-3 space-y-3 rounded-2xl bg-card p-3">
            {t.id === "solo" && (
              <Field label="手绘线条">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                    <AiMark className="size-3.5" />
                    {sState?.plan.source === "ai" ? "AI 看图选的图案和配色" : aiBusy ? "AI 正在看图…" : "本地配色（AI 未连上）"}
                  </span>
                  <button type="button" onClick={() => set("seed", opts.seed + 1)} disabled={!sState} className={cn(chip(false), "ml-auto flex items-center gap-1 disabled:opacity-50")}><Shuffle className="size-3" />换一组</button>
                </div>
              </Field>
            )}
            {t.id === "solo" && (
              <Field label={soloFrame ? "背景 · 拍立得相纸放在纸上" : "背景"}>
                <div className="flex gap-2">
                  <button type="button" aria-pressed={!opts.soloDark} onClick={() => set("soloDark", false)} className={chip(!opts.soloDark)}>浅色</button>
                  <button type="button" aria-pressed={opts.soloDark} onClick={() => set("soloDark", true)} className={chip(opts.soloDark)}>深色</button>
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
                <p className="font-mono text-[10px] text-muted-foreground">{FORMATS.find((f) => f.id === opts.format)?.label} 相纸 · {opts.frame ? "黑边" : "白边"} · 跟随拍摄的相机</p>
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
            {t.id === "collage" && (
              <>
                <Field label={selCrop ? `第 ${selSlot! + 1} 张 · 缩放` : "取景"}>
                  {selCrop ? (
                    <div className="flex items-center gap-3">
                      <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={selCrop.zoom} aria-label="缩放"
                        onChange={(e) => setCrop(selSlot!, { ...selCrop, zoom: +e.target.value })} className="flex-1 accent-[var(--primary)]" />
                      <span className="w-10 text-right font-mono text-[11px] tabular-nums">{selCrop.zoom.toFixed(1)}×</span>
                    </div>
                  ) : (
                    <p className="text-[12px] text-muted-foreground">点一张照片后可以拖动、缩放取景</p>
                  )}
                </Field>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { set("ccrops", [null, null, null, null]); setSelSlot(null); }} className={chip(false)}>取景复位</button>
                </div>
              </>
            )}
          </section>

          <button type="button" onClick={save} disabled={saving || !imgs || !ok}
            className="mt-4 flex items-center justify-center gap-2 rounded-full bg-primary py-3 font-medium text-primary-foreground disabled:opacity-60">
            {saving && <Loader2 className="size-4 animate-spin" />}保存到相册
          </button>
          <Link to="/album" className="mt-2 text-center text-[12px] text-muted-foreground underline-offset-2 hover:underline">回印样台再做一张</Link>        </>
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
