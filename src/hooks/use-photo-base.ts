import { useEffect, useState } from "react";
import type { PhotoStats } from "@/lib/cameras";
import type { Photo } from "@/lib/photo";
import { PREVIEW_EDGE, analyze, loadImage, scaleToCanvas } from "@/lib/render";

type Base = { canvas: HTMLCanvasElement; stats: PhotoStats };

// 同一张照片只缩放、分析一次（只在内存里）
let cache: { src: string; promise: Promise<Base> } | null = null;

function getBase(src: string) {
  if (cache?.src !== src) {
    cache = {
      src,
      promise: loadImage(src).then((img) => {
        const canvas = scaleToCanvas(img, PREVIEW_EDGE);
        return { canvas, stats: analyze(canvas) };
      }),
    };
  }
  return cache.promise;
}

/** 照片的长边 1080 预览底图 + 画面特征 */
export function usePhotoBase(photo: Photo | null) {
  const [base, setBase] = useState<Base | null>(null);
  useEffect(() => {
    if (!photo) {
      setBase(null);
      return;
    }
    let alive = true;
    getBase(photo.src).then(
      (b) => alive && setBase(b),
      () => alive && setBase(null),
    );
    return () => {
      alive = false;
    };
  }, [photo]);
  return base;
}
