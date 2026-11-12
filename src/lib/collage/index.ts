// 无贴纸拼图：双图竖排 / 三图竖排 / 四张竖图 2×2。
// 三种版式共用一套渲染：模糊颗粒的照片背景 + 只裁剪不加工的前景照片。
// 所有尺寸都按画布比例换算，预览（1080×1440）和导出（3000×4000）完全一致。
import { grain, type Ctx, type Img } from "@/lib/templates/draw";

export type Rect = { x: number; y: number; w: number; h: number };

/** 版式参数（比例都相对画布宽 / 高） */
export type CollageLayout = {
  cols: number;
  rows: number;
  /** 单张槽位比例 宽:高 */
  slot: [number, number];
  /** 单张宽度 / 画布宽度 */
  width: number;
  /** 横向间距 / 画布宽度 */
  gapX: number;
  /** 纵向间距 / 画布高度 */
  gapY: number;
};

/** 画布比例 宽:高 */
export const COLLAGE_CANVAS: [number, number] = [3, 4];

export const COLLAGE_LAYOUTS: Record<2 | 3 | 4, CollageLayout> = {
  2: { cols: 1, rows: 2, slot: [3, 2], width: 0.54, gapX: 0, gapY: 0.08 },
  3: { cols: 1, rows: 3, slot: [3, 2], width: 0.41, gapX: 0, gapY: 0.04 },
  // 768×1024 基准：横向约 45px（5.9%），纵向 35px（3.42%）
  4: { cols: 2, rows: 2, slot: [3, 4], width: 0.29, gapX: 0.059, gapY: 0.0342 },
};

/** 背景效果参数 */
export type BackgroundFx = {
  /** 背景比画布再放大一点，避免模糊后边缘露底 */
  overscale: number;
  /** 先缩到多小再放大（越小越糊），相对画布宽度 */
  downscale: number;
  /** 左右运动模糊的拖影长度，相对画布宽度 */
  motion: number;
  /** 拖影叠加次数 */
  motionSteps: number;
  /** 胶片颗粒强度 */
  grain: number;
  /** 哑光：整体轻微提亮压对比 */
  matte: number;
};

export const COLLAGE_BG: BackgroundFx = { overscale: 1.32, downscale: 1 / 14, motion: 0.09, motionSteps: 24, grain: 0.11, matte: 0.07 };

const n4 = (n: number) => Math.max(2, Math.min(4, n)) as 2 | 3 | 4;

/** 各槽位位置：整组水平、垂直居中；双图/三图从上到下，四宫格左上、右上、左下、右下 */
export function collageRects(W: number, H: number, n: number, layout = COLLAGE_LAYOUTS[n4(n)]): Rect[] {
  const w = W * layout.width, h = (w * layout.slot[1]) / layout.slot[0];
  const gx = W * layout.gapX, gy = H * layout.gapY;
  const totalW = layout.cols * w + (layout.cols - 1) * gx, totalH = layout.rows * h + (layout.rows - 1) * gy;
  const x0 = (W - totalW) / 2, y0 = (H - totalH) / 2;
  return Array.from({ length: layout.cols * layout.rows }, (_, i) => ({
    x: x0 + (i % layout.cols) * (w + gx),
    y: y0 + Math.floor(i / layout.cols) * (h + gy),
    w, h,
  }));
}

/** 取景：cx/cy = 多出来的那部分里偏向哪边（0–1），zoom ≥ 1（1 = 刚好铺满槽位） */
export type Crop = { cx: number; cy: number; zoom: number };
export const MAX_ZOOM = 3;

export const clampCrop = (c: Crop): Crop => ({
  cx: Math.min(1, Math.max(0, c.cx)),
  cy: Math.min(1, Math.max(0, c.cy)),
  zoom: Math.min(MAX_ZOOM, Math.max(1, c.zoom)),
});

/** 槽位里原图显示的尺寸和偏移（等比铺满，再按 zoom 放大） */
export function coverGeometry(img: { width: number; height: number }, r: Rect, c: Crop) {
  const k = Math.max(r.w / img.width, r.h / img.height) * c.zoom;
  const dw = img.width * k, dh = img.height * k;
  return { k, dw, dh, ex: dw - r.w, ey: dh - r.h };
}

/** 初始取景：让主体（人脸等）落在槽位里，竖向放在上 40% 左右 */
export function initialCrop(img: { width: number; height: number }, r: Rect, focus: [number, number] | null): Crop {
  if (!focus) return { cx: 0.5, cy: 0.5, zoom: 1 };
  const g = coverGeometry(img, r, { cx: 0.5, cy: 0.5, zoom: 1 });
  const cx = g.ex > 0 ? (focus[0] * g.dw - r.w / 2) / g.ex : 0.5;
  const cy = g.ey > 0 ? (focus[1] * g.dh - r.h * 0.4) / g.ey : 0.5;
  return clampCrop({ cx, cy, zoom: 1 });
}

/** 只裁剪：原图像素不做任何处理 */
function drawCropped(ctx: Ctx, img: Img, r: Rect, c: Crop) {
  const g = coverGeometry(img, r, c);
  const sx = (g.ex * c.cx) / g.k, sy = (g.ey * c.cy) / g.k;
  ctx.drawImage(img, sx, sy, r.w / g.k, r.h / g.k, r.x, r.y, r.w, r.h);
}

/**
 * 拍立得：整张相纸不裁剪，按原比例放在槽位中心，面积和普通照片差不多；
 * 但不能盖到相邻的照片上（最多伸进间距的 40%）。
 */
export function polaroidRect(slot: Rect, card: { width: number; height: number }, gap: { x: number; y: number }): Rect {
  const ar = card.width / card.height;
  let w = Math.sqrt(slot.w * slot.h * ar), h = w / ar;
  const maxW = slot.w + gap.x * 0.8, maxH = slot.h + gap.y * 0.8;
  const s = Math.min(1, maxW / w, maxH / h);
  w *= s; h *= s;
  return { x: slot.x + (slot.w - w) / 2, y: slot.y + (slot.h - h) / 2, w, h };
}

/** 照片"适不适合做背景"的分数：颜色明显、明暗适中、层次丰富的更好 */
export function backgroundScore(img: Img) {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, 32, 32);
  const d = g.getImageData(0, 0, 32, 32).data;
  let sat = 0, l = 0, l2 = 0;
  const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]! / 255, gg = d[i + 1]! / 255, b = d[i + 2]! / 255;
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
    sat += mx === 0 ? 0 : (mx - mn) / mx;
    const ll = 0.299 * r + 0.587 * gg + 0.114 * b;
    l += ll; l2 += ll * ll;
  }
  const mean = l / n, std = Math.sqrt(Math.max(0, l2 / n - mean * mean));
  return (sat / n) * 1.0 + (1 - Math.abs(mean - 0.55) * 2) * 0.5 + Math.min(std, 0.3) * 1.2;
}

export function pickBackground(imgs: Img[]) {
  let best = 0, score = -Infinity;
  imgs.forEach((im, i) => { const s = backgroundScore(im); if (s > score) { score = s; best = i; } });
  return best;
}

/**
 * 背景：照片放大铺满 → 缩小（相当于强高斯模糊，各浏览器都支持）→ 左右运动模糊
 * → 分两步放大回来（避免马赛克/横条）→ 均匀细颗粒 + 哑光。
 */
export function drawCollageBackground(ctx: Ctx, W: number, H: number, img: Img, fx: BackgroundFx = COLLAGE_BG) {
  const sw = Math.max(16, Math.round(W * fx.downscale)), sh = Math.max(16, Math.round(H * fx.downscale));
  // 铺满（再放大一点），只是背景用
  const k = Math.max(sw / img.width, sh / img.height) * fx.overscale;
  const dw = img.width * k, dh = img.height * k;

  // 左右拖影：逐次错位叠加取平均（放大后的边距比拖影长，边缘不会露空、也不会出现重影横条）
  const motion = document.createElement("canvas");
  motion.width = sw; motion.height = sh;
  const m = motion.getContext("2d")!;
  m.imageSmoothingQuality = "high";
  const span = Math.min(sw * fx.motion, (dw - sw) / 2);
  for (let i = 0; i < fx.motionSteps; i++) {
    const t = fx.motionSteps === 1 ? 0 : i / (fx.motionSteps - 1) - 0.5;
    m.globalAlpha = 1 / (i + 1);
    m.drawImage(img, (sw - dw) / 2 + t * span * 2, (sh - dh) / 2, dw, dh);
  }

  // 再柔化一次：缩一半再放回
  const half = document.createElement("canvas");
  half.width = Math.max(8, Math.round(sw / 2)); half.height = Math.max(8, Math.round(sh / 2));
  const hctx = half.getContext("2d")!;
  hctx.imageSmoothingQuality = "high";
  hctx.drawImage(motion, 0, 0, half.width, half.height);

  // 分两步放大到画布
  const mid = document.createElement("canvas");
  mid.width = Math.round(W / 4); mid.height = Math.round(H / 4);
  const mctx = mid.getContext("2d")!;
  mctx.imageSmoothingQuality = "high";
  mctx.drawImage(half, 0, 0, mid.width, mid.height);
  ctx.save();
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(mid, 0, 0, W, H);
  // 哑光：提亮暗部、压一点对比
  ctx.globalAlpha = fx.matte;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // 均匀细颗粒（只在背景上）
  grain(ctx, W, H, fx.grain, 11);
}

export type CollageInput = {
  /** 每个槽位的取景；null = 用初始取景 */
  crops: (Crop | null)[];
  /** 主体位置（0–1），用于初始取景 */
  focus: ([number, number] | null)[];
  /** 拍立得照片的整张相纸；有它时这一格不裁剪，直接放相纸 */
  framed: (Img | null)[];
  /** 用哪一张做背景（null = 自动挑） */
  background: number | null;
};

/** 每个槽位最终用的取景 */
export function slotCrop(input: CollageInput, img: Img, r: Rect, i: number): Crop {
  return input.crops[i] ?? initialCrop(img, r, input.focus[i] ?? null);
}

export function drawCollage(ctx: Ctx, W: number, H: number, imgs: Img[], input: CollageInput) {
  const n = n4(imgs.length);
  const bg = input.background ?? pickBackground(imgs.slice(0, n));
  drawCollageBackground(ctx, W, H, imgs[bg] ?? imgs[0]!);
  const layout = COLLAGE_LAYOUTS[n];
  const rects = collageRects(W, H, n, layout);
  imgs.slice(0, n).forEach((img, i) => {
    const r = rects[i]!;
    const card = input.framed[i];
    if (card) {
      const p = polaroidRect(r, card, { x: W * layout.gapX || W * 0.05, y: H * layout.gapY });
      ctx.drawImage(card, p.x, p.y, p.w, p.h);
    } else drawCropped(ctx, img, r, slotCrop(input, img, r, i));
  });
}
