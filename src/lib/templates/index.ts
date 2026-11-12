import type { CameraCategory } from "@/lib/cameras";
import { FONTS, cover, grain, rng, type Ctx, type Img } from "./draw";
import { drawSoloCard, type FrameKind } from "@/lib/solo/draw";
import type { SoloData } from "@/lib/solo/types";
import { COLLAGE_CANVAS, drawCollage, type Crop } from "@/lib/collage";

export type TemplateId = "solo" | "halfframe" | "polaroid" | "collage";
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
  /** 手绘线随机排布 */
  seed: number;
  /** 手绘单张：AI/本地计划 + 人物描边；null = 还在准备，只画照片 */
  solo: SoloData | null;
  /** 手绘单张：深色纸 */
  soloDark: boolean;
  /** 手绘单张：拍立得照片保留相纸（img 是整张相纸） */
  soloFrame: FrameKind | null;
  /** 拼图：每个槽位用户调整后的取景；null = 初始取景 */
  ccrops: (Crop | null)[];
  /** 拼图：每张照片的主体位置（0–1），用于初始取景 */
  cfocus: ([number, number] | null)[];
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
  /** 拍立得相机拍的照片不能用 */
  noInstant?: boolean;
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

// ── ④ 拼图（无贴纸）：双图 / 三图竖排、四宫格；版式与背景见 src/lib/collage ─────
function drawCollageTemplate(ctx: Ctx, W: number, H: number, imgs: Img[], o: TemplateOptions) {
  drawCollage(ctx, W, H, imgs, { crops: o.ccrops, focus: o.cfocus, background: null });
}

export const TEMPLATES: TemplateDef[] = [
  { id: "solo", name: "手绘单张", en: "Hand-drawn", min: 1, max: 1, ai: true, size: () => [1080, 1440], draw: drawSolo },
  { id: "halfframe", name: "半格胶片", en: "Half-Frame", min: 2, max: 2, noInstant: true, size: () => [1500, 1040], draw: drawHalf },
  { id: "polaroid", name: "拍立得", en: "Polaroid", min: 1, max: 1, instantOnly: true, size: (o) => POLAROID[o.format].card, draw: drawPolaroid },
  { id: "collage", name: "拼图", en: "Collage", min: 2, max: 4, noInstant: true, size: () => [1080, Math.round((1080 * COLLAGE_CANVAS[1]) / COLLAGE_CANVAS[0])], draw: drawCollageTemplate },
];

export function getTemplate(id: TemplateId) {
  return TEMPLATES.find((t) => t.id === id)!;
}

/** 这组照片能不能用该模板；不能用时返回原因 */
export function blockReason(t: TemplateDef, categories: (CameraCategory | null)[]): string | null {
  if (categories.length < t.min || categories.length > t.max) return `需要选 ${t.min === t.max ? t.min : `${t.min}–${t.max}`} 张`;
  if (t.instantOnly && categories[0] !== "instant") return "只有拍立得相机拍的照片能做";
  if (t.noInstant && categories.includes("instant")) return "不能放拍立得照片";
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
  if (count >= 3) return "collage";
  if (count === 2) return "halfframe";
  return category === "instant" ? "polaroid" : "solo";
}

export function defaultOptions(place: string | null = null): TemplateOptions {
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return {
    caption: place ?? "", date, frame: 0, format: "mini", crops: [0.5, 0.5], swap: false, seed: 1,
    solo: null, soloDark: false, soloFrame: null,
    ccrops: [null, null, null, null], cfocus: [null, null, null, null],
  };
}
