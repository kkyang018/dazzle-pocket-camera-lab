import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { AiMark, ProMark } from "@/components/app/marks";
import { StickerBoard, layoutStickers, type Placed } from "@/components/result/sticker-board";
import { usePhotoBase } from "@/hooks/use-photo-base";
import { useApp } from "@/lib/app-state";
import { renderWithPreset } from "@/lib/render";
import { analyzeScene, inkColor, pickStickers, type Keyword } from "@/lib/scene";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/result")({
  head: () => ({
    meta: [
      { title: "成品模板 · Dazz Lab" },
      { name: "description", content: "为显影好的照片选择胶片复古、画报、手帐或拼贴模板。" },
      { property: "og:title", content: "成品模板 · Dazz Lab" },
      { property: "og:description", content: "为显影好的照片选择胶片复古、画报、手帐或拼贴模板。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResultPage,
});

const TABS = ["胶片复古", "单张画报", "手帐日记", "场景拼贴"] as const;
type Tab = (typeof TABS)[number];
type Analysis = { palette: string[]; keywords: Keyword[]; stickers: string[] };

function ResultPage() {
  const { photo, look } = useApp();
  const base = usePhotoBase(photo);
  const [img, setImg] = useState<{ url: string; canvas: HTMLCanvasElement } | null>(null);
  const [tab, setTab] = useState<Tab>("胶片复古");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [journal, setJournal] = useState<Placed[]>([]);
  const [collage, setCollage] = useState<Placed[]>([]);

  useEffect(() => {
    if (!base || !look) return;
    const out = renderWithPreset(base.canvas, look);
    setImg({ url: out.toDataURL("image/jpeg", 0.9), canvas: out });
    setAnalysis(null);
  }, [base, look]);

  const choose = (t: Tab) => {
    setTab(t);
    if (t === "胶片复古" || analysis || analyzing || !img) return;
    setAnalyzing(true);
    setTimeout(() => {
      try {
        const r = analyzeScene(img.canvas);
        const stickers = pickStickers(r.keywords);
        setAnalysis({ palette: r.palette.length ? r.palette : ["#E8923A"], keywords: r.keywords, stickers });
        setJournal(layoutStickers(stickers, "around"));
        setCollage(layoutStickers(stickers, "over"));
      } catch {
        const stickers = pickStickers([]);
        setAnalysis({ palette: ["#E8923A"], keywords: [], stickers });
        setJournal(layoutStickers(stickers, "around"));
        setCollage(layoutStickers(stickers, "over"));
      }
      setAnalyzing(false);
    }, 1300);
  };

  return (
    <main className="theme-paper flex min-h-[calc(100dvh-4rem)] flex-col px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-4">
      <header className="flex items-center justify-between">
        <Link to="/darkroom" className="-ml-2 flex items-center gap-0.5 px-2 py-1 font-mono text-[11px] text-muted-foreground">
          <ChevronLeft className="size-4" />
          回暗房
        </Link>
        <h1 className="font-serif text-lg font-bold">成品模板</h1>
        <span className="w-14" />
      </header>

      {!photo || !look || !img ? (
        <p className="mt-20 text-center font-serif">{photo && look ? "正在准备…" : "还没有显影好的照片"}</p>
      ) : (
        <>
          <nav className="mt-3 grid grid-cols-4 gap-1 rounded-full bg-muted p-1" aria-label="模板">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => choose(t)}
                className={cn("rounded-full py-1.5 text-[12px] transition-colors", tab === t ? "bg-foreground text-background" : "text-muted-foreground")}
              >
                {t}
              </button>
            ))}
          </nav>

          <section className="mt-3 flex-1">
            {tab === "胶片复古" ? (
              <FilmTemplate url={img.url} seed={photo.id} />
            ) : analyzing || !analysis ? (
              <div className="grid h-80 place-items-center">
                <div className="flex flex-col items-center gap-2">
                  <AiMark className="size-6 animate-pulse" label="" />
                  <p className="font-mono text-[12px] text-ai">正在分析照片…</p>
                </div>
              </div>
            ) : (
              <>
                <AiStrip analysis={analysis} />
                {tab === "单张画报" && <PosterTemplate url={img.url} palette={analysis.palette} />}
                {tab === "手帐日记" && <JournalTemplate url={img.url} analysis={analysis} items={journal} onChange={setJournal} />}
                {tab === "场景拼贴" && <CollageTemplate url={img.url} items={collage} onChange={setCollage} />}
              </>
            )}
          </section>

          <Link to="/preview" className="mt-4 block rounded-full bg-primary py-3 text-center font-medium text-primary-foreground">
            预览成品
          </Link>
        </>
      )}
    </main>
  );
}

function AiStrip({ analysis }: { analysis: Analysis }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <span className="flex items-center gap-1 font-mono text-[10px] text-ai">
        <AiMark className="size-3" label="" />
        AI识别
      </span>
      {analysis.keywords.length ? (
        analysis.keywords.map((k) => (
          <span key={k.label} className="rounded-full bg-ai/15 px-2 py-0.5 text-[11px] text-ai">{k.label}</span>
        ))
      ) : (
        <span className="text-[11px] text-muted-foreground">日常</span>
      )}
      <span className="ml-auto flex gap-1">
        {analysis.palette.map((c) => (
          <span key={c} className="size-4 rounded-full border border-foreground/20" style={{ background: c }} title={c} />
        ))}
      </span>
    </div>
  );
}

const holes: CSSProperties = {
  backgroundImage: "repeating-linear-gradient(90deg, transparent 0 3px, color-mix(in oklab, var(--foreground) 75%, transparent) 3px 8px, transparent 8px 11px)",
};
const holesV: CSSProperties = {
  backgroundImage: "repeating-linear-gradient(180deg, transparent 0 3px, color-mix(in oklab, var(--foreground) 75%, transparent) 3px 8px, transparent 8px 11px)",
};

function FilmTemplate({ url, seed }: { url: string; seed: number }) {
  const [layout, setLayout] = useState<"sheet" | "strip">("sheet");
  const p = useMemo(() => {
    const h = (n: number) => Math.floor(seed / n) % 997;
    const f = ["F2.0", "F2.8", "F4", "F5.6", "F8"], s = ["1/60s", "1/125s", "1/250s", "1/500s"], iso = ["ISO100", "ISO200", "ISO400", "ISO800"];
    return { exp: `${f[h(1) % 5]} · ${s[h(7) % 4]} · ${iso[h(31) % 4]}`, frame: String((seed % 36) + 1).padStart(2, "0") };
  }, [seed]);

  return (
    <div className="theme-darkroom rounded-xl bg-background p-4 text-foreground">
      <div className="mb-3 flex justify-end gap-1 font-mono text-[10px]">
        {(["sheet", "strip"] as const).map((l) => (
          <button key={l} type="button" onClick={() => setLayout(l)} className={cn("rounded-full border px-2 py-0.5", layout === l ? "border-primary text-primary" : "border-foreground/20 text-muted-foreground")}>
            {l === "sheet" ? "联系印样" : "负片条"}
          </button>
        ))}
      </div>
      {layout === "sheet" ? (
        <div className="grid grid-cols-3 gap-1 bg-card p-1">
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="flex flex-col gap-[3px] bg-card">
              <div className="h-1" style={holes} />
              {i === 4 ? (
                <img src={url} alt="当前照片" className="aspect-square w-full object-cover outline-2 outline-primary" />
              ) : (
                <div className="aspect-square w-full bg-muted" />
              )}
              <div className="h-1" style={holes} />
              <span className="font-mono text-[7px] text-muted-foreground">{String(Number(p.frame) - 4 + i).padStart(2, "0")}A</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-stretch gap-1.5 bg-card px-1.5 py-2">
          <div className="flex w-3 flex-col items-center">
            <div className="w-1.5 flex-1" style={holesV} />
          </div>
          <span className="font-mono text-[8px] text-primary [writing-mode:vertical-rl]">{p.frame} ▸</span>
          <img src={url} alt="当前照片" className="min-w-0 flex-1 object-contain" />
          <span className="font-mono text-[8px] text-primary [writing-mode:vertical-rl]">{p.frame}A ▸</span>
          <div className="flex w-3 flex-col items-center">
            <div className="w-1.5 flex-1" style={holesV} />
          </div>
        </div>
      )}
      <div className="mt-3 text-center font-mono text-[11px] tracking-wider">
        <p>{p.exp}</p>
        <p className="mt-0.5 text-muted-foreground">FRAME {p.frame}</p>
        {layout === "strip" && <p className="mt-2 text-[9px] text-muted-foreground">DAZZ LAB · 26 ── 冲印 · PROCESS C-41</p>}
      </div>
    </div>
  );
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function PosterTemplate({ url, palette }: { url: string; palette: string[] }) {
  const c1 = palette[0]!, c2 = palette[1] ?? c1;
  return (
    <div className="rounded-xl bg-card px-6 py-6 text-center shadow-sm">
      <p className="font-serif text-[22px] font-black tracking-[0.4em]" style={{ color: c1 }}>DARKROOM</p>
      <p className="mb-4 font-mono text-[9px] tracking-[0.3em] text-muted-foreground">VOL.01 · 暗房来信</p>
      <img src={url} alt="成品照片" className="mx-auto max-h-[46dvh] max-w-full shadow-md" />
      <p className="mt-4 font-mono text-[12px] tracking-widest" style={{ color: c2 }}>{today()}</p>
      <p className="mt-1 font-serif text-[13px]">光落下来的那一刻，刚好被留住。</p>
    </div>
  );
}

function JournalTemplate({ url, analysis, items, onChange }: { url: string; analysis: Analysis; items: Placed[]; onChange: (p: Placed[]) => void }) {
  const [text, setText] = useState(analysis.keywords[0] ? `今天的${analysis.keywords[0].label}，记下来～` : "今天也好好生活～");
  const ink = inkColor(analysis.palette);
  return (
    <div>
      <StickerBoard
        items={items}
        onChange={onChange}
        className="rounded-xl px-8 pt-8 pb-4"
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-xl bg-card"
          style={{ backgroundImage: "repeating-linear-gradient(180deg, transparent 0 27px, color-mix(in oklab, var(--ai) 35%, transparent) 27px 28px)", boxShadow: "inset 26px 0 0 -25px color-mix(in oklab, var(--destructive) 60%, transparent)" }}
        />
        <div className="relative mx-auto w-[78%] rotate-[-3deg] bg-background p-2 pb-6 shadow-md">
          <span className="absolute -top-2 left-1/2 h-4 w-14 -translate-x-1/2 rotate-2 bg-pro/40" />
          <img src={url} alt="成品照片" className="pointer-events-none w-full" />
        </div>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="手帐文字"
          className="relative mt-4 w-full bg-transparent text-center font-hand text-[22px] outline-none"
          style={{ color: ink }}
        />
        <p className="relative text-right font-hand text-[15px]" style={{ color: ink }}>{today()}</p>
      </StickerBoard>
      <p className="mt-2 flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
        点贴纸可替换 · 拖动可移动 · 点文字可编辑 · 进阶手绘贴纸包 <ProMark />
      </p>
    </div>
  );
}

function CollageTemplate({ url, items, onChange }: { url: string; items: Placed[]; onChange: (p: Placed[]) => void }) {
  return (
    <div>
      <StickerBoard items={items} onChange={onChange} className="overflow-hidden rounded-xl">
        <img src={url} alt="成品照片" className="pointer-events-none block w-full" />
      </StickerBoard>
      <p className="mt-2 flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
        点贴纸可替换 · 拖动可移动 · 进阶贴纸风格 <ProMark />
      </p>
    </div>
  );
}
