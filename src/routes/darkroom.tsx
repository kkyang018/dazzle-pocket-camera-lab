import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { PhotoPreview } from "@/components/app/photo-preview";
import { usePhotoBase } from "@/hooks/use-photo-base";
import { useApp } from "@/lib/app-state";
import { useMemo, useState } from "react";
import { Zap, ZapOff } from "lucide-react";
import { AiBadge } from "@/components/app/marks";
import { flashStrength, getCamera, type FlashMode } from "@/lib/cameras";

const FLASH_OPTIONS: { id: FlashMode; label: string }[] = [
  { id: "off", label: "关闭" },
  { id: "auto", label: "自动" },
  { id: "on", label: "开启" },
];
const TONE_LABEL = { cool: "冷白直闪", warm: "暖金直闪", neutral: "中性直闪", soft: "柔光补闪" } as const;

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
  const [flash, setFlash] = useState<FlashMode>("auto");
  const lum = base?.stats.lum ?? 0.5;
  const strength = flashStrength(flash, lum);
  const aiWantsFlash = lum < 0.42 || camera?.flashTone === "cool";
  const preset = useMemo(
    () => (camera ? { ...camera.preset, flash: strength, flashTone: camera.flashTone } : null),
    [camera, strength],
  );

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
            preset={preset}
            className="mt-4 h-[min(52dvh,440px)] bg-surface"
          />
          <p className="mt-3 text-center font-mono text-[11px] text-muted-foreground">
            {camera.name} · {camera.tagline}
          </p>
          <section className="mt-5 rounded-2xl bg-surface p-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 font-serif text-base font-bold">
                {strength > 0 ? <Zap className="size-4 text-primary" /> : <ZapOff className="size-4 text-muted-foreground" />}
                闪光灯
              </h2>
              <span className="font-mono text-[10px] text-muted-foreground">{TONE_LABEL[camera.flashTone]}</span>
            </div>
            <div role="radiogroup" aria-label="闪光灯" className="mt-3 grid grid-cols-3 gap-1 rounded-full bg-background/60 p-1">
              {FLASH_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={flash === o.id}
                  onClick={() => setFlash(o.id)}
                  className={
                    "rounded-full py-1.5 font-mono text-xs transition-colors " +
                    (flash === o.id ? "bg-primary text-primary-foreground" : "text-muted-foreground")
                  }
                >
                  {o.label}
                </button>
              ))}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <AiBadge />
              {aiWantsFlash ? "AI 建议开启：这张照片适合直闪氛围" : "AI 建议关闭：光线充足，保留自然光更好看"}
              {flash === "auto" && <span className="font-mono">· 自动{strength > 0 ? "已打闪" : "未打闪"}</span>}
            </p>
          </section>
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
