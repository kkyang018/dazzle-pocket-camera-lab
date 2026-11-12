import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CameraCard } from "@/components/app/camera-card";
import { proHint } from "@/components/app/marks";
import { PhotoPreview } from "@/components/app/photo-preview";
import { usePhotoBase } from "@/hooks/use-photo-base";
import { useApp } from "@/lib/app-state";
import {
  CAMERAS,
  CATEGORIES,
  cameraName,
  categoryLabel,
  getCamera,
  orderCameras,
  recommend,
  scoreCamera,
  type CameraCategory,
} from "@/lib/cameras";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cameras")({
  head: () => ({
    meta: [
      { title: "相机陈列 · Dazz Lab" },
      { name: "description", content: "为你的照片挑一台复古相机：胶片、CCD、拍立得，实时预览效果。" },
      { property: "og:title", content: "相机陈列 · Dazz Lab" },
      { property: "og:description", content: "胶片、CCD、拍立得，实时预览每台相机的效果。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CamerasPage,
});

function CamerasPage() {
  const { photo, cameraId, setCameraId, pinned, togglePin, showHint, lang } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const base = usePhotoBase(photo);
  const camera = getCamera(cameraId);
  const [tab, setTab] = useState<CameraCategory>(camera?.category ?? "film");

  const stats = base?.stats ?? null;
  const recommendedIds = useMemo(() => {
    if (!stats) return new Set<string>();
    const scores = Object.fromEntries(CAMERAS.map((c) => [c.id, scoreCamera(c.likes, stats)]));
    return new Set(
      CATEGORIES.flatMap((cat) => recommend(CAMERAS.filter((c) => c.category === cat.id), scores)),
    );
  }, [stats]);

  const row = useMemo(() => {
    const inTab = CAMERAS.filter((c) => c.category === tab);
    const recInTab = inTab.filter((c) => recommendedIds.has(c.id));
    // 推荐内部按分数排序
    if (stats) recInTab.sort((a, b) => scoreCamera(b.likes, stats) - scoreCamera(a.likes, stats));
    return orderCameras(inTab, recInTab.map((c) => c.id), pinned);
  }, [tab, recommendedIds, pinned, stats]);

  // 照片分析完成后推荐相机会插到最前面，浏览器的滚动锚定会把整排往右推，
  // 导致第一台（AI 推荐）被挡在左边看不到。排序变化时回到开头。
  const rowRef = useRef<HTMLDivElement>(null);
  const rowKey = row.map((c) => c.id).join(",");
  useLayoutEffect(() => {
    if (rowRef.current) rowRef.current.scrollLeft = 0;
  }, [rowKey]);

  // 还没选相机时，自动选上当前分类里排第一的 AI 推荐，预览马上就有效果，也能直接进暗房
  useEffect(() => {
    if (!cameraId && stats && row[0]) setCameraId(row[0].id);
  }, [cameraId, stats, row, setCameraId]);

  if (!photo) {
    return (
      <main className="flex min-h-[calc(100dvh-5rem)] flex-col items-center justify-center px-8 text-center">
        <p className="font-serif text-lg">{t("还没有选照片", "No photo yet")}</p>
        <p className="mt-1.5 text-xs text-muted-foreground">{t("先回 Lab 选一张，再来挑相机", "Pick one in Lab first, then choose a camera")}</p>
        <Link to="/" className="mt-6 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
          {t("去选照片", "Choose a photo")}
        </Link>
      </main>
    );
  }

  return (
    <main className="flex h-[calc(100dvh-4.5rem-env(safe-area-inset-bottom))] flex-col overflow-hidden px-5 pt-[max(env(safe-area-inset-top),0.75rem)]">
      {/* 常驻、克制的 Pro 横条 */}
      <button
        type="button"
        onClick={() => showHint(proHint(lang), "pro")}
        className="flex h-8 w-full shrink-0 items-center justify-between rounded-full border border-pro/30 bg-pro/[0.07] px-3 text-[11px] text-foreground/85"
      >
        <span className="flex items-center gap-1.5">
          <span className="inline-grid size-3.5 place-items-center rounded-full border-[1.5px] border-pro font-mono text-[7.5px] font-semibold text-pro">
            P
          </span>
          <span className="font-mono tracking-wide">Dazz Pro</span>
          <span className="text-muted-foreground">·</span>
          <span>{t("解锁全部相机", "Unlock all cameras")}</span>
        </span>
        <ChevronRight className="size-3.5 text-pro" />
      </button>

      <header className="mt-2 flex shrink-0 items-center justify-between">
        <Link
          to="/"
          className="-ml-2 flex items-center gap-0.5 rounded-full px-2 py-1 font-mono text-[11px] text-muted-foreground"
        >
          <ChevronLeft className="size-4" />
          {t("换照片", "Change photo")}
        </Link>
        <h1 className="font-serif text-lg font-bold">{t("相机陈列", "Cameras")}</h1>
        <span className="w-14 text-right font-mono text-[10px] tracking-[0.18em] text-muted-foreground">02</span>
      </header>

      <PhotoPreview
        photo={photo}
        base={base?.canvas ?? null}
        preset={camera?.preset ?? null}
        className="mt-2 min-h-0 flex-1 max-h-[460px]"
      />

      <div role="tablist" aria-label={t("相机分类", "Camera types")} className="mt-3 shrink-0 flex gap-5 border-b border-hairline">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={tab === c.id}
            onClick={() => setTab(c.id)}
            className={cn(
              "-mb-px border-b-2 pb-2 text-sm transition-colors",
              tab === c.id ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground",
            )}
          >
            {categoryLabel(c.id, lang)}
          </button>
        ))}
      </div>

      <div
        key={tab}
        ref={rowRef}
        role="tabpanel"
        aria-label={categoryLabel(tab, lang)}
        className="scrollbar-none -mx-5 mt-2 flex shrink-0 snap-x scroll-px-5 gap-2.5 overflow-x-auto px-5 py-1 [overflow-anchor:none]"
      >
        {row.map((c) => (
          <CameraCard
            key={c.id}
            camera={c}
            selected={c.id === cameraId}
            recommended={recommendedIds.has(c.id)}
            pinned={pinned.includes(c.id)}
            onSelect={() => {
              setCameraId(c.id);
              if (c.pro) showHint(proHint(lang), "pro");
            }}
            onTogglePin={() => {
              const now = togglePin(c.id);
              showHint(now ? t(`已置顶 · ${c.name}`, `Pinned · ${cameraName(c, "en")}`) : t(`已取消置顶 · ${c.name}`, `Unpinned · ${cameraName(c, "en")}`));
            }}
          />
        ))}
      </div>

      <p className="mt-1.5 text-center font-mono text-[10px] leading-relaxed text-muted-foreground">
        {t("长按相机置顶 · 长按照片看原图", "Hold a camera to pin · hold the photo to see the original")}
      </p>

      <div className="shrink-0 pt-2.5 pb-2">
        <button
          type="button"
          disabled={!camera}
          onClick={() => navigate({ to: "/darkroom" })}
          className="flex h-13 w-full items-center justify-center gap-2 rounded-full bg-primary text-[15px] font-medium text-primary-foreground shadow-glow-amber transition-all active:scale-[0.98] disabled:bg-surface-raised disabled:text-muted-foreground disabled:shadow-none"
        >
          {camera ? (
            <>
              {t("进入暗房", "Enter darkroom")}
              <span className="font-mono text-[11px] opacity-70">· {cameraName(camera, lang)}</span>
            </>
          ) : (
            t("先选一台相机", "Pick a camera first")
          )}
        </button>
        {camera && (
          <p className="mt-1.5 text-center font-mono text-[10px] text-muted-foreground">{t("暗房里可以调曝光和色温 · AI 建议 · 显影", "Darkroom: exposure & temperature · AI tips · develop")}</p>
        )}
      </div>
    </main>
  );
}
