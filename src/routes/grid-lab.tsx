import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";
import p0 from "@/assets/gridlab/p0.jpg";
import p1 from "@/assets/gridlab/p1.jpg";
import p2 from "@/assets/gridlab/p2.jpg";
import p3 from "@/assets/gridlab/p3.jpg";

export const Route = createFileRoute("/grid-lab")({
  head: () => ({
    meta: [
      { title: "四宫格波点调试 · Dazz Lab" },
      { name: "description", content: "实时调整四宫格模板的波点疏密、分布范围和大小。" },
      { property: "og:title", content: "四宫格波点调试 · Dazz Lab" },
      { property: "og:description", content: "实时微调四宫格波点贴纸效果。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GridLab,
});

const SRC = [p0, p1, p2, p3];
const FX = [0.62, 0.5, 0.15, 0.4];
const CW = 1200, CH = 1600, PW = 330, PH = 440, G = 40;

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type P = { density: number; spread: number; size: number; grain: number; seed: number };

function draw(ctx: CanvasRenderingContext2D, imgs: HTMLImageElement[], p: P) {
  const bg = imgs[0]!;
  ctx.save();
  ctx.filter = "blur(60px) saturate(1.1)";
  const s = Math.max(CW / bg.width, CH / bg.height) * 1.2;
  ctx.drawImage(bg, (CW - bg.width * s) / 2, (CH - bg.height * s) / 2, bg.width * s, bg.height * s);
  ctx.restore();
  // 颗粒
  const id = ctx.getImageData(0, 0, CW, CH), d = id.data, r0 = mulberry(7);
  for (let i = 0; i < d.length; i += 4) {
    const n = (r0() + r0() + r0() - 1.5) * p.grain * 2;
    d[i] = d[i]! + n; d[i + 1] = d[i + 1]! + n; d[i + 2] = d[i + 2]! + n;
  }
  ctx.putImageData(id, 0, 0);
  const sx = (CW - (2 * PW + G)) / 2, sy = (CH - (2 * PH + G)) / 2;
  imgs.forEach((im, k) => {
    const r = PW / PH;
    let cw = im.width, ch = im.height, cx = 0, cy = 0;
    if (cw / ch > r) { cw = ch * r; cx = (im.width - cw) * FX[k]!; } else { ch = cw / r; cy = (im.height - ch) / 2; }
    ctx.drawImage(im, cx, cy, cw, ch, sx + (k % 2) * (PW + G), sy + Math.floor(k / 2) * (PH + G), PW, PH);
  });
  // 波点
  const X0 = sx, Y0 = sy, X1 = sx + 2 * PW + G, Y1 = sy + 2 * PH + G;
  const anchors = [[X0, Y0], [X1, Y0 + 60], [X0 - 10, Y0 + PH + G / 2], [X1 + 5, Y1 - 40], [X0 + PW + G / 2, Y1], [X0 + PW * 0.6, Y0 - 8], [X1 - 60, Y1 + 10]];
  const rnd = mulberry(p.seed);
  const gauss = () => { const u = 1 - rnd(), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const sizes = [5, 8, 11, 15, 20, 26];
  const acc: [number, number, number][] = [];
  for (const [ax, ay] of anchors) {
    for (let j = 0; j < p.density; j++) {
      const x = ax! + gauss() * p.spread, y = ay! + gauss() * p.spread * 0.85;
      const r = sizes[Math.floor(rnd() * rnd() * sizes.length)]! * p.size;
      if (acc.some(([a, b, c]) => (x - a) ** 2 + (y - b) ** 2 < (r + c + 6) ** 2)) continue;
      acc.push([x, y, r]);
      ctx.fillStyle = `rgba(238,222,196,${0.8 + rnd() * 0.12})`;
      ctx.beginPath();
      ctx.ellipse(x, y, r * (0.96 + rnd() * 0.08), r * (0.96 + rnd() * 0.08), rnd() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function GridLab() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [imgs, setImgs] = useState<HTMLImageElement[] | null>(null);
  const [p, setP] = useState<P>({ density: 6, spread: 48, size: 1, grain: 7, seed: 3 });
  useEffect(() => {
    Promise.all(SRC.map((s) => new Promise<HTMLImageElement>((res) => { const i = new Image(); i.onload = () => res(i); i.src = s; }))).then(setImgs);
  }, []);
  useEffect(() => {
    const c = ref.current;
    if (c && imgs) draw(c.getContext("2d", { willReadFrequently: true })!, imgs, p);
  }, [imgs, p]);
  const rows: { k: keyof P; label: string; min: number; max: number; step: number }[] = [
    { k: "density", label: "疏密", min: 1, max: 16, step: 1 },
    { k: "spread", label: "分布范围", min: 10, max: 140, step: 2 },
    { k: "size", label: "大小", min: 0.5, max: 1.8, step: 0.05 },
    { k: "grain", label: "颗粒", min: 0, max: 16, step: 1 },
    { k: "seed", label: "随机排布", min: 1, max: 50, step: 1 },
  ];
  return (
    <main className="px-5 pb-32 pt-[max(env(safe-area-inset-top),1.25rem)]">
      <Link to="/me" className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">← 返回</Link>
      <h1 className="mt-4 font-serif text-[26px] font-bold">四宫格 · 波点调试</h1>
      <canvas ref={ref} width={CW} height={CH} className="mt-4 w-full rounded-lg" />
      <div className="mt-5 space-y-4">
        {rows.map((r) => (
          <div key={r.k}>
            <div className="mb-2 flex justify-between text-xs">
              <span>{r.label}</span>
              <span className="font-mono text-muted-foreground">{p[r.k]}</span>
            </div>
            <Slider min={r.min} max={r.max} step={r.step} value={[p[r.k]]} onValueChange={([v]) => setP((o) => ({ ...o, [r.k]: v! }))} aria-label={r.label} />
          </div>
        ))}
      </div>
    </main>
  );
}
