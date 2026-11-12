import type { AlbumItem } from "@/lib/app-state";
import { openSaveSheet } from "@/components/app/save-sheet";
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

/** 导出用原图重新渲染；edge 可以按模板实际需要的尺寸给小一点，省内存（手机上更稳） */
export function exportSource(item: AlbumItem, bare = false, edge = EXPORT_EDGE) {
  return developed(item, edge, bare);
}

/** 照片从印样台删掉后，释放它的显影缓存 */
export function forgetDeveloped(id: number) {
  for (const key of [...cache.keys()]) if (key.startsWith(`${id}:`)) cache.delete(key);
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

const toFile = (canvas: HTMLCanvasElement, name: string) =>
  new Promise<File>((res, rej) =>
    canvas.toBlob((b) => (b ? res(new File([b], name, { type: "image/jpeg" })) : rej(new Error("encode"))), "image/jpeg", 0.92));

/** 直接下载一个文件：隐藏的 <a download>，留在当前页面，不弹系统分享面板、不跳页 */
function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** 手机（触屏）：直接下载会跳到文件预览页，所以改为在当前页弹保存面板 */
const isTouch = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

/** 一次保存多张：手机弹保存面板；电脑逐张直接下载（间隔一点，避免浏览器把连续下载拦掉） */
export async function saveCanvases(list: { canvas: HTMLCanvasElement; name: string }[]) {
  const files = await Promise.all(list.map(({ canvas, name }) => toFile(canvas, name)));
  if (isTouch()) {
    openSaveSheet(files);
    return "sheet" as const;
  }
  files.forEach((f, i) => setTimeout(() => download(f), i * 300));
  return "downloaded" as const;
}

/** 保存一张：手机弹保存面板（点按钮存进相册 / 长按保存，不跳页）；电脑一步直接下载 */
export async function saveCanvas(canvas: HTMLCanvasElement, name: string) {
  return saveCanvases([{ canvas, name }]);
}
