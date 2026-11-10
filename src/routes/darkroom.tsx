import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { PhotoPreview } from "@/components/app/photo-preview";
import { usePhotoBase } from "@/hooks/use-photo-base";
import { useApp } from "@/lib/app-state";
import { getCamera } from "@/lib/cameras";

export const Route = createFileRoute("/darkroom")({
  head: () => ({
    meta: [
      { title: "暗房工作台 · Dazz Lab" },
      { name: "description", content: "在暗房工作台里调整照片的相机效果。" },
      { property: "og:title", content: "暗房工作台 · Dazz Lab" },
      { property: "og:description", content: "在暗房工作台里调整照片的相机效果。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DarkroomPage,
});

function DarkroomPage() {
  const { photo, cameraId } = useApp();
  const camera = getCamera(cameraId);
  const base = usePhotoBase(photo);

  return (
    <main className="theme-warm flex min-h-[calc(100dvh-5rem)] flex-col px-5 pt-[max(env(safe-area-inset-top),1rem)]">
      <header className="flex items-center justify-between">
        <Link
          to="/cameras"
          className="-ml-2 flex items-center gap-0.5 rounded-full px-2 py-1 font-mono text-[11px] text-muted-foreground"
        >
          <ChevronLeft className="size-4" />
          换相机
        </Link>
        <h1 className="font-serif text-lg font-bold">暗房工作台</h1>
        <span className="w-14 text-right font-mono text-[10px] tracking-[0.18em] text-muted-foreground">03</span>
      </header>

      {photo && camera ? (
        <>
          <PhotoPreview
            photo={photo}
            base={base?.canvas ?? null}
            preset={camera.preset}
            className="mt-4 h-[min(52dvh,440px)] bg-surface"
          />
          <p className="mt-3 text-center font-mono text-[11px] text-muted-foreground">{camera.name}</p>
          <div className="mt-6 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-hairline py-10 text-center">
            <p className="font-serif text-lg">工作台即将开放</p>
            <p className="mt-1.5 text-xs text-muted-foreground">下一步会在这里调整效果</p>
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="font-serif text-lg">还没选好照片和相机</p>
          <Link to="/" className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
            回到 Lab
          </Link>
        </div>
      )}
      <div className="h-6" />
    </main>
  );
}
