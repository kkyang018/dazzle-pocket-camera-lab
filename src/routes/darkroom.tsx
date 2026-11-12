import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Download, Inbox, SplitSquareHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AiMark, ApproxTag, PRO_HINT, ProMark } from "@/components/app/marks";
import { ExposureDial, Ruler } from "@/components/darkroom/controls";
import { usePhotoBase } from "@/hooks/use-photo-base";
import { useApp } from "@/lib/app-state";
import { getCamera, type PhotoStats, type Preset } from "@/lib/cameras";
import { EXPORT_EDGE, loadImage, renderWithPreset, scaleToCanvas } from "@/lib/render";
import { saveCanvas } from "@/lib/templates/sources";
import { cn } from "@/lib/utils";
import { playEject } from "@/lib/sound";

type Adjust = { ev: number; temp: number; tint: number };
const LOOKS: { id: string; label: string; v: Adjust }[] = [
  { id: "soft", label: "柔和", v: { ev: 0.3, temp: 0.15, tint: 0.1 } },
  { id: "classic", label: "经典", v: { ev: 0, temp: 0, tint: 0 } },
  { id: "strong", label: "强烈", v: { ev: -0.3, temp: 0.4, tint: -0.15 } },
];
/** AI 建议：根据亮度/冷暖/绿色/反差给出调整和一句理由 */
function aiSuggest(st: PhotoStats) {
  const c = (v: number, a: number) => Math.max(-a, Math.min(a, v));
  const ev = +c((0.48 - st.lum) * 1.6, 1).toFixed(1);
  const temp = +c((0.55 - st.warmth) * 1.2, 0.6).toFixed(2);
  const tint = +c((st.green - 0.35) * 0.6, 0.3).toFixed(2);
  const why: string[] = [];
  if (ev > 0.1) why.push(`画面偏暗 +${ev}EV`); else if (ev < -0.1) why.push(`高光偏亮 ${ev}EV`);
  if (temp > 0.08) why.push("偏冷，加一点暖"); else if (temp < -0.08) why.push("偏暖，收一点黄");
  if (tint > 0.05) why.push("绿色多，压洋红");
  const grain = st.contrast < 0.45 ? 0.35 : 0.15;
  if (st.contrast < 0.45) why.push("反差弱，加颗粒增加质感");
  return { v: { ev, temp, tint }, grain, why: why.length ? why.join(" · ") : "曝光和色彩都合适，只加一点质感" };
}

type Phase = "idle" | "developing" | "done";
const DEV_MS = { film: 2700, ccd: 1700, instant: 3300 } as const;

export const Route = createFileRoute("/darkroom")({
  head: () => ({
    meta: [
      { title: "暗房工作台 · Dazz Lab" },
      { name: "description", content: "在暗房里调曝光、色温和 AI 建议，然后显影你的照片。" },
      { property: "og:title", content: "暗房工作台 · Dazz Lab" },
      { property: "og:description", content: "在暗房里调曝光、色温和 AI 建议，然后显影你的照片。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DarkroomPage,
});

function DarkroomPage() {
  const { photo, cameraId, quietMode, setLook, showHint, addToAlbum, setSelection } = useApp();
  const navigate = useNavigate();
  const camera = getCamera(cameraId);
  const base = usePhotoBase(photo);
  const [adj, setAdj] = useState<Adjust>({ ev: 0, temp: 0, tint: 0 });
  const [look, setLookId] = useState<string | null>(null);
  const [pro, setPro] = useState({ grain: 0, fade: 0, sharpen: 0 });
  const [crop, setCrop] = useState({ x: 0.5, y: 0.5 });
  const [panel, setPanel] = useState<"basic" | "pro">("basic");
  const [original, setOriginal] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [devKey, setDevKey] = useState(0);
  const [stage, setStage] = useState<"store" | "play">("store");
  const [drag, setDrag] = useState<{ dx: number; dy: number; mode: "drag" | "fly" | "back" } | null>(null);
  const paperRef = useRef<HTMLElement>(null);
  const [overTray, setOverTray] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [dim, setDim] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState<{ src: string; big: boolean } | null>(null);
  const [aiWhy, setAiWhy] = useState<string | null>(null);
  const moved = useRef(false);
  // 相纸区域尺寸变化时重新适配；只在相纸区域出现（有照片和相机）时绑定一次
  const ready = !!photo && !!camera;
  useEffect(() => {
    const el = paperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e!.contentRect.width, h: e!.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready]);
  const dragStart = useRef<{ x: number; y: number; cx: number; cy: number; w: number; h: number; mx: number; my: number } | null>(null);

  const stats = base?.stats;
  const isInstant = camera?.category === "instant";

  const preset = useMemo<Preset | null>(() => {
    if (!camera) return null;
    const p = camera.preset;
    return {
      ...p,
      exposure: p.exposure + adj.ev,
      temperature: p.temperature + adj.temp * 0.8,
      tint: p.tint - adj.tint * 0.6,
      grain: p.grain + pro.grain * 0.25,
      fade: Math.min(0.9, p.fade + pro.fade * 0.5),
      sharpen: pro.sharpen,
      cropX: crop.x,
      cropY: crop.y,
    };
  }, [camera, adj, pro, crop]);

  useEffect(() => {
    if (!base || !preset) return;
    const f = requestAnimationFrame(() => {
      const out = original ? base.canvas : renderWithPreset(base.canvas, preset);
      const c = canvasRef.current;
      if (!c) return;
      c.width = out.width;
      c.height = out.height;
      setDim((d) => (d.w === out.width && d.h === out.height ? d : { w: out.width, h: out.height }));
      c.getContext("2d")!.drawImage(out, 0, 0);
    });
    return () => cancelAnimationFrame(f);
  }, [base, preset, original, devKey]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // 改参数后回到待显影
  const edit = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    if (phase !== "idle") setPhase("idle");
  };

  const finish = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPhase("done");
    setStage("play");
  };
  const develop = () => {
    if (!camera) return;
    setDevKey((k) => k + 1);
        setPhase("developing");
    setStage(camera.category === "ccd" ? "store" : "play");
    const total = quietMode ? 50 : DEV_MS[camera.category];
    if (camera.category === "ccd" && !quietMode) timers.current.push(setTimeout(() => setStage("play"), 900));
    timers.current.push(setTimeout(finish, total));
    if (camera.category === "instant") playEject();
  };
  const goResult = () => {
    setLook(preset);
    if (photo && camera) {
      const id = addToAlbum({ photo, look: preset, cameraName: camera.name, category: camera.category });
      setSelection([id]);
    }
    navigate({ to: "/album" });
  };

  // 轻路径：显影完直接用原图重新渲染并保存到手机
  const [savingNow, setSavingNow] = useState(false);
  const saveNow = async () => {
    if (!photo || !preset) return;
    setSavingNow(true);
    try {
      const img = await loadImage(photo.src);
      const out = renderWithPreset(scaleToCanvas(img, EXPORT_EDGE), preset);
      if ((await saveCanvas(out, `dazzlab-${Date.now()}.jpg`)) === "downloaded") showHint("已保存");
    } catch {
      showHint("保存失败，再试一次");
    } finally {
      setSavingNow(false);
    }
  };
  const onPaperDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (phase === "developing") return;
    moved.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect();
    dragStart.current = { x: e.clientX, y: e.clientY, cx: crop.x, cy: crop.y, w: r.width, h: r.height, mx: r.left + r.width / 2, my: r.top + r.height / 2 };
  };
  const onPaperMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = dragStart.current;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) moved.current = true;
    if (!moved.current) return;
    if (phase === "idle" && !isInstant) return;
    if (phase === "done") {
      setDrag({ dx, dy, mode: "drag" });
      const t = trayRef.current?.getBoundingClientRect();
      setOverTray(!!t && e.clientX > t.left - 20 && e.clientX < t.right + 20 && e.clientY > t.top - 20 && e.clientY < t.bottom + 20);
    } else {
      const c = (v: number) => Math.min(1, Math.max(0, v));
      setCrop({ x: c(s.cx - (dx / s.w) * 1.6), y: c(s.cy - (dy / s.h) * 1.6) });
    }
  };
  const onPaperUp = () => {
    const s = dragStart.current;
    dragStart.current = null;
    if (s && !moved.current && canvasRef.current) {
      setDrag(null);
      setZoom({ src: canvasRef.current.toDataURL("image/jpeg", 0.92), big: false });
      return;
    }
    if (phase !== "done" || !drag || !s) return;
    if (overTray && trayRef.current) {
      const t = trayRef.current.getBoundingClientRect();
      setDrag({ dx: t.left + t.width / 2 - s.mx, dy: t.top + t.height / 2 - s.my, mode: "fly" });
      timers.current.push(setTimeout(goResult, quietMode ? 0 : 380));
    } else {
      setDrag({ dx: 0, dy: 0, mode: "back" });
      timers.current.push(setTimeout(() => setDrag(null), 320));
    }
    setOverTray(false);
  };

  const dragStyle: React.CSSProperties | undefined = !drag
    ? undefined
    : drag.mode === "drag"
      ? { transform: `translate3d(${drag.dx}px,${drag.dy}px,0) rotate(${Math.max(-8, Math.min(8, drag.dx / 25))}deg) scale(${overTray ? 0.55 : 0.9})`, transition: "none", willChange: "transform", boxShadow: "0 30px 50px -18px rgb(0 0 0 / 0.7)" }
      : drag.mode === "fly"
        ? { transform: `translate3d(${drag.dx}px,${drag.dy}px,0) scale(0.12) rotate(-6deg)`, opacity: 0.2, transition: "transform 360ms cubic-bezier(.5,0,.75,0), opacity 360ms" }
        : { transform: "none", transition: "transform 300ms cubic-bezier(.2,1.4,.4,1)" };

  if (!photo || !camera || !preset) {
    return (
      <main className="theme-darkroom flex min-h-[calc(100dvh-5rem)] flex-col items-center justify-center px-5 text-center">
        <p className="font-serif text-lg">还没选好照片和相机</p>
        <Link to="/" className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
          回到 Lab
        </Link>
      </main>
    );
  }

  const cat = camera.category;
  const developing = phase === "developing";
  const animClass = developing
    ? cat === "film"
      ? "anim-dev-film"
      : cat === "ccd"
        ? stage === "play" ? "anim-dev-pop" : "opacity-0"
        : "anim-dev-emerge"
    : "";

  const status = phase === "done" ? "已显影" : developing ? "显影中" : "待显影";
  const slotH = isInstant ? 14 : 0;
  const pad = 0;
  const fit = dim.w && box.w ? Math.min((box.w - pad) / dim.w, (box.h - pad - slotH - 4) / dim.h) : 0;
  const cssSize = fit > 0 ? { width: Math.floor(dim.w * fit), height: Math.floor(dim.h * fit) } : undefined;

  const label = phase === "done" ? "重新显影" : developing ? "显影中…" : "显影";
  const led = <span className={cn("size-1.5 shrink-0 rounded-full", developing ? "lamp-on bg-destructive" : phase === "done" ? "bg-muted-foreground/40" : "bg-primary shadow-[0_0_6px_1px_var(--primary)]")} />;
  const devButton = (
      <div className="flex-1 rounded-2xl bg-background p-1 shadow-[inset_0_2px_4px_rgb(0_0_0/0.8),0_1px_0_var(--hairline)]">
        <button type="button" onClick={develop} disabled={developing} aria-label={label}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-hairline bg-gradient-to-b from-surface-raised to-surface font-serif text-[15px] tracking-[0.3em] text-primary shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_2px_3px_rgb(0_0_0/0.6)] transition-transform active:translate-y-[1.5px] active:shadow-[inset_0_2px_4px_rgb(0_0_0/0.6)] disabled:opacity-70">
          {led}<span className="glow-text">{label}</span>
        </button>
      </div>
    );
  const tip = developing ? "点一下照片跳过" : phase === "done" ? "已收进印样台 · 可直接保存，或去印样台做成品" : isInstant ? "拖动照片调整裁剪 · 点照片看细节" : "点照片看细节 · 调好后按显影";
  const devRow = (
    <div className="relative z-10 flex shrink-0 items-center gap-2 py-2">
      {devButton}
      {phase === "done" && (
        <button type="button" onClick={saveNow} disabled={savingNow} aria-label="保存到手机"
          className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl border border-hairline bg-background/40 text-foreground disabled:opacity-60">
          <Download className="size-4" />
          <span className="text-[8px]">保存</span>
        </button>
      )}
      <div ref={trayRef} onClick={phase === "done" ? goResult : () => showHint("先显影，照片会收进印样台")} role="button" aria-label="印样台"
        className={cn("flex size-11 shrink-0 flex-col items-center justify-center rounded-xl border transition-all",
          overTray ? "scale-125 border-primary bg-primary/15 text-primary" : phase === "done" ? "anim-tray border-primary/70 bg-primary/10 text-primary" : "border-hairline bg-background/40 text-muted-foreground")}>
        <Inbox className="size-4" />
        <span className="text-[8px]">印样台</span>
      </div>
    </div>
  );

  return (
    <main className="theme-darkroom relative flex h-[calc(100dvh-4.5rem-env(safe-area-inset-bottom))] select-none flex-col overflow-hidden px-5 pt-[max(env(safe-area-inset-top),0.5rem)]">
      {developing && cat === "film" && (
        <div className="anim-safelight pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(70%_50%_at_50%_30%,oklch(0.5_0.2_25/0.45),oklch(0.2_0.1_25/0.7))]" />
      )}
      <header className="relative z-10 flex shrink-0 items-center justify-between">
        <Link to="/cameras" className="-ml-2 flex items-center gap-0.5 rounded-full px-2 py-1 font-mono text-[11px] text-muted-foreground">
          <ChevronLeft className="size-4" />
          换相机
        </Link>
        <h1 className="flex items-center gap-1.5 font-serif text-base font-bold" title={status}>
          <span aria-label={status} className={cn("size-2 rounded-full transition-all duration-700",
            developing ? "lamp-on bg-destructive" : phase === "done" ? "bg-destructive/25" : "bg-destructive/50 shadow-[0_0_6px_1px_var(--destructive)]")} />
          暗房
          <span className="font-mono text-[10px] font-normal text-muted-foreground">{camera.name}</span>
        </h1>
        <span className="w-14" />
      </header>

      {/* 相纸 */}
      <section ref={paperRef} className={cn("relative mt-2 flex min-h-0 flex-1 justify-center", drag ? "z-50" : "z-10", isInstant ? cn("items-start", drag ? "overflow-visible" : "overflow-hidden") : "items-center overflow-visible")} style={isInstant ? { paddingTop: slotH } : undefined} onClick={developing ? finish : undefined}>
        {isInstant && (
          <div aria-hidden className="absolute inset-x-6 top-0 z-30 h-[14px] rounded-b-md bg-gradient-to-b from-background to-surface shadow-[0_6px_10px_-4px_rgb(0_0_0/0.8)]">
            <div className="mx-auto mt-[5px] h-[3px] w-[82%] rounded-full bg-background shadow-[inset_0_1px_2px_rgb(0_0_0/0.9)]" />
          </div>
        )}
        <div
          key={devKey}
          onPointerDown={onPaperDown}
          onPointerMove={onPaperMove}
          onPointerUp={onPaperUp}
          onPointerCancel={onPaperUp}
          style={dragStyle}
          className={cn(
            drag ? "z-40" : "z-10",
            "relative flex touch-none items-center justify-center",
            !isInstant && "shadow-[0_18px_40px_-14px_rgb(0_0_0/0.8)]",
            isInstant && "drop-shadow-[0_16px_24px_rgb(0_0_0/0.6)]",
            developing && cat === "instant" && "anim-dev-eject",
            phase === "done" && "cursor-grab",
            phase === "idle" && isInstant && "cursor-move",
          )}
        >
          <canvas ref={canvasRef} style={cssSize} className={cn("block", animClass)} />
        </div>
        {developing && cat === "ccd" && stage === "store" && (
          <div className="absolute inset-0 z-20 flex items-center justify-center">
            <div className="flex items-center gap-2 rounded-lg bg-foreground px-3 py-2 font-mono text-xs text-background">
              <span className="size-2 animate-[blink_0.5s_steps(1)_infinite] rounded-full bg-destructive" />
              存储中…
            </div>
          </div>
        )}
      </section>
      <div className="relative z-10 mt-1.5 flex shrink-0 items-center gap-2">
        <ApproxTag className="shrink-0" />
        <p className="min-w-0 flex-1 truncate text-center font-mono text-[10px] text-muted-foreground">{tip}</p>
          <button
        type="button"
        onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setOriginal(true); }}
        onPointerUp={() => setOriginal(false)}
        onPointerCancel={() => setOriginal(false)}
        onClick={(e) => e.stopPropagation()}
        aria-pressed={original}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="按住对比原片"
        className={cn("touch-hold flex size-7 shrink-0 items-center justify-center rounded-full border select-none backdrop-blur", original ? "border-foreground bg-foreground text-background" : "border-foreground/30 bg-background/50")}
      >
        <SplitSquareHorizontal className="size-4" />
      </button>
      </div>

      {/* 调节面板：一屏内切换 */}
      <section className="relative z-10 mt-2 shrink-0 rounded-2xl bg-surface p-3">
        <div role="tablist" aria-label="调节" className="mb-2.5 grid grid-cols-2 gap-1 rounded-full bg-background/60 p-0.5 text-xs">
          {([["basic", "基础调节"], ["pro", "暗房模式"]] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={panel === id}
              onClick={() => { setPanel(id); if (id === "pro" && panel !== "pro") showHint(PRO_HINT, "pro"); }}
              className={cn("flex items-center justify-center gap-1 whitespace-nowrap rounded-full py-1.5 text-[11px]", panel === id ? "bg-surface-raised font-medium text-foreground" : "text-muted-foreground")}>
              {label}{id === "pro" && <ProMark inline />}
            </button>
          ))}
        </div>
        {panel === "basic" ? (
          <>
            <div className="flex justify-center gap-1.5">
              <button type="button" disabled={!stats}
                onClick={() => { if (!stats) return; const s2 = aiSuggest(stats); edit(setAdj)(s2.v); setPro((p0) => ({ ...p0, grain: s2.grain })); setLookId("ai"); setAiWhy(s2.why); }}
                className={cn("flex items-center gap-1 rounded-full border px-3 py-1 text-xs", look === "ai" ? "border-ai bg-ai/15 text-ai" : "border-ai/50 text-ai")}>
                <AiMark className="size-3" label="AI 建议" />AI 建议
              </button>
              {LOOKS.map((l) => (
                <button key={l.id} type="button" onClick={() => { edit(setAdj)(l.v); setLookId(l.id); setAiWhy(null); }}
                  className={cn("rounded-full border px-3 py-1 text-xs", look === l.id ? "border-foreground bg-foreground text-background" : "border-foreground/20")}>
                  {l.label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-3">
              <ExposureDial value={adj.ev} onChange={(ev) => { edit(setAdj)({ ...adj, ev }); setLookId(null); }} />
              <div className="min-w-0 flex-1">
                <Ruler label="色温" left="冷" right="暖" value={adj.temp}
                  gradient="linear-gradient(90deg, oklch(0.65 0.12 245), oklch(0.85 0.01 80), oklch(0.72 0.15 60))"
                  onChange={(temp) => { edit(setAdj)({ ...adj, temp }); setLookId(null); }} />
                <Ruler label="色调" left="绿" right="洋红" value={adj.tint}
                  gradient="linear-gradient(90deg, oklch(0.65 0.13 150), oklch(0.85 0.01 80), oklch(0.62 0.18 350))"
                  onChange={(tint) => { edit(setAdj)({ ...adj, tint }); setLookId(null); }} />
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-[118px] flex-col justify-center gap-3">
            {([["grain", "颗粒"], ["fade", "褪色"], ["sharpen", "锐化"]] as const).map(([k, label]) => (
              <label key={k} className="flex items-center gap-3 text-xs">
                <span className="w-9">{label}</span>
                <input type="range" min={0} max={1} step={0.01} value={pro[k]} aria-label={label}
                  onChange={(e) => edit(setPro)({ ...pro, [k]: +e.target.value })}
                  className="flex-1 accent-[var(--primary)]" />
                <span className="w-7 text-right font-mono text-[10px] tabular-nums">{Math.round(pro[k] * 100)}</span>
              </label>
            ))}
          </div>
        )}
      </section>

      {devRow}
      {zoom && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-auto bg-background/95" onClick={() => setZoom(null)}>
          <button type="button" onClick={() => setZoom(null)} aria-label="返回"
            className="fixed top-[max(env(safe-area-inset-top),0.75rem)] left-3 z-10 flex items-center gap-0.5 rounded-full bg-surface/80 px-3 py-1.5 font-mono text-xs backdrop-blur">
            <ChevronLeft className="size-4" />返回
          </button>
          <img src={zoom.src} alt="照片细节" onClick={(e) => { e.stopPropagation(); setZoom({ ...zoom, big: !zoom.big }); }}
            className={cn("transition-transform", zoom.big ? "max-w-none w-[220%]" : "max-h-full max-w-full object-contain")} />
        </div>
      )}
    </main>
  );
}
