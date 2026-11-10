import { useEffect, useRef, useState } from "react";
import { ApproxTag } from "@/components/app/marks";
import { useLongPress } from "@/hooks/use-long-press";
import type { Preset } from "@/lib/cameras";
import type { Photo } from "@/lib/photo";
import { renderWithPreset } from "@/lib/render";
import { cn } from "@/lib/utils";

/** 大预览：实时渲染当前相机效果；长按临时看原图。 */
export function PhotoPreview({
  photo,
  base,
  preset,
  className,
}: {
  photo: Photo;
  base: HTMLCanvasElement | null;
  preset: Preset | null;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const press = useLongPress({
    onLongPress: () => setShowOriginal(true),
    onRelease: () => setShowOriginal(false),
    delay: 300,
  });

  useEffect(() => {
    if (!base) return;
    const frame = requestAnimationFrame(() => {
      const out = preset ? renderWithPreset(base, preset) : base;
      const c = canvasRef.current;
      if (!c) return;
      c.width = out.width;
      c.height = out.height;
      c.getContext("2d")!.drawImage(out, 0, 0);
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [base, preset]);

  return (
    <div
      {...press}
      role="img"
      aria-label={showOriginal ? "原图" : preset ? "当前相机效果预览" : "照片预览"}
      className={cn(
        "touch-hold relative flex items-center justify-center overflow-hidden rounded-2xl bg-surface",
        className,
      )}
    >
      <canvas
        ref={canvasRef}
        className={cn(
          "max-h-full max-w-full object-contain shadow-[0_12px_40px_-12px_rgb(0_0_0/0.8)] transition-opacity duration-300",
          ready && !showOriginal ? "opacity-100" : "opacity-0",
        )}
      />
      {showOriginal && (
        <img
          src={photo.src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 m-auto max-h-full max-w-full object-contain"
        />
      )}
      <div className="pointer-events-none absolute top-2.5 right-2.5">
        {showOriginal ? (
          <span className="inline-flex items-center rounded-full bg-background/70 px-2 py-0.5 font-mono text-[10px] text-foreground backdrop-blur-sm">
            原图
          </span>
        ) : (
          preset && <ApproxTag />
        )}
      </div>
    </div>
  );
}
