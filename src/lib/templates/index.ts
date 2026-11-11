import type { CameraCategory } from "@/lib/cameras";
import type { PuzzleAI, SoloStroke, StickerFamily } from "./ai-types";
import { FONTS, cover, grain, rng, type Ctx, type Img } from "./draw";

export type { PuzzleAI, SoloStroke, StickerFamily } from "./ai-types";
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
  /** 手绘单张：AI 看图配的线；null = 本地备用画法，"pending" = 等待中只画照片 */
  soloLines: SoloStroke[] | null | "pending";
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
const hex = ([r, g, b]: RGB) => "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

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
  if (lum < 0.28) return "star";
  return "dot";
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
const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 18): [number, number][] =>
  Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });

// ── ① 手绘单张：原比例小照片 + 看图配色的手绘细线 ─────────────────
function drawSolo(ctx: Ctx, W: number, H: number, imgs: Img[], o: TemplateOptions) {
  const u = W / 1080, img = imgs[0]!;
  const base = avgColor(img);
  const lum = (base[0] * 0.3 + base[1] * 0.59 + base[2] * 0.11) / 255;
  ctx.fillStyle = hex(mix(base, [250, 247, 236], 0.86));
  ctx.fillRect(0, 0, W, H);
  // 照片保持原比例，约占画面 52% 宽（竖图收窄）
  const ar = img.width / img.height;
  let pw = W * (ar >= 1 ? 0.56 : 0.46), ph = pw / ar;
  if (ph > H * 0.5) { ph = H * 0.5; pw = ph * ar; }
  const px = (W - pw) / 2, py = (H - ph) / 2;
  ctx.drawImage(img, px, py, pw, ph);
  if (o.soloLines === "pending") return grain(ctx, W, H, 0.06);
  if (o.soloLines) {
    o.soloLines.forEach((st, i) => {
      const pts = st.pts.map(([x, y]) => [px + x * pw, py + y * ph] as [number, number]);
      crayonStroke(ctx, pts, st.color, (2.2 + st.width * 1.6) * u, o.seed * 97 + i, st.style);
    });
    return grain(ctx, W, H, 0.06);
  }
  // 三色：取照片色加深/提亮，线条有实线、虚线、点线
  const night = lum < 0.35, cool = base[2] > base[0];
  const c1 = hex(mix(base, night ? [240, 200, 120] : [214, 120, 70], 0.7));
  const c2 = hex(mix(base, cool ? [80, 120, 170] : [120, 150, 90], 0.65));
  const c3 = hex(mix(base, [200, 110, 130], 0.6));
  const w = 5 * u, R = rng(o.seed + 11);
  const L = px, T = py, Rt = px + pw, B = py + ph;
  // 沿照片边的穿插弧线
  crayonStroke(ctx, arc(L + pw * 0.12, T, pw * 0.28, ph * 0.22, Math.PI * 0.9, Math.PI * 1.9), c1, w, o.seed + 1);
  crayonStroke(ctx, arc(Rt, B - ph * 0.2, pw * 0.16, ph * 0.3, -Math.PI * 0.4, Math.PI * 0.6), c2, w * 0.8, o.seed + 2, "dash");
  crayonStroke(ctx, [[L - 40 * u, B - 30 * u], [L + pw * 0.2, B + 50 * u], [L + pw * 0.5, B + 30 * u], [L + pw * 0.75, B + 70 * u]], c3, w * 0.7, o.seed + 3, "dot");
  // 主题符号
  const sx = Rt - pw * 0.06, sy = T - 10 * u;
  if (night) {
    crayonStroke(ctx, arc(sx, sy, 46 * u, 46 * u, Math.PI * 0.6, Math.PI * 2.2), c1, w, o.seed + 4);
    crayonStroke(ctx, arc(sx + 18 * u, sy - 10 * u, 38 * u, 38 * u, Math.PI * 0.7, Math.PI * 2.1), c1, w * 0.6, o.seed + 5);
    for (let i = 0; i < 4; i++) {
      const x = L - 20 * u + R() * pw * 0.4, y = B + 80 * u + R() * 60 * u, s = (10 + R() * 12) * u;
      crayonStroke(ctx, [[x - s, y], [x + s, y]], c3, w * 0.7, o.seed + 20 + i);
      crayonStroke(ctx, [[x, y - s], [x, y + s]], c3, w * 0.7, o.seed + 30 + i);
    }
  } else if (cool) {
    // 云 + 飞鸟
    const cy = T - 40 * u, cx = L + pw * 0.62;
    crayonStroke(ctx, [...arc(cx, cy, 34 * u, 28 * u, Math.PI, Math.PI * 2), ...arc(cx + 56 * u, cy - 6 * u, 30 * u, 34 * u, Math.PI, Math.PI * 2), ...arc(cx + 100 * u, cy + 6 * u, 24 * u, 22 * u, Math.PI * 1.1, Math.PI * 2.4)], c2, w, o.seed + 6);
    for (let i = 0; i < 3; i++) {
      const x = L + 30 * u + i * 60 * u, y = T - 90 * u + i * 18 * u, s = 18 * u;
      crayonStroke(ctx, [[x - s, y], [x - s * 0.3, y + s * 0.5], [x, y], [x + s * 0.4, y + s * 0.5], [x + s, y]], c3, w * 0.7, o.seed + 40 + i);
    }
  } else {
    // 太阳 + 叶子
    crayonStroke(ctx, arc(sx, sy, 34 * u, 34 * u, 0, Math.PI * 2), c1, w, o.seed + 7);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      crayonStroke(ctx, [[sx + Math.cos(a) * 50 * u, sy + Math.sin(a) * 50 * u], [sx + Math.cos(a) * 72 * u, sy + Math.sin(a) * 72 * u]], c1, w * 0.7, o.seed + 50 + i);
    }
    const lx = L - 10 * u, ly = B - ph * 0.35;
    crayonStroke(ctx, [[lx + 30 * u, ly - 60 * u], [lx - 20 * u, ly], [lx - 40 * u, ly + 90 * u]], c2, w * 0.8, o.seed + 8);
    for (let i = 0; i < 3; i++) {
      const y = ly - 30 * u + i * 45 * u, x = lx - 12 * u - i * 8 * u;
      crayonStroke(ctx, arc(x - 26 * u, y, 24 * u, 11 * u, 0, Math.PI * 2, 14), c2, w * 0.6, o.seed + 60 + i);
    }
  }
  grain(ctx, W, H, 0.08);
}

// ── ② 半格胶片：两张竖裁并排、满版、黑分隔条、轻颗粒偏暖 ───────────
function drawHalf(ctx: Ctx, W: number, H: number, imgs: Img[], o: TemplateOptions) {
  const gap = W * 0.022;
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
  ctx.globalAlpha = 0.78;
  ctx.fill(path);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, r * 0.07);
  ctx.globalAlpha = 0.7;
  const ang = 0.6 + R() * 0.3;
  for (let k = -r * 1.6; k < r * 1.6; k += r * 0.1) {
    ctx.beginPath();
    ctx.moveTo(x + k - r * ang * 1.5, y + r * 1.5);
    ctx.lineTo(x + k + r * ang * 1.5, y - r * 1.5);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (let i = 0; i < r * 1.6; i++) {
    ctx.globalAlpha = 0.2 + R() * 0.35;
    const s = r * (0.02 + R() * 0.05);
    ctx.fillRect(x + (R() - 0.5) * r * 2.2, y + (R() - 0.5) * r * 2.2, s, s * (0.4 + R()));
  }
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.max(1, r * 0.06);
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
      const spikes = [5, 5, 6, 4][Math.floor(R() * 4)]!, inner = 0.4 + R() * 0.14, round = R() > 0.5;
      const pts: [number, number][] = [];
      for (let i = 0; i < spikes * 2; i++) {
        const a = -Math.PI / 2 + rot + (i / (spikes * 2)) * Math.PI * 2, rr = (i % 2 ? r * inner : r) * (0.93 + R() * 0.1);
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

export function puzzleSticker(imgs: Img[], o: TemplateOptions) {
  const bg = avgColor(imgs[0]!);
  return {
    family: o.sticker ?? o.puzzleAI?.family ?? autoSticker(bg),
    color: o.stickerColor ?? o.puzzleAI?.color ?? contrastCrayon(bg),
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
  const count = n >= 4 ? 16 : 13;
  const placed: [number, number, number][] = [];
  for (let tries = 0; placed.length < count && tries < 400; tries++) {
    const r = rects[Math.floor(R() * rects.length)]!;
    const side = Math.floor(R() * 4), t = 0.08 + R() * 0.84;
    let x = side === 0 ? r.x + r.w * t : side === 1 ? r.x + r.w : side === 2 ? r.x + r.w * t : r.x;
    let y = side === 0 ? r.y : side === 1 ? r.y + r.h * t : side === 2 ? r.y + r.h : r.y + r.h * t;
    x += (R() - 0.5) * W * 0.03; y += (R() - 0.5) * W * 0.03;
    const big = R() < 0.3;
    const s = W * (big ? 0.032 + R() * 0.03 : 0.01 + R() * 0.018);
    if (hit(x, y, s)) continue;
    if (placed.some(([px, py, ps]) => Math.hypot(px - x, py - y) < (ps + s) * 1.3)) continue;
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
  if (categories.length < t.min) return `需要 ${t.min} 张照片`;
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
  return { caption: place ?? "", date, frame: 0, format: "mini", crops: [0.5, 0.5], swap: false, sticker: null, stickerColor: null, seed: 1, pcrops: [null, null, null, null], soloLines: null, puzzleAI: null };
}
