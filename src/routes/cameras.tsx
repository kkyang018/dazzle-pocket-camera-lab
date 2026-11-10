import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CameraCard } from "@/components/app/camera-card";
import { PRO_HINT } from "@/components/app/marks";
import { PhotoPreview } from "@/components/app/photo-preview";
import { usePhotoBase } from "@/hooks/use-photo-base";
import { useApp } from "@/lib/app-state";
import {
  CAMERAS,
  CATEGORIES,
  getCamera,
  orderCameras,
  recommend,
  scoreCamera,
  type CameraCategory,
} from "@/lib/cameras";
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
  const { photo, cameraId, setCameraId, pinned, togglePin, showHint } = useApp();
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

  if (!photo) {
    return (
      <main className="flex min-h-[calc(100dvh-5rem)] flex-col items-center justify-center px-8 text-center">
        <p className="font-serif text-lg">还没有选照片</p>
        <p className="mt-1.5 text-xs text-muted-foreground">先回 Lab 选一张，再来挑相机</p>
        <Link to="/" className="mt-6 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
          去选照片
        </Link>
      </main>
    );
  }

  return (
    <main className="flex h-[calc(100dvh-4.5rem-env(safe-area-inset-bottom))] flex-col overflow-hidden px-5 pt-[max(env(safe-area-inset-top),0.75rem)]">
      {/* 常驻、克制的 Pro 横条 */}
      <button
        type="button"
        onClick={() => showHint(PRO_HINT, "pro")}
        className="flex h-8 w-full shrink-0 items-center justify-between rounded-full border border-pro/30 bg-pro/[0.07] px-3 text-[11px] text-foreground/85"
      >
        <span className="flex items-center gap-1.5">
          <span className="inline-grid size-3.5 place-items-center rounded-full border-[1.5px] border-pro font-mono text-[7.5px] font-semibold text-pro">
            P
          </span>
          <span className="font-mono tracking-wide">Dazz Pro</span>
          <span className="text-muted-foreground">·</span>
          <span>解锁全部相机</span>
        </span>
        <ChevronRight className="size-3.5 text-pro" />
      </button>

      <header className="mt-2 flex shrink-0 items-center justify-between">
        <Link
          to="/"
          className="-ml-2 flex items-center gap-0.5 rounded-full px-2 py-1 font-mono text-[11px] text-muted-foreground"
        >
          <ChevronLeft className="size-4" />
          换照片
        </Link>
        <h1 className="font-serif text-lg font-bold">相机陈列</h1>
        <span className="w-14 text-right font-mono text-[10px] tracking-[0.18em] text-muted-foreground">02</span>
      </header>

      <PhotoPreview
        photo={photo}
        base={base?.canvas ?? null}
        preset={camera?.preset ?? null}
        className="mt-2 min-h-0 flex-1 max-h-[380px]"
      />

      <div role="tablist" aria-label="相机分类" className="mt-3 shrink-0 flex gap-5 border-b border-hairline">
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
            {c.label}
          </button>
        ))}
      </div>

      <div
        key={tab}
        role="tabpanel"
        aria-label={CATEGORIES.find((c) => c.id === tab)?.label}
        className="scrollbar-none -mx-5 mt-2 flex shrink-0 snap-x scroll-px-5 gap-2.5 overflow-x-auto px-5 py-1"
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
              if (c.pro) showHint(PRO_HINT, "pro");
            }}
            onTogglePin={() => {
              const now = togglePin(c.id);
              showHint(now ? `已置顶 · ${c.name}` : `已取消置顶 · ${c.name}`);
            }}
          />
        ))}
      </div>

      <p className="mt-1.5 text-center font-mono text-[10px] leading-relaxed text-muted-foreground">
        长按相机置顶 · 长按照片看原图
        <br />暗房里可以加闪光灯 · 调曝光和色温 · 显影
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
              进入暗房
              <span className="font-mono text-[11px] opacity-70">· {camera.name}</span>
            </>
          ) : (
            "先选一台相机"
          )}
        </button>
      </div>
    </main>
  );
}
