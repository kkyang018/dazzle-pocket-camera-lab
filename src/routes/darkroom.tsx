import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, ChevronLeft, Inbox, Zap, ZapOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AiMark, ApproxTag, ProMark } from "@/components/app/marks";
import { ExposureDial, Ruler } from "@/components/darkroom/controls";
import { usePhotoBase } from "@/hooks/use-photo-base";
import { useApp } from "@/lib/app-state";
import { flashStrength, getCamera, type FlashMode, type Preset } from "@/lib/cameras";
import { renderWithPreset } from "@/lib/render";
import { cn } from "@/lib/utils";

const FLASH_OPTIONS: { id: FlashMode; label: string }[] = [
  { id: "off", label: "关" },
  { id: "auto", label: "自动" },
  { id: "on", label: "开" },
];

type Adjust = { ev: number; temp: number; tint: number };
const LOOKS: { id: string; label: string; v: Adjust }[] = [
  { id: "soft", label: "柔和", v: { ev: 0.3, temp: 0.15, tint: 0.1 } },
  { id: "classic", label: "经典", v: { ev: 0, temp: 0, tint: 0 } },
  { id: "strong", label: "强烈", v: { ev: -0.3, temp: 0.4, tint: -0.15 } },
];
type Phase = "idle" | "developing" | "done";
const DEV_MS = { film: 1700, ccd: 1500, instant: 1900 } as const;

export const Route = createFileRoute("/darkroom")({
  head: () => ({
    meta: [
      { title: "暗房工作台 · Dazz Lab" },
      { name: "description", content: "在暗房里调曝光、色温和闪光灯，然后显影你的照片。" },
      { property: "og:title", content: "暗房工作台 · Dazz Lab" },
      { property: "og:description", content: "在暗房里调曝光、色温和闪光灯，然后显影你的照片。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DarkroomPage,
});

function DarkroomPage() {
  const { photo, cameraId, quietMode, setLook, showHint } = useApp();
  const navigate = useNavigate();
  const camera = getCamera(cameraId);
  const base = usePhotoBase(photo);
  const [flash, setFlash] = useState<FlashMode>("auto");
  const [adj, setAdj] = useState<Adjust>({ ev: 0, temp: 0, tint: 0 });
  const [look, setLookId] = useState<string | null>(null);
  const [pro, setPro] = useState({ grain: 0, fade: 0, sharpen: 0 });
  const [crop, setCrop] = useState({ x: 0.5, y: 0.5 });
  const [proOpen, setProOpen] = useState(false);
  const [original, setOriginal] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [devKey, setDevKey] = useState(0);
  const [stage, setStage] = useState<"store" | "play">("store");
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const [overTray, setOverTray] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const dragStart = useRef<{ x: number; y: number; cx: number; cy: number; w: number; h: number } | null>(null);

  const stats = base?.stats;
  const lum = stats?.lum ?? 0.5;
  const strength = flashStrength(flash, lum);
  const aiLook = !stats ? "classic" : lum < 0.4 ? "soft" : stats.contrast < 0.45 ? "strong" : "classic";
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
      flash: strength,
      flashTone: camera.flashTone,
      cropX: crop.x,
      cropY: crop.y,
    };
  }, [camera, adj, pro, strength, crop]);

  useEffect(() => {
    if (!base || !preset) return;
    const f = requestAnimationFrame(() => {
      const out = renderWithPreset(base.canvas, preset);
      const c = canvasRef.current;
      if (!c) return;
      c.width = out.width;
      c.height = out.height;
      c.getContext("2d")!.drawImage(out, 0, 0);
    });
    return () => cancelAnimationFrame(f);
  }, [base, preset]);

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
  };
  const goResult = () => {
    setLook(preset);
    navigate({ to: "/result" });
  };

  const onPaperDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (phase === "developing") return;
    if (phase === "idle" && !isInstant) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect();
    dragStart.current = { x: e.clientX, y: e.clientY, cx: crop.x, cy: crop.y, w: r.width, h: r.height };
  };
  const onPaperMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = dragStart.current;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (phase === "done") {
      setDrag({ dx, dy });
      const t = trayRef.current?.getBoundingClientRect();
      setOverTray(!!t && e.clientX > t.left - 20 && e.clientX < t.right + 20 && e.clientY > t.top - 20 && e.clientY < t.bottom + 20);
    } else {
      const c = (v: number) => Math.min(1, Math.max(0, v));
      setCrop({ x: c(s.cx - (dx / s.w) * 1.6), y: c(s.cy - (dy / s.h) * 1.6) });
    }
  };
  const onPaperUp = () => {
    dragStart.current = null;
    if (phase === "done" && drag) {
      if (overTray) goResult();
      setDrag(null);
      setOverTray(false);
    }
  };

  if (!photo || !camera || !preset) {
    return (
      <main className="theme-warm flex min-h-[calc(100dvh-5rem)] flex-col items-center justify-center px-5 text-center">
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

  return (
    <main className="theme-warm relative flex min-h-[calc(100dvh-4rem)] flex-col px-5 pt-[max(env(safe-area-inset-top),1rem)] pb-28">
      <header className="flex items-center justify-between">
        <Link to="/cameras" className="-ml-2 flex items-center gap-0.5 rounded-full px-2 py-1 font-mono text-[11px] text-muted-foreground">
          <ChevronLeft className="size-4" />
          换相机
        </Link>
        <h1 className="font-serif text-lg font-bold">暗房</h1>
        <div role="radiogroup" aria-label="闪光灯" className="flex items-center gap-0.5 rounded-full bg-surface p-0.5">
          {strength > 0 ? <Zap className="ml-1 size-3.5 text-primary" /> : <ZapOff className="ml-1 size-3.5 text-muted-foreground" />}
          {FLASH_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={flash === o.id}
              onClick={() => edit(setFlash)(o.id)}
              className={cn(
                "rounded-full px-2 py-1 font-mono text-[10px]",
                flash === o.id ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </header>

      {/* 相纸 */}
      <section className="relative mt-5 flex h-[min(46dvh,380px)] items-center justify-center overflow-hidden" onClick={developing ? finish : undefined}>
        <div
          key={devKey}
          onPointerDown={onPaperDown}
          onPointerMove={onPaperMove}
          onPointerUp={onPaperUp}
          onPointerCancel={onPaperUp}
          style={drag ? { transform: `translate(${drag.dx}px,${drag.dy}px) scale(${overTray ? 0.45 : 0.85})`, transition: "transform 80ms" } : undefined}
          className={cn(
            "relative z-10 flex max-h-full max-w-full touch-none bg-surface-raised p-2.5 shadow-[0_18px_40px_-14px_rgb(0_0_0/0.55)]",
            isInstant && "p-0 bg-transparent",
            developing && cat === "instant" && "anim-dev-slide",
            phase === "done" && "cursor-grab",
            phase === "idle" && isInstant && "cursor-move",
          )}
        >
          <canvas ref={canvasRef} className={cn("block max-h-[calc(min(46dvh,380px)-1.25rem)] max-w-full", original && "invisible", animClass)} />
          {original && (
            <img src={photo.src} alt="原图" draggable={false} className="pointer-events-none absolute inset-0 m-auto max-h-full max-w-full object-contain" />
          )}
        </div>

        {developing && cat === "ccd" && stage === "store" && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-2 rounded-lg bg-foreground px-3 py-2 font-mono text-xs text-background">
              <span className="size-2 animate-[blink_0.5s_steps(1)_infinite] rounded-full bg-primary" />
              存储中…
            </div>
          </div>
        )}
        {developing && (
          <p className="absolute bottom-1 z-20 font-mono text-[10px] text-muted-foreground">
            {cat === "film" ? "显影液中…" : cat === "ccd" ? "写入存储卡" : "相纸显影中"} · 点击跳过
          </p>
        )}

        <div className="absolute top-1 right-1 z-20 flex gap-1.5">
          {original ? <span className="rounded-full bg-background/80 px-2 py-0.5 font-mono text-[10px]">原图</span> : <ApproxTag />}
        </div>
      </section>

      <div className="mt-2 flex items-center justify-between">
        <p className="font-mono text-[11px] text-muted-foreground">
          {camera.name} · {phase === "done" ? "已显影 · 拖到成品台" : isInstant ? "拖动照片调整裁剪" : camera.tagline}
        </p>
        <button
          type="button"
          onPointerDown={() => setOriginal(true)}
          onPointerUp={() => setOriginal(false)}
          onPointerLeave={() => setOriginal(false)}
          onContextMenu={(e) => e.preventDefault()}
          className="touch-hold rounded-full border border-foreground/25 px-3 py-1 font-mono text-[11px] select-none active:bg-foreground active:text-background"
        >
          原片
        </button>
      </div>

      {/* 快速效果 */}
      <div className="mt-4 flex justify-center gap-2">
        {LOOKS.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => {
              edit(setAdj)(l.v);
              setLookId(l.id);
            }}
            className={cn(
              "flex items-center gap-1 rounded-full border px-3.5 py-1.5 text-xs transition-colors",
              look === l.id ? "border-foreground bg-foreground text-background" : "border-foreground/20 bg-surface",
            )}
          >
            {l.id === aiLook && <AiMark className="size-3" label="AI 推荐" />}
            {l.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex justify-center">
        <ExposureDial value={adj.ev} onChange={(ev) => { edit(setAdj)({ ...adj, ev }); setLookId(null); }} />
      </div>

      <div className="mt-4 space-y-1">
        <Ruler
          label="色温" left="冷" right="暖" value={adj.temp}
          gradient="linear-gradient(90deg, oklch(0.65 0.12 245), oklch(0.85 0.01 80), oklch(0.72 0.15 60))"
          onChange={(temp) => { edit(setAdj)({ ...adj, temp }); setLookId(null); }}
        />
        <Ruler
          label="色调" left="绿" right="洋红" value={adj.tint}
          gradient="linear-gradient(90deg, oklch(0.65 0.13 150), oklch(0.85 0.01 80), oklch(0.62 0.18 350))"
          onChange={(tint) => { edit(setAdj)({ ...adj, tint }); setLookId(null); }}
        />
      </div>

      {/* 暗房模式 */}
      <section className="mt-4 rounded-2xl bg-surface">
        <button type="button" onClick={() => setProOpen((v) => !v)} aria-expanded={proOpen} className="flex w-full items-center justify-between px-4 py-3">
          <span className="font-serif text-sm font-bold">暗房模式</span>
          <ChevronDown className={cn("size-4 transition-transform", proOpen && "rotate-180")} />
        </button>
        {proOpen && (
          <div className="space-y-3 px-4 pb-4">
            {([["grain", "颗粒"], ["fade", "褪色"], ["sharpen", "锐化"]] as const).map(([k, label]) => (
              <label key={k} className="flex items-center gap-3 text-xs">
                <span className="flex w-12 items-center gap-1">{label}<ProMark /></span>
                <input
                  type="range" min={0} max={1} step={0.01} value={pro[k]} aria-label={label}
                  onChange={(e) => edit(setPro)({ ...pro, [k]: +e.target.value })}
                  className="flex-1 accent-[var(--primary)]"
                />
                <span className="w-7 text-right font-mono text-[10px] tabular-nums">{Math.round(pro[k] * 100)}</span>
              </label>
            ))}
          </div>
        )}
      </section>

      <div className="mt-5 grid gap-2">
        <button
          type="button"
          onClick={develop}
          disabled={developing}
          className="h-12 rounded-full bg-primary text-[15px] font-medium text-primary-foreground shadow-glow-amber active:scale-[0.98] disabled:opacity-60"
        >
          {phase === "done" ? "重新显影" : developing ? "显影中…" : "显影"}
        </button>
        {phase === "done" && (
          <button type="button" onClick={goResult} className="h-12 rounded-full border-2 border-foreground text-[15px] font-medium">
            做成成品
          </button>
        )}
      </div>

      {/* 成品台 */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-[390px] justify-end px-4">
        <div
          ref={trayRef}
          onClick={phase === "done" ? goResult : () => showHint("先显影，再把照片拖到这里")}
          className={cn(
            "pointer-events-auto flex size-14 flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-surface-raised transition-all",
            overTray ? "scale-110 border-primary text-primary" : phase === "done" ? "border-foreground/60" : "border-foreground/20 text-muted-foreground",
          )}
        >
          <Inbox className="size-5" />
          <span className="mt-0.5 text-[9px]">成品台</span>
        </div>
      </div>
    </main>
  );
}
