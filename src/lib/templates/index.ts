import type { CameraCategory } from "@/lib/cameras";
import {
  FONTS, cover, fit, grain, inkStamp, noShadow, paper, rng, softShadow, sparkle, star, tape, withRot, wrap,
  type Ctx, type Img,
} from "./draw";

export type TemplateId = "halfframe" | "polaroid" | "solo" | "blur" | "travel";

export type TemplateOptions = {
  /** 打字机文字 / 标题 */
  caption: string;
  /** 手写文字 */
  note: string;
  /** YYYY-MM-DD */
  date: string;
  /** 底纸配色序号 */
  paper: number;
  swap: boolean;
  edge: boolean;
  filmName: string;
  /** 每张照片自己的地点（多张拍立得用） */
  places?: (string | null)[];
};

export type TemplateDef = {
  id: TemplateId;
  name: string;
  en: string;
  min: number;
  max: number;
  pro?: boolean;
  /** 基准尺寸（预览 1x） */
  size: [number, number];
  papers?: { label: string; color: string }[];
  fields: ("caption" | "note" | "date" | "paper" | "swap" | "edge")[];
  draw: (ctx: Ctx, W: number, H: number, imgs: Img[], o: TemplateOptions) => void;
};

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
/** 2026-09-14 → "14 SEP 2026" */
export function stampText(date: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date.toUpperCase();
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? ""} ${m[1]}`;
}
/** 2026-09-14 → "'26 9 14"（半格机身日期） */
function filmDate(date: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return m ? `'${m[1]!.slice(2)} ${Number(m[2])} ${Number(m[3])}` : date;
}

// ── ① 半格胶片：两张竖图挤进一格 35mm ───────────────────────────
function drawHalf(ctx: Ctx, W: number, H: number, imgs: Img[], o: TemplateOptions) {
  const u = W / 1500;
  ctx.fillStyle = "#0b0b0a";
  ctx.fillRect(0, 0, W, H);
  const pad = o.edge ? 70 * u : 0, padY = o.edge ? 110 * u : 0, gap = 44 * u;
  const fw = (W - pad * 2 - gap) / 2, fh = H - padY * 2;
  const pair = o.swap ? [imgs[1]!, imgs[0]!] : [imgs[0]!, imgs[1]!];
  pair.forEach((img, i) => {
    const x = pad + i * (fw + gap);
    cover(ctx, img, x, padY, fw, fh);
    // 画框边缘微暗，像曝光边
    const g = ctx.createLinearGradient(x, 0, x + fw, 0);
    g.addColorStop(0, "rgba(0,0,0,0.25)");
    g.addColorStop(0.06, "rgba(0,0,0,0)");
    g.addColorStop(0.94, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.25)");
    ctx.fillStyle = g;
    ctx.fillRect(x, padY, fw, fh);
  });
  // 中缝的暗绿色片基
  ctx.fillStyle = "#121a14";
  ctx.fillRect(pad + fw, padY, gap, fh);
  if (o.edge) {
    ctx.fillStyle = "rgba(232,146,58,0.78)";
    ctx.font = `500 ${26 * u}px ${FONTS.mono}`;
    ctx.textBaseline = "middle";
    const label = (o.filmName || "DAZZ 400").toUpperCase();
    ctx.fillText(`${label}   ▸ 24`, pad, padY / 2);
    ctx.fillText("▸ 24A", pad + fw + gap, padY / 2);
    ctx.textAlign = "right";
    ctx.fillText("DAZZ LAB · HALF", W - pad, padY / 2);
    ctx.textAlign = "left";
    ctx.fillText(`25   ▸ 25A   ${label}`, pad, H - padY / 2);
    // 片孔
    ctx.fillStyle = "#1d1d1b";
    for (let x = pad * 0.4; x < W; x += 66 * u) {
      ctx.fillRect(x, padY * 0.1, 30 * u, padY * 0.18);
      ctx.fillRect(x, H - padY * 0.28, 30 * u, padY * 0.18);
    }
  }
  // 机身打印日期
  ctx.save();
  ctx.font = `${30 * u}px ${FONTS.mono}`;
  ctx.fillStyle = "#ff8a3a";
  ctx.shadowColor = "#ff6a1a";
  ctx.shadowBlur = 8 * u;
  ctx.textAlign = "right";
  ctx.fillText(filmDate(o.date), W - pad - 30 * u, H - padY - 30 * u);
  ctx.restore();
  grain(ctx, W, H, 0.22);
}

// ── ② 拍立得手记：干净相纸 + 居中炭灰日期章 + 打字机地点 ──────────
const CHARCOAL = "#3a3836";
function stampWidth(ctx: Ctx, text: string, size: number) {
  ctx.save();
  ctx.font = `500 ${size}px "Special Elite", "IBM Plex Mono", monospace`;
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + size * 0.06;
  ctx.restore();
  return w;
}
function polaroidCard(ctx: Ctx, img: Img, cx: number, cy: number, w: number, deg: number, o: TemplateOptions, u: number, seed: number, big: boolean, caption = o.caption) {
  const m = w * 0.06, iw = w - m * 2, bottom = w * 0.26;
  const h = m + iw + bottom;
  withRot(ctx, cx, cy, deg, () => {
    const x = cx - w / 2, y = cy - h / 2;
    softShadow(ctx, u, 0.45);
    ctx.fillStyle = "#fcfbf8";
    ctx.fillRect(x, y, w, h);
    noShadow(ctx);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.strokeStyle = "rgba(120,110,95,0.05)";
    ctx.lineWidth = 1 * u;
    for (let k = -h; k < w; k += 5 * u) {
      ctx.beginPath();
      ctx.moveTo(x + k, y);
      ctx.lineTo(x + k + h, y + h);
      ctx.stroke();
    }
    ctx.restore();
    cover(ctx, img, x + m, y + m, iw, iw);
    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    ctx.lineWidth = 2 * u;
    ctx.strokeRect(x + m, y + m, iw, iw);
    const by = y + m + iw;
    if (caption) {
      ctx.fillStyle = CHARCOAL;
      ctx.font = `${w * (big ? 0.05 : 0.058)}px ${FONTS.type}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(wrap(ctx, caption, iw * 0.9)[0] ?? "", cx, by + bottom * 0.4);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
    const ts = w * (big ? 0.036 : 0.044), text = stampText(o.date);
    inkStamp(ctx, text, cx - stampWidth(ctx, text, ts) / 2, by + bottom * (caption ? 0.74 : 0.55), ts, CHARCOAL, 0, seed);
  });
}

function drawPolaroid(ctx: Ctx, W: number, H: number, imgs: Img[], o: TemplateOptions) {
  const u = W / 1080;
  ctx.fillStyle = "#efeeeb";
  ctx.fillRect(0, 0, W, H);
  const n = imgs.length;
  if (n === 1) polaroidCard(ctx, imgs[0]!, W / 2, H / 2, 820 * u, 0, o, u, 21, true);
  else {
    const slots: [number, number][] =
      n === 2 ? [[540, 400], [540, 1060]] :
      n === 3 ? [[290, 450], [790, 450], [540, 1030]] :
      [[290, 430], [790, 430], [290, 1010], [790, 1010]];
    const w = n === 2 ? 470 * u : 450 * u;
    slots.forEach(([x, y], i) => polaroidCard(ctx, imgs[i]!, x * u, y * u, w, 0, o, u, 31 + i, false, i === 0 ? o.caption : (o.places?.[i] ?? "")));
  }
}

// ── ③ 文艺单张：展览画册式留白 + 衬线标题 + 展签信息 ──────────────
const SOLO_PAPERS = [
  { label: "画册白", color: "#f4f2ed", ink: "#1f1d1a", accent: "#b23a26" },
  { label: "灰墨", color: "#2b2a28", ink: "#ece8de", accent: "#e8923a" },
  { label: "燕麦", color: "#e6dccb", ink: "#2c261e", accent: "#7a4a2a" },
];
function drawSolo(ctx: Ctx, W: number, H: number, imgs: Img[], o: TemplateOptions) {
  const u = W / 1080;
  const p = SOLO_PAPERS[o.paper] ?? SOLO_PAPERS[0]!;
  paper(ctx, W, H, p.color, 17, 0.025);
  const r = fit(imgs[0]!, 130 * u, 190 * u, 820 * u, 860 * u);
  ctx.drawImage(imgs[0]!, r.x, r.y, r.w, r.h);
  const L = 130 * u, R = W - 130 * u;
  ctx.fillStyle = p.ink;
  ctx.textBaseline = "alphabetic";
  // 页眉
  ctx.font = `500 ${20 * u}px ${FONTS.mono}`;
  ctx.globalAlpha = 0.6;
  ctx.fillText("DAZZ LAB — PLATE Nº 01", L, 120 * u);
  ctx.textAlign = "right";
  ctx.fillText(stampText(o.date), R, 120 * u);
  ctx.textAlign = "left";
  ctx.globalAlpha = 1;
  // 标题（地点/文字）
  const ty = Math.max(r.y + r.h + 120 * u, 1170 * u);
  ctx.font = `700 ${64 * u}px ${FONTS.serif}`;
  ctx.fillText(wrap(ctx, o.caption || "无题", R - L)[0] ?? "", L, ty);
  ctx.fillStyle = p.accent;
  ctx.fillRect(L, ty + 30 * u, 56 * u, 4 * u);
  // 短句
  ctx.fillStyle = p.ink;
  ctx.globalAlpha = 0.75;
  ctx.font = `${28 * u}px ${FONTS.serif}`;
  wrap(ctx, o.note || "光线落下来的时候，什么都不用说。", R - L).slice(0, 2).forEach((l, i) => ctx.fillText(l, L, ty + 90 * u + i * 42 * u));
  ctx.globalAlpha = 0.5;
  ctx.font = `500 ${18 * u}px ${FONTS.mono}`;
  ctx.textAlign = "right";
  ctx.fillText("GELATIN SILVER PRINT", R, H - 70 * u);
  ctx.textAlign = "left";
  ctx.globalAlpha = 1;
  grain(ctx, W, H, o.paper === 1 ? 0.14 : 0.06);
}

// ── ④ 动态景深：横向流动的背景 + 白边前景照片 + 胶片光晕 ───────────
function drawBlur(ctx: Ctx, W: number, H: number, imgs: Img[], o: TemplateOptions) {
  const u = W / 1080;
  const bg = imgs[o.swap && imgs.length > 1 ? imgs.length - 1 : 0]!;
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.filter = `blur(${22 * u}px) saturate(1.25)`;
  for (let i = 0; i < 14; i++) {
    ctx.globalAlpha = i === 0 ? 1 : 0.12;
    cover(ctx, bg, -200 * u + i * 30 * u, -60 * u, W + 400 * u, H + 120 * u);
  }
  ctx.restore();
  const v = ctx.createLinearGradient(0, 0, 0, H);
  v.addColorStop(0, "rgba(0,0,0,0.35)");
  v.addColorStop(0.5, "rgba(0,0,0,0.05)");
  v.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  // 漏光
  const leak = ctx.createRadialGradient(W, 0, 0, W, 0, W * 0.9);
  leak.addColorStop(0, "rgba(255,120,40,0.35)");
  leak.addColorStop(1, "rgba(255,120,40,0)");
  ctx.fillStyle = leak;
  ctx.fillRect(0, 0, W, H);
  const fg = imgs.length > 1 ? imgs.filter((x) => x !== bg) : imgs;
  const n = fg.length;
  const layouts: [number, number, number, number][][] = [
    [[540, 640, 640, 0]],
    [[400, 520, 500, -3], [680, 860, 500, 2.5]],
    [[330, 430, 420, -4], [740, 640, 420, 3], [420, 980, 420, -1.5]],
  ];
  (layouts[Math.min(n, 3) - 1] ?? layouts[0]!).forEach(([x, y, w, d], i) => {
    const img = fg[i]!;
    const h = (w * img.height) / img.width > w * 1.35 ? w * 1.35 : (w * img.height) / img.width;
    const b = 14 * u;
    withRot(ctx, x * u, y * u, d, () => {
      softShadow(ctx, u, 0.9);
      ctx.fillStyle = "#f7f5f0";
      ctx.fillRect(x * u - w * u / 2 - b, y * u - h * u / 2 - b, w * u + b * 2, h * u + b * 2);
      noShadow(ctx);
      cover(ctx, img, x * u - w * u / 2, y * u - h * u / 2, w * u, h * u);
    });
  });
  ctx.fillStyle = "#f6f2e8";
  ctx.font = `500 ${22 * u}px ${FONTS.mono}`;
  ctx.globalAlpha = 0.85;
  ctx.fillText("● REC  " + filmDate(o.date), 70 * u, 100 * u);
  ctx.globalAlpha = 1;
  if (o.caption) {
    ctx.font = `700 ${58 * u}px ${FONTS.serif}`;
    ctx.fillText(wrap(ctx, o.caption, W - 140 * u)[0] ?? "", 70 * u, H - 110 * u);
  }
  ctx.font = `500 ${20 * u}px ${FONTS.mono}`;
  ctx.globalAlpha = 0.7;
  ctx.fillText("IN MOTION · DAZZ LAB", 70 * u, H - 64 * u);
  ctx.globalAlpha = 1;
  grain(ctx, W, H, 0.2);
}

// ── ⑤ 旅行画报：深色底纸 + 错落照片 + 胶带 + 白色手绘 ─────────────
const TRAVEL_PAPERS = [
  { label: "深海蓝", color: "#174a82" },
  { label: "米白", color: "#f1ece1" },
  { label: "墨绿", color: "#2d4a3a" },
];
function drawTravel(ctx: Ctx, W: number, H: number, imgs: Img[], o: TemplateOptions) {
  const u = W / 1080;
  const p = TRAVEL_PAPERS[o.paper] ?? TRAVEL_PAPERS[0]!;
  const light = o.paper === 1;
  const ink = light ? "#1d3f74" : "#f7f4ea";
  paper(ctx, W, H, p.color, 23, 0.06);
  const n = imgs.length;
  const slots: [number, number, number, number, number][] =
    n === 1 ? [[120, 300, 840, 700, -2]] :
    n === 2 ? [[90, 150, 600, 450, -2], [380, 760, 620, 465, 2.5]] :
    [[90, 110, 520, 390, -2.5], [280, 560, 560, 400, 1.5], [440, 1000, 540, 360, -1.5]];
  slots.forEach(([x, y, w, h, d], i) => {
    const img = imgs[i]!;
    withRot(ctx, (x + w / 2) * u, (y + h / 2) * u, d, () => {
      softShadow(ctx, u, 0.8);
      ctx.fillStyle = "#fff";
      ctx.fillRect(x * u, y * u, w * u, h * u);
      noShadow(ctx);
      cover(ctx, img, x * u, y * u, w * u, h * u);
    });
  });
  const [s0, s1] = [slots[0]!, slots[1] ?? slots[0]!];
  tape(ctx, (s1[0] + s1[2] * 0.5) * u, s1[1] * u, 180 * u, 70 * u, -4, "gingham", u);
  // 牛皮纸星星邮票
  [[s0[0] - 20, s0[1] - 30, -6], [s0[0] + 60, s0[1] - 10, 8], [s0[0] + 20, s0[1] + 50, -3]].slice(0, 3).forEach(([x, y, d], i) =>
    withRot(ctx, x! * u, y! * u, d!, () => {
      ctx.fillStyle = i === 0 ? "#efe9de" : "#e6c9a6";
      softShadow(ctx, u, 0.4);
      ctx.fillRect(x! * u - 34 * u, y! * u - 34 * u, 68 * u, 68 * u);
      noShadow(ctx);
      star(ctx, x! * u, y! * u, 22 * u, "#2a2018", 300 + i, i === 0 ? "#2a2018" : undefined, 0.12);
    }));
  // 白色手绘：虚线 + 星
  ctx.save();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 4 * u;
  ctx.setLineDash([2 * u, 18 * u]);
  ctx.lineCap = "round";
  const lx = s0[0] * u + 60 * u, ly = (s0[1] + s0[3]) * u + 40 * u;
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.bezierCurveTo(lx + 40 * u, ly + 120 * u, lx + 160 * u, ly + 40 * u, lx + 230 * u, ly + 110 * u);
  ctx.stroke();
  ctx.restore();
  star(ctx, lx, ly, 40 * u, ink, 401);
  star(ctx, lx + 250 * u, ly + 120 * u, 26 * u, ink, 402);
  sparkle(ctx, (s0[0] + s0[2]) * u - 70 * u, (s0[1] + s0[3]) * u - 90 * u, 60 * u, ink, 403, 12);
  // 手写段落
  const text = o.note || "When we arrived at the sea, the whole summer was right in front of us.";
  ctx.fillStyle = ink;
  ctx.font = `700 ${46 * u}px ${FONTS.script}`;
  const tx = n === 1 ? 140 * u : n === 2 ? 730 * u : 640 * u, ty = n === 1 ? 1130 * u : n === 2 ? 210 * u : 150 * u;
  const tw = n === 1 ? 800 * u : n === 2 ? 300 * u : 380 * u;
  wrap(ctx, text, tw).slice(0, n === 1 ? 3 : 6).forEach((l, i) => ctx.fillText(l, tx, ty + i * 54 * u));
  // 浅色标签框 + 打字机说明
  if (o.caption) {
    ctx.font = `${30 * u}px ${FONTS.type}`;
    const lines = wrap(ctx, o.caption, 340 * u).slice(0, 3);
    const bx = n === 3 ? 640 * u : 80 * u, by = n === 1 ? 160 * u : H - 300 * u;
    ctx.fillStyle = light ? "#1d3f74" : "#9ad9ec";
    ctx.fillRect(bx, by, 380 * u, (lines.length * 42 + 40) * u);
    ctx.fillStyle = light ? "#f1ece1" : "#123150";
    lines.forEach((l, i) => ctx.fillText(l, bx + 20 * u, by + 54 * u + i * 42 * u));
  }
  grain(ctx, W, H, 0.14);
}

export const TEMPLATES: TemplateDef[] = [
  { id: "halfframe", name: "半格胶片", en: "Half-Frame", min: 2, max: 2, size: [1500, 1040], fields: ["edge", "swap", "date"], draw: drawHalf },
  { id: "polaroid", name: "拍立得手记", en: "Polaroid", min: 1, max: 4, size: [1080, 1440], fields: ["caption", "date"], draw: drawPolaroid },
  { id: "solo", name: "文艺单张", en: "Solo Print", min: 1, max: 1, size: [1080, 1440], fields: ["caption", "note", "paper"], papers: SOLO_PAPERS, draw: drawSolo },
  { id: "blur", name: "动态景深", en: "Motion Blur", min: 1, max: 3, pro: true, size: [1080, 1440], fields: ["caption", "swap"], draw: drawBlur },
  { id: "travel", name: "旅行画报", en: "Travel Zine", min: 1, max: 3, pro: true, size: [1080, 1440], fields: ["note", "caption", "paper"], papers: TRAVEL_PAPERS, draw: drawTravel },
];

export function getTemplate(id: TemplateId) {
  return TEMPLATES.find((t) => t.id === id)!;
}

/** 选 N 张时该模板能不能用 */
export function usable(t: TemplateDef, count: number) {
  return count >= t.min;
}

/** 模板实际用几张（多出来的取前几张） */
export function takeCount(t: TemplateDef, count: number) {
  return Math.min(count, t.max);
}

/** 按张数和相机类型推荐模板 */
export function recommendTemplate(count: number, category: CameraCategory | null): TemplateId {
  if (count === 2) return "halfframe";
  if (count >= 4) return "polaroid";
  if (count === 3) return category === "film" ? "travel" : "blur";
  if (category === "instant") return "polaroid";
  if (category === "ccd") return "blur";
  return "solo";
}

export function defaultOptions(filmName: string | null, place: string | null = null): TemplateOptions {
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { caption: place ?? "", note: "", date, paper: 0, swap: false, edge: true, filmName: filmName ?? "DAZZ 400" };
}
