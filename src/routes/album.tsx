import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, ImagePlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApproxTag } from "@/components/app/marks";
import { useApp, type AlbumItem } from "@/lib/app-state";
import { photoFromFile, photoFromSample } from "@/lib/photo";
import { thumbnail } from "@/lib/templates/sources";
import { cn } from "@/lib/utils";
import sampleStreet from "@/assets/sample-street.jpg";
import samplePortrait from "@/assets/sample-portrait.jpg";
import sampleCafe from "@/assets/sample-cafe.jpg";

const MAX_SELECT = 4;

export const Route = createFileRoute("/album")({
  head: () => ({
    meta: [
      { title: "相册 · Dazz Lab" },
      { name: "description", content: "陈列所有显影好的照片，选 1–4 张做成胶片、拍立得或画报成品。" },
      { property: "og:title", content: "相册 · Dazz Lab" },
      { property: "og:description", content: "陈列所有显影好的照片，选 1–4 张做成成品。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AlbumPage,
});

const SAMPLES = [
  { src: sampleStreet, name: "海边小镇" },
  { src: samplePortrait, name: "公园笑脸" },
  { src: sampleCafe, name: "窗边咖啡" },
];
let seeding = false;

function AlbumPage() {
  const { album, addToAlbum, selection, setSelection, showHint } = useApp();
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [thumbs, setThumbs] = useState<Record<number, string>>({});

  // 样片只放一次（内存里）
  useEffect(() => {
    if (seeding || album.some((a) => a.photo.origin === "sample")) return;
    seeding = true;
    void (async () => {
      for (const s of [...SAMPLES].reverse()) {
        try {
          addToAlbum({ photo: await photoFromSample(s), look: null, cameraName: null, category: null });
        } catch { /* 跳过 */ }
      }
    })();
  }, [album, addToAlbum]);

  useEffect(() => {
    album.filter((a) => !thumbs[a.id]).forEach((a) =>
      thumbnail(a).then((url) => setThumbs((t) => ({ ...t, [a.id]: url })), () => undefined));
  }, [album, thumbs]);

  const toggle = (item: AlbumItem) => {
    if (selection.includes(item.id)) setSelection(selection.filter((x) => x !== item.id));
    else if (selection.length >= MAX_SELECT) showHint(`最多选 ${MAX_SELECT} 张`);
    else setSelection([...selection, item.id]);
  };

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const f of files) {
      try {
        addToAlbum({ photo: await photoFromFile(f), look: null, cameraName: null, category: null });
      } catch {
        showHint("有一张照片读不出来");
      }
    }
  }

  const live = selection.filter((id) => album.some((a) => a.id === id));

  return (
    <main className="theme-warm min-h-[calc(100dvh-4rem)] px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-32">
      <header className="flex items-end justify-between">
        <div>
          <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Contact sheet · {album.length}</p>
          <h1 className="mt-1 font-serif text-[28px] font-black leading-none">相册</h1>
        </div>
        <button type="button" onClick={() => input.current?.click()}
          className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-[12px]">
          <ImagePlus className="size-3.5" /> 导入
        </button>
        <input ref={input} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden onChange={onFile} />
      </header>
      <p className="mt-2 text-[12px] text-muted-foreground">轻点照片勾选 1–{MAX_SELECT} 张，做成成品。</p>

      <ul className="mt-4 grid grid-cols-3 gap-1.5">
        {album.map((a) => {
          const idx = live.indexOf(a.id);
          return (
            <li key={a.id}>
              <button type="button" onClick={() => toggle(a)} aria-pressed={idx >= 0} aria-label={`${a.cameraName ?? a.photo.name}${idx >= 0 ? " 已选" : ""}`}
                className={cn("relative block aspect-[3/4] w-full overflow-hidden bg-muted transition-transform active:scale-[0.97]", idx >= 0 && "ring-2 ring-primary ring-offset-2 ring-offset-background")}>
                {thumbs[a.id] && <img src={thumbs[a.id]} alt="" className="size-full object-cover" />}
                <span className={cn("absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full border font-mono text-[10px]",
                  idx >= 0 ? "border-primary bg-primary text-primary-foreground" : "border-background/80 bg-foreground/20")}>
                  {idx >= 0 ? idx + 1 : ""}
                </span>
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/60 to-transparent px-1.5 pt-4 pb-1 text-left font-mono text-[9px] text-background">
                  {a.cameraName ?? (a.photo.origin === "sample" ? "样片" : "原片")}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {album.some((a) => a.look && a.photo.origin === "album") && <ApproxTag className="mt-3" />}

      <div className="fixed inset-x-0 bottom-20 z-30 mx-auto flex w-full max-w-[390px] justify-center px-4">
        {live.length > 0 ? (
          <button type="button" onClick={() => navigate({ to: "/result" })}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 font-medium text-primary-foreground shadow-lg">
            <Check className="size-4" /> 做成成品 · 已选 {live.length} 张
          </button>
        ) : (
          <Link to="/" className="rounded-full bg-foreground/80 px-4 py-2 text-[12px] text-background">去 Lab 冲洗新照片</Link>
        )}
      </div>
    </main>
  );
}
