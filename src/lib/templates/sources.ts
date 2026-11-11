import type { AlbumItem } from "@/lib/app-state";
import { EXPORT_EDGE, PREVIEW_EDGE, loadImage, renderWithPreset, scaleToCanvas } from "@/lib/render";

// 相册照片的显影图：预览用长边 1080，导出用原图重新渲染（长边 ≤4000）。
const cache = new Map<string, Promise<HTMLCanvasElement>>();

/** bare = 去掉显影时烤进去的拍立得相纸边，成品模板自己画相纸/版式，避免双层边框 */
export function developed(item: AlbumItem, edge: number = PREVIEW_EDGE, bare = false) {
  const key = `${item.id}:${edge}:${bare}`;
  let p = cache.get(key);
  if (!p) {
    p = loadImage(item.photo.src).then((img) => {
      const base = scaleToCanvas(img, edge);
      const look = item.look && bare ? (({ frame: _f, ...rest }) => rest)(item.look) : item.look;
      return look ? renderWithPreset(base, look) : base;
    });
    if (edge === PREVIEW_EDGE) cache.set(key, p);
  }
  return p;
}

export function exportSource(item: AlbumItem, bare = false) {
  return developed(item, EXPORT_EDGE, bare);
}

export async function thumbnail(item: AlbumItem) {
  const c = await developed(item);
  const s = 360 / Math.max(c.width, c.height);
  const t = document.createElement("canvas");
  t.width = Math.round(c.width * s);
  t.height = Math.round(c.height * s);
  t.getContext("2d")!.drawImage(c, 0, 0, t.width, t.height);
  return t.toDataURL("image/jpeg", 0.85);
}

/** 一次保存多张：能分享就一起分享，否则逐张下载 */
export async function saveCanvases(list: { canvas: HTMLCanvasElement; name: string }[]) {
  const files = await Promise.all(list.map(({ canvas, name }) => new Promise<File>((res, rej) =>
    canvas.toBlob((b) => (b ? res(new File([b], name, { type: "image/jpeg" })) : rej(new Error("encode"))), "image/jpeg", 0.92))));
  if (navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files, title: "Dazz Lab" });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
    }
  }
  files.forEach((f, i) => setTimeout(() => {
    const url = URL.createObjectURL(f);
    const a = document.createElement("a");
    a.href = url;
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, i * 300));
  return "downloaded";
}

/** 保存到相册：优先系统分享（带文件），不支持时普通下载 */
export async function saveCanvas(canvas: HTMLCanvasElement, name: string) {
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.92));
  const file = new File([blob], name, { type: "image/jpeg" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Dazz Lab" });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "downloaded";
}
