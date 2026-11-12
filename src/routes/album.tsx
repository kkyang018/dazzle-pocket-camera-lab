import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Aperture, Check, ChevronLeft, Download, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApproxTag } from "@/components/app/marks";
import { editKey, useApp, type AlbumItem } from "@/lib/app-state";
import { CAMERAS, cameraName, getCamera } from "@/lib/cameras";
import { useT } from "@/lib/i18n";
import { photoFromFile } from "@/lib/photo";
import { exportSource, saveCanvases, thumbnail } from "@/lib/templates/sources";
import { cn } from "@/lib/utils";

const MAX_SELECT = 4;

export const Route = createFileRoute("/album")({
  head: () => ({
    meta: [
      { title: "印样台 · Dazz Lab" },
      { name: "description", content: "陈列所有显影好的照片，选 1–4 张做成手绘单张、半格、拍立得或拼图成品。" },
      { property: "og:title", content: "印样台 · Dazz Lab" },
      { property: "og:description", content: "陈列所有显影好的照片，选 1–4 张做成成品。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AlbumPage,
});

function AlbumPage() {
  const { album, addToAlbum, removeFromAlbum, undoRemove, selection, setSelection, showHint, setPhoto, setCameraId, saveEdit, setRewashId, lang } = useApp();
  const t = useT();
  // 印样台卡片上的名字：相机名按当前语言显示；没有相机的是样片 / 原片
  const itemName = (a: AlbumItem) => {
    const cam = getCamera(a.cameraId) ?? CAMERAS.find((c) => c.name === a.cameraName);
    if (cam) return cameraName(cam, lang);
    return a.cameraName ?? (a.photo.origin === "sample" ? t("样片", "Sample") : t("原片", "Original"));
  };
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  // 缩略图按"这张照片 + 它当前的显影效果"缓存：重新冲洗后会自动换新
  const [thumbs, setThumbs] = useState<Record<number, { look: AlbumItem["look"]; url: string }>>({});
  const [saving, setSaving] = useState(false);
  // 刚删掉的照片：几秒内可以撤销
  const [undo, setUndo] = useState<{ items: AlbumItem[]; key: number } | null>(null);

  useEffect(() => {
    album.filter((a) => thumbs[a.id]?.look !== a.look).forEach((a) =>
      thumbnail(a).then((url) => setThumbs((t) => ({ ...t, [a.id]: { look: a.look, url } })), () => undefined));
  }, [album, thumbs]);
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 6000);
    return () => clearTimeout(t);
  }, [undo]);

  const remove = (ids: number[]) => {
    const items = removeFromAlbum(ids);
    if (items.length) setUndo({ items, key: Date.now() });
  };

  /** 回暗房重新冲洗：显影过的直接回到原来的相机和调整，原片先去选相机 */
  const rewash = (item: AlbumItem) => {
    setPhoto(item.photo);
    setRewashId(item.id > 0 ? item.id : null);
    const cam = getCamera(item.cameraId) ?? CAMERAS.find((c) => c.name === item.cameraName) ?? null;
    if (cam) {
      setCameraId(cam.id);
      if (item.edit) saveEdit(editKey(item.photo.src, cam.id), item.edit);
      navigate({ to: "/darkroom" });
    } else {
      navigate({ to: "/cameras" });
    }
  };

  const toggle = (item: AlbumItem) => {
    if (selection.includes(item.id)) setSelection(selection.filter((x) => x !== item.id));
    else if (selection.length >= MAX_SELECT) showHint(t(`最多选 ${MAX_SELECT} 张`, `Up to ${MAX_SELECT} photos`));
    else setSelection([...selection, item.id]);
  };

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const f of files) {
      try {
        addToAlbum({ photo: await photoFromFile(f), look: null, cameraName: null, category: null });
      } catch {
        showHint(t("有一张照片读不出来", "One photo couldn't be read"));
      }
    }
  }

  const live = selection.filter((id) => album.some((a) => a.id === id));
  const picked = live.map((id) => album.find((a) => a.id === id)!);

  async function saveSelected() {
    setSaving(true);
    try {
      const list = await Promise.all(picked.map(async (a, i) => ({ canvas: await exportSource(a), name: `dazzlab-${Date.now()}-${i + 1}.jpg` })));
      if ((await saveCanvases(list)) === "downloaded") showHint(t(`已保存 ${list.length} 张`, `Saved ${list.length}`));
    } catch {
      showHint(t("保存失败，再试一次", "Save failed — try again"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="theme-warm min-h-[calc(100dvh-4rem)] px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-32">
      <header className="flex items-end justify-between">
        <div>
          {/* 固定回 Lab：用 history.back 会和成品页的「印样台」互相跳成死循环 */}
          <Link to="/" className="-ml-2 mb-1 flex w-fit items-center gap-0.5 px-2 py-1 font-mono text-[11px] text-muted-foreground">
            <ChevronLeft className="size-4" /> Lab
          </Link>
          <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Contact sheet · {album.length}</p>
          <h1 className="mt-1 font-serif text-[28px] font-black leading-none">{t("印样台", "Prints")}</h1>
        </div>
        <button type="button" onClick={() => input.current?.click()}
          className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-[12px]">
          <ImagePlus className="size-3.5" /> {t("导入", "Import")}
        </button>
        <input ref={input} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden onChange={onFile} />
      </header>

      <ul className="mt-4 grid grid-cols-3 gap-1.5">
        {album.map((a) => {
          const idx = live.indexOf(a.id);
          return (
            <li key={a.id}>
              <button type="button" onClick={() => toggle(a)} aria-pressed={idx >= 0} aria-label={`${itemName(a)}${idx >= 0 ? t(" 已选", ", selected") : ""}`}
                className={cn("relative block aspect-[3/4] w-full overflow-hidden bg-muted transition-transform active:scale-[0.97]", idx >= 0 && "ring-2 ring-primary ring-offset-2 ring-offset-background")}>
                {thumbs[a.id] && <img src={thumbs[a.id]!.url} alt="" className="size-full object-cover" />}
                <span className={cn("absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full border font-mono text-[10px]",
                  idx >= 0 ? "border-primary bg-primary text-primary-foreground" : "border-background/80 bg-foreground/20")}>
                  {idx >= 0 ? idx + 1 : ""}
                </span>
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/60 to-transparent px-1.5 pt-4 pb-1 text-left font-mono text-[9px] text-background">
                  {itemName(a)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {album.some((a) => a.look && a.photo.origin === "album") && <ApproxTag className="mt-3" />}

      <div className="fixed inset-x-0 bottom-20 z-30 mx-auto flex w-full max-w-[390px] flex-col items-center gap-2 px-4">
        {undo && (
          <div role="status" className="flex w-full items-center justify-between rounded-full bg-foreground px-4 py-2 text-[13px] text-background shadow-lg">
            <span>{t(`已删除 ${undo.items.length} 张`, `Deleted ${undo.items.length}`)}</span>
            <button type="button" onClick={() => { undoRemove(undo.items); setSelection(undo.items.map((x) => x.id)); setUndo(null); }}
              className="font-medium text-primary">{t("撤销", "Undo")}</button>
          </div>
        )}
        {live.length > 0 ? (
          <div className="flex w-full gap-2">
            {/* id > 0 是显影/导入的照片（可删）；内置样片 id < 0，不可删 */}
            {picked.some((a) => a.id > 0) && (
              <button type="button" aria-label={t("从印样台删除", "Delete from Prints")} onClick={() => remove(picked.filter((a) => a.id > 0).map((a) => a.id))}
                className="grid size-12 shrink-0 place-items-center rounded-full bg-card text-foreground shadow-lg">
                <Trash2 className="size-4" />
              </button>
            )}
            <button type="button" onClick={saveSelected} disabled={saving} aria-label={t("保存到手机相册", "Save to photo library")}
              className="flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-card px-4 text-[13px] font-medium text-foreground shadow-lg disabled:opacity-60">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} {t("保存", "Save")}
            </button>
            {/* 选 1 张：回暗房重新冲洗（显影过的回到原来的相机和调整） */}
            {live.length === 1 && (
              <button type="button" onClick={() => rewash(picked[0]!)}
                className="flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-card px-4 text-[13px] font-medium text-foreground shadow-lg">
                <Aperture className="size-4" /> {t("冲洗", "Develop")}
              </button>
            )}
            <button type="button" onClick={() => navigate({ to: "/result" })}
              className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-primary py-3 text-[13px] font-medium text-primary-foreground shadow-lg">
              <Check className="size-4" /> {t("做成品", "Create")} · {live.length}
            </button>
          </div>
        ) : (
          <Link to="/" className="rounded-full bg-foreground/80 px-4 py-2 text-[12px] text-background">{t("去 Lab 冲洗新照片", "Develop a new photo in Lab")}</Link>
        )}
      </div>
    </main>
  );
}
