import type { CameraCategory } from "@/lib/cameras";
import { FONTS, cover, grain, rng, type Ctx, type Img } from "./draw";
import { drawSoloCard, innerRect, type FrameKind } from "@/lib/solo/draw";
import { FRAMES } from "@/lib/render";
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
  /** 拼图：每张照片里人脸占画面的比例（null = 没人，undefined = 还在识别），挑背景时避开有人的 */
  cpeople: (number | null | undefined)[];
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

// ── ② 半格胶片：两张竖裁并排、满版、片基色分隔条（窄、不纯黑、边缘不齐）、轻颗粒 ───
const HALF_BASE = "#2a2420"; // 片基色：深棕灰，不是纯黑
function drawHalf(ctx: Ctx, W: number, H: number, imgs: Img[], o: TemplateOptions) {
  const gap = W * (47 / 1500); // 1500 宽画布上 47px，导出时等比放大
  ctx.fillStyle = HALF_BASE;
  ctx.fillRect(0, 0, W, H);
  const fw = (W - gap) / 2;
  const pair = o.swap ? [imgs[1]!, imgs[0]!] : [imgs[0]!, imgs[1]!];
  const crops = o.swap ? [o.crops[1], o.crops[0]] : o.crops;
  // 照片各往中间多画一点，分隔条压上去后边缘才有起伏
  pair.forEach((img, i) => cover(ctx, img, i === 0 ? 0 : fw + gap - gap * 0.3, 0, fw + gap * 0.3, H, crops[i]));
  // 不再叠暖色滤镜：照片保持暗房冲出来的颜色
  // 分隔条：边缘是细密的颗粒 / 小锯齿（像胶片片基的毛边），不是波浪；照片交界处不加阴影
  const r = rng(17);
  const step = Math.max(1, gap * 0.04), amp = gap * 0.02;
  const steps = Math.ceil(H / step);
  const edge = (side: number) => Array.from({ length: steps + 1 }, (_, k) => {
    // 每一小段独立随机，没有大的起伏，只有很细的毛边
    const jag = (r() - 0.5) * amp * (r() < 0.1 ? 1.5 : 1);
    return [fw + side * gap + jag, Math.min(H, k * step)] as [number, number];
  });
  const left = edge(0), right = edge(1);
  ctx.save();
  ctx.beginPath();
  left.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  [...right].reverse().forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.closePath();
  ctx.fillStyle = HALF_BASE;
  ctx.fill();
  ctx.restore();
  grain(ctx, W, H, 0.2);
}

// ── ③ 拍立得：直接用暗房冲出来的整张相纸（压纹、圆角、相纸颜色都保留），只在底边盖日期章 + 地点章 ──
/** 整张相纸的宽高比（和暗房 render 里的相纸边距一致） */
function polaroidCard(kind: PolaroidFormat): [number, number] {
  const f = FRAMES[kind];
  const ratio = (1 + 2 * f.side) / (1 / f.aspect + f.top + f.bottom);
  return [1080, Math.round(1080 / ratio)];
}
function drawPolaroid(ctx: Ctx, W: number, H: number, imgs: Img[], o: TemplateOptions) {
  const card = imgs[0]!;
  const dark = o.frame === 1;
  ctx.fillStyle = dark ? "#0f0e0e" : "#f8f6f1";
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(card, 0, 0, W, H);
  const [, iy, , ih] = innerRect(card, o.format);
  const s = W / 1080;
  const top = (iy + ih) * H, bottom = H - top;
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
  drawCollage(ctx, W, H, imgs, { crops: o.ccrops, focus: o.cfocus, background: null, people: o.cpeople });
}

export const TEMPLATES: TemplateDef[] = [
  { id: "solo", name: "手绘单张", en: "Hand-drawn", min: 1, max: 1, ai: true, size: () => [1080, 1440], draw: drawSolo },
  { id: "halfframe", name: "半格胶片", en: "Half-Frame", min: 2, max: 2, noInstant: true, size: () => [1500, 1040], draw: drawHalf },
  { id: "polaroid", name: "拍立得", en: "Polaroid", min: 1, max: 1, instantOnly: true, size: (o) => polaroidCard(o.format), draw: drawPolaroid },
  { id: "collage", name: "拼图", en: "Collage", min: 2, max: 4, noInstant: true, size: () => [1080, Math.round((1080 * COLLAGE_CANVAS[1]) / COLLAGE_CANVAS[0])], draw: drawCollageTemplate },
];

export function getTemplate(id: TemplateId) {
  return TEMPLATES.find((t) => t.id === id)!;
}

/** 这组照片能不能用该模板；不能用时返回原因 */
export function blockReason(t: TemplateDef, categories: (CameraCategory | null)[], lang: "zh" | "en" = "zh"): string | null {
  const range = t.min === t.max ? `${t.min}` : `${t.min}–${t.max}`;
  if (categories.length < t.min || categories.length > t.max) return lang === "en" ? `needs ${range} photos` : `需要选 ${range} 张`;
  if (t.instantOnly && categories[0] !== "instant") return lang === "en" ? "only for photos from instant cameras" : "只有拍立得相机拍的照片能做";
  if (t.noInstant && categories.includes("instant"))
    return lang === "en" ? "can't use instant photos (instant photos work with Hand-drawn or Polaroid)" : "不能放拍立得照片（拍立得只能做手绘单张或拍立得）";
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
    ccrops: [null, null, null, null], cfocus: [null, null, null, null], cpeople: [],
  };
}
