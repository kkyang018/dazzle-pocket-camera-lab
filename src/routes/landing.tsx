import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CAMERAS } from "@/lib/cameras";
import { playEject } from "@/lib/sound";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/landing")({
  head: () => ({
    meta: [
      { title: "Dazz Lab — Not a filter. A darkroom." },
      { name: "description", content: "Pick a vintage camera, develop your photo by hand, and print it as something worth keeping." },
      { property: "og:title", content: "Dazz Lab — Not a filter. A darkroom." },
      { property: "og:description", content: "Pick a vintage camera, develop your photo by hand, and print it as something worth keeping." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

const A = (f: string) => `/landing/${f}`;

const STEPS = [
  { n: "01", title: "Choose a camera", body: "15 vintage cameras. See each one on your own photo before you pick, with an AI pick to start from.", img: "feature-cameras.jpg" },
  { n: "02", title: "Develop in the darkroom", body: "Dial the exposure, warm it up, add grain. Then watch your photo come out of the developer.", img: "feature-darkroom.jpg" },
  { n: "03", title: "Pick from the contact sheet", body: "Every print lands on your contact sheet. Choose one, or a few, to finish.", img: "feature-prints.jpg" },
  { n: "04", title: "Make the print", body: "Hand-drawn, Half-Frame, Polaroid or Collage, saved at full size.", img: "feature-result.jpg" },
];

const PRINTS = [
  { img: "print-polaroid-1.webp", name: "Polaroid", line: "A square of light, dated and stamped." },
  { img: "print-solo-1.jpg", name: "Hand-drawn", line: "Doodles and colours taken from your photo." },
  { img: "print-halfframe-1.jpg", name: "Half-Frame", line: "Two moments, one strip of film." },
  { img: "print-collage-1.jpg", name: "Collage", line: "A whole day on one sheet." },
  { img: "print-polaroid-2.webp", name: "Polaroid", line: "Mini format, made for faces." },
  { img: "print-solo-2.jpg", name: "Hand-drawn", line: "Every print gets its own palette." },
  { img: "print-halfframe-2.jpg", name: "Half-Frame", line: "The frame between two frames." },
];

const UGC = Array.from({ length: 13 }, (_, i) => `ugc/ugc-${String(i + 1).padStart(2, "0")}.jpg`);

/* ── 自定义光标：箭头，白色描边 + AI 青色填充，外面一层青色光晕、一层白色光晕 ── */
function useCursor(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    // 从 app 的 --ai 变量取色，和 app 里的 AI 标记一致
    const probe = document.createElement("i");
    probe.style.color = "var(--ai)";
    el.append(probe);
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.fillStyle = getComputedStyle(probe).color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    probe.remove();
    const ai = `rgb(${r},${g},${b})`;
    const P = "M14 11 L14 32 L19.2 27.2 L22.8 35 L26.6 33.3 L23.1 25.7 L30 25.7 Z";
    // 光晕：先模糊再把透明度放大，光更亮、边更柔，看起来是发光而不是阴影
    const glow = (id: string, sd: number, gain: number) =>
      `<filter id="${id}" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="${sd}"/><feComponentTransfer><feFuncA type="linear" slope="${gain}"/></feComponentTransfer></filter>`;
    const svg = (hot: boolean) => `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
      <defs>${glow("b", hot ? 4.2 : 3.4, hot ? 2.2 : 1.7)}${glow("w", hot ? 1.8 : 1.4, hot ? 2.4 : 1.9)}</defs>
      <path d="${P}" fill="${ai}" filter="url(#b)"/>
      <path d="${P}" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round" filter="url(#w)"/>
      <path d="${P}" fill="${ai}" stroke="#fff" stroke-width="0.9" stroke-linejoin="round"/>
    </svg>`;
    const url = (hot: boolean) => `url("data:image/svg+xml,${encodeURIComponent(svg(hot))}") 14 11`;
    el.style.setProperty("--lp-cursor", `${url(false)}, auto`);
    el.style.setProperty("--lp-cursor-hot", `${url(true)}, pointer`);
  }, [root]);
}

/* ── 滚动浮现 ── */
function useReveal(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && (e.target.setAttribute("data-shown", ""), io.unobserve(e.target))),
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" },
    );
    const nodes = [...el.querySelectorAll("[data-reveal]")];
    nodes.forEach((n) => io.observe(n));
    // 保险：已经在屏幕里的元素直接显示，不只依赖观察器回调（后台标签页里回调可能迟迟不来）
    const showVisible = () => nodes.forEach((n) => n.getBoundingClientRect().top < window.innerHeight && n.setAttribute("data-shown", ""));
    const raf = requestAnimationFrame(showVisible);
    const t = window.setTimeout(showVisible, 600);
    return () => { io.disconnect(); cancelAnimationFrame(raf); clearTimeout(t); };
  }, [root]);
}

function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.22em] uppercase", className)}>
      <span className="size-1.5 rounded-full bg-primary" aria-hidden />
      {children}
    </span>
  );
}

function TryButton({ children = "Try Dazz Lab", className }: { children?: ReactNode; className?: string }) {
  return (
    <Link
      to="/"
      className={cn(
        "inline-flex h-14 items-center justify-center gap-2 rounded-full bg-primary px-8 text-[16px] font-semibold text-primary-foreground shadow-[0_0_36px_-6px_oklch(0.735_0.142_59/0.75)] transition-transform hover:-translate-y-0.5 active:scale-[0.98]",
        className,
      )}
    >
      {children}
      <span aria-hidden>→</span>
    </Link>
  );
}

function LandingPage() {
  const root = useRef<HTMLDivElement>(null);
  useCursor(root);
  useReveal(root);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <div ref={root} lang="en" className="landing font-sans">
      {/* 顶栏 */}
      <header className={cn("fixed inset-x-0 top-0 z-50 transition-colors duration-500", scrolled && "bg-[oklch(0.16_0.008_40/0.78)] backdrop-blur-xl")}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <a href="#top" className="flex items-center gap-2 font-serif text-xl font-black tracking-tight text-[oklch(0.93_0.01_70)]">
            <span className="size-2 rounded-full bg-primary shadow-[0_0_10px_2px_var(--primary)]" aria-hidden />
            Dazz Lab
          </a>
          <nav className="flex items-center gap-6 font-mono text-[11px] tracking-[0.16em] text-[oklch(0.75_0.015_60)] uppercase">
            <a href="#how" className="hidden hover:text-white sm:block">How it works</a>
            <a href="#prints" className="hidden hover:text-white sm:block">Prints</a>
            <a href="#pricing" className="hidden hover:text-white sm:block">Pricing</a>
            <Link to="/" className="rounded-full border border-primary/60 px-4 py-2 text-primary normal-case tracking-normal hover:bg-primary hover:text-primary-foreground">
              Try Dazz Lab
            </Link>
          </nav>
        </div>
      </header>

      <Hero />
      <div className="lp-fade-to-paper" aria-hidden />
      <HowItWorks />
      <div className="lp-fade-to-dark" aria-hidden />
      <PrintsCarousel />
      <Interlude />
      <div className="lp-fade-to-paper" aria-hidden />
      <Wall />
      <div className="lp-fade-to-dark" aria-hidden />
      <Pricing />
      <FinalCta />
    </div>
  );
}

/* ── ① 封面：顶部一个出片口（和 app 暗房一样），相纸吐出来、显影，循环；文字盖在上面 ── */
function Hero() {
  const paperW = "clamp(300px, 36vw, 500px)";
  const card = useRef<HTMLDivElement>(null);
  // 点出片口：重新吐一张并播放吐纸声（安静模式下不响）
  const replay = () => {
    const el = card.current;
    if (!el) return;
    el.classList.remove("lp-eject-card");
    void el.offsetWidth;
    el.classList.add("lp-eject-card");
    if (!document.querySelector('[data-quiet="true"]')) playEject();
  };
  return (
    <section id="top" className="theme-darkroom relative overflow-hidden" style={{ "--paper-w": paperW } as CSSProperties}>
      <div aria-hidden className="lp-safelight pointer-events-none absolute top-[10%] left-1/2 size-[min(1000px,150vw)] -translate-x-1/2 rounded-full" />

      {/* 出片口 + 相纸（背景层，调暗）；点一下重新吐一张，带音效 */}
      <button
        type="button"
        onClick={replay}
        aria-label="再吐一张相纸"
        className="group absolute top-[64px] left-1/2 w-[calc(var(--paper-w)+56px)] -translate-x-1/2 cursor-pointer"
      >
        <div className="relative z-10 h-[18px] rounded-b-lg bg-gradient-to-b from-background to-surface shadow-[0_8px_14px_-4px_rgb(0_0_0/0.85)]">
          <div className="mx-auto h-[4px] w-[86%] translate-y-[6px] rounded-full bg-background shadow-[inset_0_1px_2px_rgb(0_0_0/0.9)]" />
        </div>
        <span className="pointer-events-none absolute -top-1 right-2 z-20 rounded-full border border-primary/50 bg-black/60 px-2.5 py-1 font-mono text-[10px] tracking-[0.14em] text-primary opacity-70 transition-opacity group-hover:opacity-100">
          EJECT · 再吐一张
        </span>
        <div className="mx-auto w-[var(--paper-w)] overflow-hidden pb-10 brightness-[0.5] saturate-[0.9]">
          <div ref={card} className="lp-eject-card lp-paper-tex relative rounded-[4px] p-[6%] pb-[22%] shadow-[0_28px_50px_-16px_rgb(0_0_0/0.9)]">
            <div className="relative aspect-square overflow-hidden bg-black">
              <img src={A("hero-photo.jpg")} alt="" className="size-full object-cover" />
              <div className="lp-veil absolute inset-0" />
            </div>
            <div className="absolute inset-x-0 bottom-[7%] text-center [font-family:'Special_Elite',monospace] text-[calc(var(--paper-w)*0.045)] tracking-[0.08em] text-[#3a3836]">
              13 NOV 2026
            </div>
          </div>
        </div>
      </button>

      {/* 蒙版：中间压暗，保证文字看得清；底部融进下一屏 */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_62%_46%_at_50%_54%,oklch(0.12_0.008_40/0.72),oklch(0.12_0.008_40/0.25)_70%,transparent)]" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[oklch(0.16_0.008_40)]" />

      {/* 文字：居中，盖在出片口和相纸上面（不挡出片口点击） */}
      <div className="pointer-events-none relative mx-auto flex min-h-[100svh] max-w-4xl flex-col items-center justify-center px-6 pt-44 pb-8 text-center [&_a,&_button]:pointer-events-auto">
        <h1 data-reveal style={{ "--d": "0.1s" } as CSSProperties} className="font-serif text-[clamp(46px,6.8vw,100px)] leading-[0.95] font-black tracking-tight [text-shadow:0_4px_30px_rgb(0_0_0/0.7)]">
          <span className="whitespace-nowrap">Not a filter.</span>
          <br />
          <span className="whitespace-nowrap text-primary">A darkroom.</span>
        </h1>
        <p data-reveal style={{ "--d": "0.2s" } as CSSProperties} className="mt-4 font-serif text-lg tracking-[0.32em] text-[oklch(0.86_0.03_60)] [text-shadow:0_2px_12px_rgb(0_0_0/0.8)]">
          不是滤镜，是暗房。
        </p>
        <p data-reveal style={{ "--d": "0.3s" } as CSSProperties} className="mt-5 max-w-lg text-[17px] leading-relaxed text-[oklch(0.9_0.012_70)] [text-shadow:0_2px_12px_rgb(0_0_0/0.8)]">
          Pick a vintage camera, develop your photo by hand, and print it as something worth keeping.
        </p>
        <div data-reveal style={{ "--d": "0.4s" } as CSSProperties} className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <TryButton />
          <a href="#prints" className="inline-flex h-14 items-center rounded-full border border-white/25 bg-black/20 px-7 text-[15px] text-[oklch(0.92_0.01_70)] backdrop-blur-sm transition-colors hover:border-white/50">
            See the prints
          </a>
        </div>
        <p data-reveal style={{ "--d": "0.5s" } as CSSProperties} className="mt-6 font-mono text-[11px] tracking-[0.12em] text-[oklch(0.72_0.015_60)]">
          FREE ROLL EVERY MONTH · NO SUBSCRIPTION · ORIGINALS STAY ON YOUR PHONE
        </p>
      </div>
    </section>
  );
}

/* ── ② 功能卡片：四步流程，真实截图 ── */
function HowItWorks() {
  return (
    <section id="how" className="theme-paper relative scroll-mt-16 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div data-reveal className="max-w-3xl">
          <Eyebrow className="text-muted-foreground">How it works</Eyebrow>
          <h2 className="mt-5 font-serif text-[clamp(34px,4.6vw,58px)] leading-[1.02] font-black tracking-tight">From photo to keepsake, in four steps.</h2>
          <p className="mt-5 text-[17px] leading-relaxed text-muted-foreground">
            Bring a photo from your camera roll. Dazz Lab keeps the original and develops a new print from it, the slow way.
          </p>
        </div>
        <ol className="scrollbar-none -mx-6 mt-14 flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-4 md:mx-0 md:grid md:grid-cols-2 md:gap-x-10 md:gap-y-16 md:overflow-visible md:px-0 lg:grid-cols-4 lg:gap-x-12">
          {STEPS.map((s, i) => (
            <li key={s.n} data-reveal="slow" style={{ "--d": `${0.15 + i * 0.35}s` } as CSSProperties} className="w-[68%] shrink-0 snap-center md:w-auto">
              <div className="mx-auto w-full max-w-[210px] overflow-hidden rounded-[29px] border-[6px] border-[oklch(0.17_0.005_60)] bg-black shadow-[0_30px_50px_-24px_rgb(0_0_0/0.55)]">
                <img src={A(s.img)} alt={`${s.title} screen`} loading="lazy" className="block aspect-[390/844] w-full object-cover" />
              </div>
              <div className="mx-auto mt-6 max-w-[210px]">
                <span className="font-mono text-[12px] tracking-[0.2em] text-primary">{s.n}</span>
                <h3 className="mt-1.5 font-serif text-[22px] font-bold">{s.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ── ③ 成品轮播：自动横向滚动；鼠标放上去暂停，可以拖动或用滚轮 ── */
function PrintsCarousel() {
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.querySelector('[data-quiet="true"]');
    let hover = false, drag: { x: number; left: number } | null = null, raf = 0, pos = el.scrollLeft;
    const wrap = () => {
      const half = el.scrollWidth / 2;
      if (el.scrollLeft >= half) el.scrollLeft -= half;
      else if (el.scrollLeft <= 0) el.scrollLeft += half;
      pos = el.scrollLeft;
    };
    const tick = () => {
      if (!hover && !drag && !reduce) {
        pos += 0.55;
        el.scrollLeft = pos;
        if (el.scrollLeft >= el.scrollWidth / 2) wrap();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const enter = () => (hover = true);
    const leave = () => { hover = false; drag = null; pos = el.scrollLeft; };
    const down = (e: PointerEvent) => { drag = { x: e.clientX, left: el.scrollLeft }; try { el.setPointerCapture(e.pointerId); } catch { /* 模拟指针不支持 */ } };
    const move = (e: PointerEvent) => { if (!drag) return; el.scrollLeft = drag.left - (e.clientX - drag.x); wrap(); };
    const up = () => { drag = null; pos = el.scrollLeft; };
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, []);

  return (
    <section id="prints" className="theme-darkroom lp-dark relative scroll-mt-16 overflow-hidden pt-12 pb-24 md:pt-16">
      <div data-reveal className="relative mx-auto max-w-6xl px-6">
        <Eyebrow className="text-[oklch(0.78_0.02_60)]">The prints</Eyebrow>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-6">
          <h2 className="font-serif text-[clamp(34px,4.6vw,58px)] leading-[1.02] font-black tracking-tight">Four ways to print.</h2>
          <p className="max-w-sm text-[16px] leading-relaxed text-[oklch(0.78_0.012_70)]">
            Every template is drawn from your own photo, with no stock frames. Hover to pause, drag to browse.
          </p>
        </div>
      </div>
      <div
        ref={track}
        data-hot
        className="scrollbar-none relative mt-14 flex touch-pan-y gap-12 overflow-x-hidden px-[6vw] pt-6 pb-4 select-none"
        aria-label="Prints made with Dazz Lab"
      >
        {[...PRINTS, ...PRINTS].map((p, i) => (
          <figure key={i} aria-hidden={i >= PRINTS.length} className="flex shrink-0 flex-col items-center">
            <img
              src={A(p.img)}
              alt={i < PRINTS.length ? `${p.name} print` : ""}
              draggable={false}
              loading="lazy"
              className="lp-print h-[clamp(280px,44vh,440px)] w-auto"
            />
            <figcaption className="mt-7 text-center">
              <span className="block font-serif text-[18px] font-bold">{p.name}</span>
              <span className="mt-1 block font-mono text-[11px] tracking-[0.06em] text-[oklch(0.7_0.015_60)]">{p.line}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/* ── 文字过渡：两段图片之间让眼睛歇一下 ── */
function Interlude() {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && (setOn(true), io.disconnect()), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const stats = [
    { n: CAMERAS.length, label: "vintage cameras" },
    { n: 4, label: "ways to print" },
    { n: 0, label: "originals uploaded" },
  ];
  return (
    <section className="theme-darkroom py-24 md:py-32" style={{ background: "oklch(0.16 0.008 40)" }}>
      <div ref={ref} className="mx-auto max-w-4xl px-6 text-center">
        <div className="film-perforation mx-auto h-2 w-48 opacity-40" aria-hidden />
        <h2 data-reveal className="mt-10 font-serif text-[clamp(36px,5.6vw,72px)] leading-[1.02] font-black tracking-tight">
          Every print starts
          <br />
          in the dark.
        </h2>
        <dl className="mt-14 grid grid-cols-3 gap-4">
          {stats.map((s, i) => (
            <div key={s.label} data-reveal style={{ "--d": `${0.15 + i * 0.12}s` } as CSSProperties}>
              <dt className="sr-only">{s.label}</dt>
              <dd className="font-serif text-[clamp(44px,6vw,76px)] leading-none font-black text-primary tabular-nums">
                <Counter to={s.n} run={on} />
              </dd>
              <dd className="mt-3 font-mono text-[11px] tracking-[0.16em] text-[oklch(0.72_0.015_60)] uppercase">{s.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** 像胶片计数器一样跳到目标数字 */
function Counter({ to, run }: { to: number; run: boolean }) {
  const [v, setV] = useState(to === 0 ? 24 : 0);
  useEffect(() => {
    if (!run) return;
    const from = to === 0 ? 24 : 0, start = performance.now(), dur = 1300;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / dur), e = 1 - Math.pow(1 - k, 3);
      setV(Math.round(from + (to - from) * e));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [run, to]);
  return <>{String(v).padStart(2, "0")}</>;
}

/* ── ④ 作品墙：用户做的成品；照片不歪、不加白边，角上一枚复古圆形贴纸 ── */
// 贴纸颜色取自复古色卡：Espresso / Eau Trouble / Terre Cuite / Bleu Porcelaine / Miel Doré
// （Nuage de Lait 奶白和墙面同色，贴上去看不见，不用）
// 深棕、砖红往米白调了一点，退色，不那么重
const STICKER_COLORS = ["#775445", "#b79858", "#b36249", "#88b8ce", "#f1c166"];
// 服务端先按顺序轮换给一个颜色；页面排好后再按照片的真实位置重新分配（见 Wall 里的 paint）
const STICKERS = UGC.map((_, i) => STICKER_COLORS[i % STICKER_COLORS.length]!);

function Wall() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 服务端渲染时图片可能在 React 接管前就加载好了，onLoad 不会再触发，这里补标记
    el.querySelectorAll<HTMLImageElement>(".lp-pin img").forEach((img) => img.complete && img.naturalWidth && img.parentElement?.setAttribute("data-loaded", ""));
    // 按照片在墙上的真实位置分配贴纸颜色：离得近（上下、左右、斜对角）的照片不用同一种颜色
    let t = 0;
    const paint = () => {
      const pins = [...el.querySelectorAll<HTMLElement>(".lp-pin")];
      const boxes = pins.map((p) => { const r = p.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top, w: r.width }; });
      const used: string[] = [];
      pins.forEach((p, i) => {
        const me = boxes[i]!;
        const near = boxes.slice(0, i).flatMap((o, j) => (Math.abs(o.x - me.x) < me.w * 1.6 && Math.abs(o.y - me.y) < me.w * 1.8 ? [used[j]] : []));
        const order = STICKER_COLORS.map((_, k) => STICKER_COLORS[(i + k) % STICKER_COLORS.length]!);
        const c = order.find((c) => !near.includes(c)) ?? order[0]!;
        used.push(c);
        p.style.setProperty("--sticker", c);
      });
    };
    const later = () => { clearTimeout(t); t = window.setTimeout(paint, 120); };
    paint();
    const ro = new ResizeObserver(later);
    ro.observe(el);
    el.addEventListener("load", later, true);
    return () => { ro.disconnect(); el.removeEventListener("load", later, true); clearTimeout(t); };
  }, []);
  return (
    <section ref={ref} className="theme-paper py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div data-reveal className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Eyebrow className="text-muted-foreground">From our community</Eyebrow>
            <h2 className="mt-5 font-serif text-[clamp(34px,4.6vw,58px)] leading-[1.02] font-black tracking-tight">Made by you, pinned by us.</h2>
          </div>
          <p className="text-[16px] leading-relaxed text-muted-foreground md:whitespace-nowrap">
            Real prints from Dazz Lab users: trips, friends, slow mornings.
            <br className="hidden md:block" /> Share yours with <span className="font-medium text-foreground">#DazzLab</span> to get pinned.
          </p>
        </div>
        <div className="mt-14 columns-2 gap-3 md:columns-3 md:gap-5 lg:columns-4">
          {UGC.map((f, i) => (
            <figure key={f} data-reveal style={{ "--d": `${(i % 4) * 0.08}s` } as CSSProperties} className="mb-1 break-inside-avoid pt-[18px] md:mb-2">
              <div className="lp-pin" data-hot style={{ "--sticker": STICKERS[i] } as CSSProperties}>
                <span aria-hidden className="lp-sticker" />
                <img
                  src={A(f)}
                  alt="A print shared by a Dazz Lab user"
                  loading="lazy"
                  onLoad={(e) => e.currentTarget.parentElement?.setAttribute("data-loaded", "")}
                  className="block w-full rounded-[5px]"
                />
              </div>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── ⑤ 转化钩子：免费胶卷 + 按卷付费 / 买断，不订阅 ── */
function Pricing() {
  const plans = [
    { name: "1 Roll", sub: "24 exposures", price: "¥6", note: "Top up whenever you like." },
    { name: "5 Rolls", sub: "120 exposures", price: "¥25", note: "For weekends full of photos.", badge: "Save 17%", hot: true },
    { name: "All Cameras · Lifetime", sub: "Unlimited develops", price: "¥98", note: "Every camera, today and later. Pay once." },
  ];
  return (
    <section id="pricing" className="theme-darkroom lp-dark relative scroll-mt-16 overflow-hidden pt-12 pb-24 md:pt-16 md:pb-32">
      <div className="relative mx-auto max-w-6xl px-6">
        <div data-reveal className="mx-auto max-w-3xl text-center">
          <Eyebrow className="text-[oklch(0.78_0.02_60)]">Pricing</Eyebrow>
          <h2 className="mt-5 font-serif text-[clamp(36px,5vw,64px)] leading-[1.02] font-black tracking-tight">Your first roll is on us.</h2>
          <p className="mt-5 text-[17px] leading-relaxed text-[oklch(0.8_0.012_70)]">24 free exposures every month. Top up only when you want more.</p>
        </div>

        {/* 免费胶卷：24 格 */}
        <div data-reveal style={{ "--d": "0.1s" } as CSSProperties} className="mx-auto mt-12 max-w-3xl rounded-2xl bg-[oklch(0.1_0.005_40)] p-3 shadow-[inset_0_0_0_1px_oklch(1_0_0/0.06)]">
          <div className="film-perforation h-2 opacity-50" aria-hidden />
          <div className="my-2 grid grid-cols-12 gap-1.5">
            {Array.from({ length: 24 }, (_, i) => (
              <span key={i} className="h-7 rounded-[3px] md:h-9" style={{ background: `oklch(0.735 0.142 59 / ${0.35 + ((i * 7) % 5) * 0.11})` }} />
            ))}
          </div>
          <div className="film-perforation h-2 opacity-50" aria-hidden />
          <p className="mt-3 text-center font-mono text-[10.5px] tracking-[0.2em] text-[oklch(0.72_0.015_60)] uppercase">Free roll · 24 exposures · refills monthly</p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {plans.map((p, i) => (
            <div
              key={p.name}
              data-reveal
              style={{ "--d": `${0.15 + i * 0.1}s` } as CSSProperties}
              className={cn(
                "relative flex flex-col rounded-3xl p-7",
                p.hot
                  ? "bg-[oklch(0.22_0.012_45)] shadow-[0_0_0_1.5px_var(--primary),0_30px_60px_-30px_oklch(0.735_0.142_59/0.6)]"
                  : "bg-[oklch(0.2_0.01_40)] shadow-[inset_0_0_0_1px_oklch(1_0_0/0.08)]",
              )}
            >
              {p.badge && (
                <span className="absolute -top-3 right-6 rounded-full bg-primary px-3 py-1 font-mono text-[10.5px] font-semibold tracking-[0.12em] text-primary-foreground uppercase">
                  {p.badge}
                </span>
              )}
              <h3 className="font-serif text-[22px] font-bold">{p.name}</h3>
              <p className="mt-1 font-mono text-[11.5px] tracking-[0.06em] text-[oklch(0.72_0.015_60)]">{p.sub}</p>
              <p className="mt-8 font-serif text-[52px] leading-none font-black text-primary">{p.price}</p>
              <p className="mt-4 text-[14.5px] leading-relaxed text-[oklch(0.78_0.012_70)]">{p.note}</p>
            </div>
          ))}
        </div>

        <div data-reveal className="mt-12 flex flex-col items-center gap-5 text-center">
          <p className="text-[15px] text-[oklch(0.78_0.012_70)]">
            New camera drops from <span className="font-semibold text-primary">¥6</span>, yours forever.
          </p>
          <TryButton>Start with a free roll</TryButton>
          <p className="font-mono text-[11px] tracking-[0.18em] text-[oklch(0.68_0.015_60)] uppercase">No subscription. Pay once, keep it forever.</p>
        </div>
      </div>
    </section>
  );
}

/* ── ⑥ 收尾 CTA ── */
function FinalCta() {
  return (
    <section className="theme-darkroom lp-dark relative overflow-hidden">
      <div aria-hidden className="lp-safelight pointer-events-none absolute -bottom-[260px] left-1/2 size-[760px] -translate-x-1/2 rounded-full" />
      <div className="relative mx-auto max-w-4xl px-6 pt-16 pb-28 text-center md:pt-24 md:pb-36">
        {/* 结尾用 VP 原句，和首屏的短版「Not a filter. A darkroom.」前后呼应 */}
        <h2 data-reveal className="font-serif text-[clamp(34px,5.2vw,68px)] leading-[1.02] font-black tracking-tight">
          <span className="whitespace-nowrap">Some moments</span> <span className="whitespace-nowrap">deserve</span>
          <br />
          <span className="text-primary">
            <span className="whitespace-nowrap">a darkroom,</span> <span className="whitespace-nowrap">not a filter.</span>
          </span>
        </h2>
        <p data-reveal style={{ "--d": "0.1s" } as CSSProperties} className="mt-5 font-serif text-lg tracking-[0.12em] text-[oklch(0.8_0.03_60)]">
          <span className="inline-block">有些瞬间，值得一间暗房，</span>
          <span className="inline-block">而不只是一层滤镜。</span>
        </p>
        <div data-reveal style={{ "--d": "0.2s" } as CSSProperties} className="mt-10">
          <TryButton />
        </div>
      </div>
      <footer className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 font-mono text-[11px] tracking-[0.12em] text-[oklch(0.62_0.015_60)]">
          <span className="font-serif text-[15px] font-black tracking-tight text-[oklch(0.85_0.01_70)]">Dazz Lab</span>
          <span>MC6368 COURSE PROTOTYPE · © 2026</span>
        </div>
      </footer>
    </section>
  );
}
