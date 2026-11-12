import type { CameraCategory } from "@/lib/cameras";
import type { PuzzleAI, StickerFamily } from "./ai-types";
import { FONTS, cover, grain, rng, type Ctx, type Img } from "./draw";
import { drawSoloCard, type FrameKind } from "@/lib/solo/draw";
import type { SoloData } from "@/lib/solo/types";

export type { PuzzleAI, StickerFamily } from "./ai-types";
export type TemplateId = "solo" | "halfframe" | "polaroid" | "puzzle";
export type PolaroidFormat = "mini" | "square" | "wide";

export type TemplateOptions = {
  /** 拍立得：地点那一行 */
  caption: string;
  /** YYYY-MM-DD */
  date: string;
  /** 拍立得相纸：0 白边 1 黑边 */
  frame: number;
  format: PolaroidFormat;
  /** 半格：两张照片的横向裁切位置 0–1 */
  crops: [number, number];
  /** 半格：左右互换 */
  swap: boolean;
  /** 拼图贴纸族；null = 按照片自动选 */
  sticker: StickerFamily | null;
  /** 贴纸颜色；null = 按照片自动配 */
  stickerColor: string | null;
  /** 贴纸/手绘线随机排布 */
  seed: number;
  /** 拼图：每张照片裁切中心（可拖动）；null = 用 AI 主体位置 */
  pcrops: ([number, number] | null)[];
  /** 手绘单张：AI/本地计划 + 人物描边；null = 还在准备，只画照片 */
  solo: SoloData | null;
  /** 手绘单张：深色纸 */
  soloDark: boolean;
  /** 手绘单张：拍立得照片保留相纸（img 是整张相纸） */
  soloFrame: FrameKind | null;
  /** 拼图：AI 选的贴纸族/配色/主体位置 */
  puzzleAI: PuzzleAI | null;
};

export type TemplateDef = {
  id: TemplateId;
  name: string;
  en: string;
  min: number;
  max: number;
  pro?: boolean;
  ai?: boolean;
  /** 只有拍立得相机拍的照片能用 */
  instantOnly?: boolean;
  size: (o: TemplateOptions) => [number, number];
  draw: (ctx: Ctx, W: number, H: number, imgs: Img[], o: TemplateOptions) => void;
};

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
/** 2026-11-11 → "11 NOV 2026" */
export function stampText(date: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date.toUpperCase();
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? ""} ${m[1]}`;
}

// ── 颜色工具：从照片取色，供"看图配色"用 ─────────────────────────
type RGB = [number, number, number];
export function avgColor(img: Img): RGB {
  const c = document.createElement("canvas");
  c.width = c.height = 24;
  const g = c.getContext("2d")!;
  g.drawImage(img, 0, 0, 24, 24);
  const d = g.getImageData(0, 0, 24, 24).data;
  let r = 0, gg = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]!; gg += d[i + 1]!; b += d[i + 2]!; }
  const n = d.length / 4;
  return [r / n, gg / n, b / n];
}

/** 背景主色 → 有对比但温润的蜡笔色 */
export function contrastCrayon([r, g, b]: RGB): string {
  if (b >= r && b >= g) return "#E9D18B"; // 蓝紫暮色 → 黄油黄
  if (g > r && g >= b) return "#F2A38B"; // 绿色 → 珊瑚粉
  if (r + g + b < 200) return "#F3E3B5"; // 很暗 → 奶油
  return "#9CC7E0"; // 暖色 → 雾蓝
}
/** 自动选贴纸族：暗夜用星星，暖调人像感用爱心，其他用波点 */
export function autoSticker([r, g, b]: RGB): StickerFamily {
  const lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
  void lum;
  return "star"; // 参考样张：柔和黄油黄蜡笔星星
}

// ── 蜡笔笔触 ─────────────────────────────────────────────────────
function crayonStroke(ctx: Ctx, pts: [number, number][], color: string, w: number, seed: number, dash: "solid" | "dash" | "dot" = "solid") {
  const r = rng(seed);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (dash === "dash") ctx.setLineDash([w * 3.2, w * 2.4]);
  if (dash === "dot") ctx.setLineDash([0.1, w * 2.2]);
  for (let pass = 0; pass < 3; pass++) {
    ctx.globalAlpha = pass === 0 ? 0.85 : 0.35;
    ctx.lineWidth = w * (pass === 0 ? 1 : 0.55);
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      const jx = x + (r() - 0.5) * w * 0.5, jy = y + (r() - 0.5) * w * 0.5;
      if (i === 0) ctx.moveTo(jx, jy);
      else {
        const [px, py] = pts[i - 1]!;
        ctx.quadraticCurveTo(px, py, (px + jx) / 2, (py + jy) / 2);
      }
    });
    ctx.stroke();
  }
  ctx.restore();
}

// ── ① 手绘单张：原比例照片 + 蜡笔手绘（版式和图案见 src/lib/solo） ──────────
function drawSolo(ctx: Ctx, W: number, H: number, imgs: Img[], o: TemplateOptions) {
  drawSoloCard(ctx, W, H, imgs[0]!, o.solo, o.seed, { dark: o.soloDark, frame: o.soloFrame });
}

// ── ② 半格胶片：两张竖裁并排、满版、黑分隔条、轻颗粒偏暖 ───────────
function drawHalf(ctx: Ctx, W: number, H: number, imgs: Img[], o: TemplateOptions) {
  const gap = W * 0.045;
  ctx.fillStyle = "#0a0a09";
  ctx.fillRect(0, 0, W, H);
  const fw = (W - gap) / 2;
  const pair = o.swap ? [imgs[1]!, imgs[0]!] : [imgs[0]!, imgs[1]!];
  const crops = o.swap ? [o.crops[1], o.crops[0]] : o.crops;
  pair.forEach((img, i) => cover(ctx, img, i * (fw + gap), 0, fw, H, crops[i]));
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  ctx.fillStyle = "rgba(255,170,90,0.22)";
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  ctx.fillStyle = "#0a0a09";
  ctx.fillRect(fw, 0, gap, H);
  grain(ctx, W, H, 0.2);
}

// ── ③ 拍立得：干净相纸，底边居中日期章 + 地点 ──────────────────────
const POLAROID: Record<PolaroidFormat, { card: [number, number]; img: [number, number, number, number] }> = {
  // card 尺寸；照片 x,y,w,h（真实相纸比例放大）
  mini: { card: [1080, 1720], img: [80, 100, 920, 1240] },
  square: { card: [1080, 1290], img: [75, 90, 930, 930] },
  wide: { card: [1620, 1290], img: [67, 90, 1486, 930] },
};
function drawPolaroid(ctx: Ctx, W: number, H: number, imgs: Img[], o: TemplateOptions) {
  const spec = POLAROID[o.format];
  const s = W / spec.card[0];
  const dark = o.frame === 1;
  ctx.fillStyle = dark ? "#151413" : "#f8f6f1";
  ctx.fillRect(0, 0, W, H);
  const [x, y, w, h] = spec.img.map((v) => v * s) as [number, number, number, number];
  cover(ctx, imgs[0]!, x, y, w, h);
  ctx.strokeStyle = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";
  ctx.lineWidth = 2 * s;
  ctx.strokeRect(x, y, w, h);
  const top = y + h, bottom = H - top;
  const base = Math.min(bottom * 0.17, 54 * s);
  ctx.fillStyle = dark ? "#d8d3c8" : "#3a3836";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${base}px ${FONTS.type}`;
  const letter = (t: string, cy: number, size: number) => {
    // 打字机字：字距稍松，每个字轻微浓淡
    ctx.font = `${size}px ${FONTS.type}`;
    const sp = size * 0.12;
    const chars = [...t];
    const total = chars.reduce((a, ch) => a + ctx.measureText(ch).width + sp, -sp);
    let cx = W / 2 - total / 2;
    const r = rng(t.length * 7 + 3);
    ctx.textAlign = "left";
    chars.forEach((ch) => { ctx.globalAlpha = 0.82 + r() * 0.18; ctx.fillText(ch, cx, cy); cx += ctx.measureText(ch).width + sp; });
    ctx.globalAlpha = 1;
  };
  const hasPlace = !!o.caption.trim();
  const mid = top + bottom * 0.5;
  letter(stampText(o.date), hasPlace ? mid - base * 0.75 : mid, base);
  if (hasPlace) letter(o.caption.trim().toUpperCase(), mid + base * 0.85, base * 0.82);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

// ── ④ 规则拼图：动态模糊照片底 + 轻颗粒 + 单族蜡笔贴纸压在照片边缘 ─────
type Rect = { x: number; y: number; w: number; h: number };
export function puzzleRects(W: number, H: number, n: number): Rect[] {
  if (n >= 4) {
    const w = W * 0.36, h = w * (4 / 3), gx = W * 0.04, gy = H * 0.03;
    const x0 = (W - w * 2 - gx) / 2, y0 = (H - h * 2 - gy) / 2;
    return [0, 1, 2, 3].map((i) => ({ x: x0 + (i % 2) * (w + gx), y: y0 + Math.floor(i / 2) * (h + gy), w, h }));
  }
  const w = W * 0.58, h = w / 2, g = H * 0.05;
  const y0 = (H - h * 3 - g * 2) / 2;
  return [0, 1, 2].map((i) => ({ x: (W - w) / 2, y: y0 + i * (h + g), w, h }));
}

/** 照片 0–1 坐标 → 画布坐标（与 cover 的裁切一致） */
function coverMap(img: Img, r: Rect, cx: number, cy: number) {
  const k = Math.max(r.w / img.width, r.h / img.height);
  const sw = r.w / k, sh = r.h / k, sx = (img.width - sw) * cx, sy = (img.height - sh) * cy;
  return (u: number, v: number): [number, number] => [r.x + (u * img.width - sx) * k, r.y + (v * img.height - sy) * k];
}

/** 动态模糊：沿略斜方向多次错位叠加取平均，再轻微高斯 */
function motionBlurBg(ctx: Ctx, img: Img, W: number, H: number) {
  const n = 18, step = W * 0.009;
  ctx.save();
  ctx.filter = `blur(${W * 0.006}px) saturate(1.08)`;
  for (let i = 0; i < n; i++) {
    const t = i - (n - 1) / 2;
    ctx.globalAlpha = 1 / (i + 1);
    cover(ctx, img, -W * 0.12 + t * step, -H * 0.06 + t * step * 0.18, W * 1.24, H * 1.12);
  }
  ctx.restore();
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.fillRect(0, 0, W, H);
}

/** 蜡笔填色：底色半透 + 斜向排线 + 纸面露白 + 毛边描一圈 */
function crayonFill(ctx: Ctx, path: Path2D, x: number, y: number, r: number, color: string, seed: number) {
  const R = rng(seed);
  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.95;
  ctx.fill(path);
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = Math.max(1, r * 0.03);
  ctx.globalAlpha = 0.5;
  const ang = 0.6 + R() * 0.3;
  for (let k = -r * 1.6; k < r * 1.6; k += r * 0.1) {
    ctx.beginPath();
    ctx.moveTo(x + k - r * ang * 1.5, y + r * 1.5);
    ctx.lineTo(x + k + r * ang * 1.5, y - r * 1.5);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (let i = 0; i < r * 0.8; i++) {
    ctx.globalAlpha = 0.1 + R() * 0.2;
    const s = r * (0.02 + R() * 0.05);
    ctx.fillRect(x + (R() - 0.5) * r * 2.2, y + (R() - 0.5) * r * 2.2, s, s * (0.4 + R()));
  }
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.95;
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(1, r * 0.14);
  ctx.fillStyle = color;
  ctx.stroke(path);
  ctx.restore();
}
function polyPath(pts: [number, number][]) {
  const p = new Path2D();
  pts.forEach(([a, b], i) => (i ? p.lineTo(a, b) : p.moveTo(a, b)));
  p.closePath();
  return p;
}

/** 贴纸库：波点 / 星星 / 爱心 / 螺旋 / 四角火花 / 小花 / 烟花，族内造型有变化 */
function sticker(ctx: Ctx, fam: StickerFamily, x: number, y: number, r: number, color: string, seed: number) {
  const R = rng(seed);
  const rot = (R() - 0.5) * 0.8;
  const wob = (n: number, f: (a: number) => number) =>
    Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; const rr = f(a) * (0.97 + R() * 0.06); return [x + Math.cos(a + rot) * rr, y + Math.sin(a + rot) * rr] as [number, number]; });
  switch (fam) {
    case "dot":
      return crayonFill(ctx, polyPath(wob(32, () => r)), x, y, r, color, seed);
    case "star": {
      // 参考样张：多数是胖胖的五角星（臂长不一、偶有一条长尾），偶尔一颗八角星芒
      const spikes = R() < 0.18 ? 8 : 5, inner = spikes === 8 ? 0.42 : 0.46 + R() * 0.08, round = false;
      const tail = R() < 0.3 ? Math.floor(R() * spikes) : -1;
      const pts: [number, number][] = [];
      for (let i = 0; i < spikes * 2; i++) {
        const a = -Math.PI / 2 + rot + (i / (spikes * 2)) * Math.PI * 2 + (R() - 0.5) * 0.12;
        const rr = i % 2 ? r * inner * (0.9 + R() * 0.2) : r * (i / 2 === tail ? 1.45 : 0.85 + R() * 0.3);
        pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
      }
      if (!round) return crayonFill(ctx, polyPath(pts), x, y, r, color, seed);
      const p = new Path2D();
      pts.forEach(([a, b], i) => { const [na, nb] = pts[(i + 1) % pts.length]!; const mx = (a + na) / 2, my = (b + nb) / 2; i ? p.quadraticCurveTo(a, b, mx, my) : p.moveTo(mx, my); });
      p.closePath();
      return crayonFill(ctx, p, x, y, r, color, seed);
    }
    case "heart": {
      const pts: [number, number][] = [];
      const sx = 0.9 + R() * 0.2;
      for (let i = 0; i < 40; i++) {
        const t = (i / 40) * Math.PI * 2;
        const hx = 16 * Math.sin(t) ** 3 * sx, hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        const c = Math.cos(rot), s = Math.sin(rot);
        pts.push([x + ((hx * c - hy * s) * r) / 17, y + ((hx * s + hy * c) * r) / 17]);
      }
      return crayonFill(ctx, polyPath(pts), x, y, r, color, seed);
    }
    case "flower": {
      const petals = 5 + Math.floor(R() * 3);
      const p = new Path2D();
      for (let i = 0; i < petals; i++) {
        const a = rot + (i / petals) * Math.PI * 2;
        p.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.45, r * 0.32, a, 0, Math.PI * 2);
      }
      crayonFill(ctx, p, x, y, r, color, seed);
      ctx.save(); ctx.globalAlpha = 0.9; ctx.fillStyle = "rgba(255,250,235,0.9)";
      ctx.beginPath(); ctx.arc(x, y, r * 0.2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      return;
    }
    case "spark": {
      // 类 Claude 的放射火花：粗细不一、圆头的放射短线
      const rays = 8 + Math.floor(R() * 5);
      const pts: [number, number][] = [];
      for (let i = 0; i < rays; i++) {
        const a = rot + (i / rays) * Math.PI * 2 + (R() - 0.5) * 0.2, len = r * (0.65 + R() * 0.4);
        pts.push([x, y], [x + Math.cos(a) * len, y + Math.sin(a) * len]);
      }
      for (let i = 0; i < pts.length; i += 2) crayonStroke(ctx, [pts[i]!, pts[i + 1]!], color, r * (0.16 + R() * 0.08), seed + i);
      return;
    }
    case "spiral": {
      const turns = 2.2 + R() * 1.2, n = 60, pts: [number, number][] = [];
      for (let i = 0; i <= n; i++) { const t = i / n, a = rot + t * turns * Math.PI * 2, rr = r * t; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
      return crayonStroke(ctx, pts, color, r * 0.14, seed);
    }
    case "firework": {
      const rays = 10 + Math.floor(R() * 6);
      for (let i = 0; i < rays; i++) {
        const a = rot + (i / rays) * Math.PI * 2, r0 = r * 0.25, r1 = r * (0.75 + R() * 0.25);
        crayonStroke(ctx, [[x + Math.cos(a) * r0, y + Math.sin(a) * r0], [x + Math.cos(a) * r1, y + Math.sin(a) * r1]], color, r * 0.08, seed + i, i % 3 ? "solid" : "dash");
        if (R() > 0.4) { ctx.save(); ctx.fillStyle = color; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r1 * 1.15, y + Math.sin(a) * r1 * 1.15, r * 0.06, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      }
      return;
    }
  }
}

/** 把 AI 配色往奶油色拉一点：保持对比但像参考图那样柔和、不刺眼 */
function softCrayon(hex: string) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  const cream = [243, 222, 160];
  return "#" + [m[1], m[2], m[3]].map((h, i) => Math.round(parseInt(h!, 16) * 0.6 + cream[i]! * 0.4).toString(16).padStart(2, "0")).join("");
}
export function puzzleSticker(imgs: Img[], o: TemplateOptions) {
  const bg = avgColor(imgs[0]!);
  return {
    family: o.sticker ?? autoSticker(bg),
    color: o.stickerColor ?? softCrayon(o.puzzleAI?.color ?? contrastCrayon(bg)),
  };
}
/** 每张照片的裁切中心：手动拖过 > AI 主体 > 居中 */
export function puzzleCrop(o: TemplateOptions, i: number): [number, number] {
  return o.pcrops[i] ?? o.puzzleAI?.photos[i]?.focus ?? [0.5, 0.5];
}

function drawPuzzle(ctx: Ctx, W: number, H: number, imgs: Img[], o: TemplateOptions) {
  const n = Math.min(imgs.length, 4);
  motionBlurBg(ctx, imgs[0]!, W, H);
  grain(ctx, W, H, 0.07);
  const rects = puzzleRects(W, H, n);
  const maps = rects.map((r, i) => { const [cx, cy] = puzzleCrop(o, i); cover(ctx, imgs[i]!, r.x, r.y, r.w, r.h, cx, cy); return coverMap(imgs[i]!, r, cx, cy); });
  const { family, color } = puzzleSticker(imgs, o);
  // 避开区：AI 给的脸/主体框
  const avoid: Rect[] = [];
  rects.forEach((_, i) => o.puzzleAI?.photos[i]?.avoid.forEach(([ax, ay, aw, ah]) => {
    const [x0, y0] = maps[i]!(ax, ay), [x1, y1] = maps[i]!(ax + aw, ay + ah);
    avoid.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  }));
  const hit = (x: number, y: number, s: number) => avoid.some((a) => x + s > a.x && x - s < a.x + a.w && y + s > a.y && y - s < a.y + a.h);
  // 压在照片边缘和接缝上，大小参差（约 0.5×–2×），不跑远
  const R = rng(o.seed + 101);
  const count = n >= 4 ? 7 : 6;
  const placed: [number, number, number][] = [];
  for (let tries = 0; placed.length < count && tries < 400; tries++) {
    const r = rects[Math.floor(R() * rects.length)]!;
    const side = Math.floor(R() * 4), t = R() < 0.6 ? (R() < 0.5 ? 0.04 + R() * 0.12 : 0.84 + R() * 0.12) : 0.2 + R() * 0.6;
    let x = side === 0 ? r.x + r.w * t : side === 1 ? r.x + r.w : side === 2 ? r.x + r.w * t : r.x;
    let y = side === 0 ? r.y : side === 1 ? r.y + r.h * t : side === 2 ? r.y + r.h : r.y + r.h * t;
    x += (R() - 0.5) * W * 0.03; y += (R() - 0.5) * W * 0.03;
    const s = W * (0.03 + R() * 0.03);
    if (hit(x, y, s)) continue;
    if (placed.some(([px, py, ps]) => Math.hypot(px - x, py - y) < (ps + s) * 2.2)) continue;
    placed.push([x, y, s]);
  }
  placed.forEach(([x, y, s], i) => sticker(ctx, family, x, y, s, color, o.seed * 31 + i));
}

export const TEMPLATES: TemplateDef[] = [
  { id: "solo", name: "手绘单张", en: "Hand-drawn", min: 1, max: 1, ai: true, size: () => [1080, 1440], draw: drawSolo },
  { id: "halfframe", name: "半格胶片", en: "Half-Frame", min: 2, max: 2, size: () => [1500, 1040], draw: drawHalf },
  { id: "polaroid", name: "拍立得", en: "Polaroid", min: 1, max: 1, instantOnly: true, size: (o) => POLAROID[o.format].card, draw: drawPolaroid },
  { id: "puzzle", name: "拼图贴纸", en: "Collage", min: 3, max: 4, pro: true, size: () => [1080, 1440], draw: drawPuzzle },
];

export function getTemplate(id: TemplateId) {
  return TEMPLATES.find((t) => t.id === id)!;
}

/** 这组照片能不能用该模板；不能用时返回原因 */
export function blockReason(t: TemplateDef, categories: (CameraCategory | null)[]): string | null {
  if (categories.length < t.min || categories.length > t.max) return `需要选 ${t.min === t.max ? t.min : `${t.min}–${t.max}`} 张`;
  if (t.instantOnly && categories[0] !== "instant") return "只有拍立得相机拍的照片能做";
  return null;
}
export function usable(t: TemplateDef, categories: (CameraCategory | null)[]) {
  return blockReason(t, categories) === null;
}

/** 模板实际用几张（多出来的取前几张） */
export function takeCount(t: TemplateDef, count: number) {
  return Math.min(count, t.max);
}

/** 按张数和相机类型推荐模板 */
export function recommendTemplate(count: number, category: CameraCategory | null): TemplateId {
  if (count >= 3) return "puzzle";
  if (count === 2) return "halfframe";
  return category === "instant" ? "polaroid" : "solo";
}

export function defaultOptions(place: string | null = null): TemplateOptions {
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { caption: place ?? "", date, frame: 0, format: "mini", crops: [0.5, 0.5], swap: false, sticker: null, stickerColor: null, seed: 1, pcrops: [null, null, null, null], solo: null, soloDark: false, soloFrame: null, puzzleAI: null };
}
