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

// ── ② 拍立得手记：相纸 + 渗墨日期章 + 打字机文字 ────────────────
function polaroidCard(ctx: Ctx, img: Img, cx: number, cy: number, w: number, deg: number, o: TemplateOptions, u: number, seed: number, big: boolean) {
  const m = w * 0.06, iw = w - m * 2, bottom = w * (big ? 0.27 : 0.24);
  const h = m + iw + bottom;
  withRot(ctx, cx, cy, deg, () => {
    const x = cx - w / 2, y = cy - h / 2;
    softShadow(ctx, u);
    ctx.fillStyle = "#fbfaf5";
    ctx.fillRect(x, y, w, h);
    noShadow(ctx);
    // 细密斜纹压纹
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.strokeStyle = "rgba(120,110,95,0.06)";
    ctx.lineWidth = 1 * u;
    for (let k = -h; k < w; k += 5 * u) {
      ctx.beginPath();
      ctx.moveTo(x + k, y);
      ctx.lineTo(x + k + h, y + h);
      ctx.stroke();
    }
    ctx.restore();
    cover(ctx, img, x + m, y + m, iw, iw);
    // 相框内陷阴影
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = 2 * u;
    ctx.strokeRect(x + m, y + m, iw, iw);
    const by = y + m + iw;
    const ts = w * (big ? 0.046 : 0.06);
    inkStamp(ctx, stampText(o.date), x + w - m - ts * 6.6, by + bottom * 0.72, ts, "#c8572a", -2.2, seed);
    if (o.caption && big) {
      ctx.fillStyle = "#2a2622";
      ctx.font = `${w * 0.045}px ${FONTS.type}`;
      ctx.textBaseline = "middle";
      const line = wrap(ctx, o.caption, iw * 0.62)[0] ?? "";
      ctx.fillText(line, x + m, by + bottom * 0.42);
    }
  });
}

function drawPolaroid(ctx: Ctx, W: number, H: number, imgs: Img[], o: TemplateOptions) {
  const u = W / 1080;
  paper(ctx, W, H, ["#ece8df", "#d9e2ea", "#efd9c7"][o.paper] ?? "#ece8df", 11, 0.04);
  const n = imgs.length;
  if (n === 1) {
    polaroidCard(ctx, imgs[0]!, W / 2, H * 0.47, 800 * u, -1.6, o, u, 21, true);
    tape(ctx, W / 2 + 10 * u, H * 0.47 - 520 * u, 230 * u, 64 * u, 3, "clear", u);
  } else {
    const slots: [number, number, number][] =
      n === 2 ? [[300, 720, -3], [780, 800, 2.5]] :
      n === 3 ? [[300, 470, -3], [780, 520, 2.5], [540, 1050, -1]] :
      [[290, 460, -3], [790, 500, 2.4], [300, 1030, 1.8], [790, 1060, -2.2]];
    slots.forEach(([x, y, d], i) => polaroidCard(ctx, imgs[i]!, x * u, y * u + (n === 4 ? 40 * u : 0), 440 * u, d, o, u, 31 + i, false));
    // 标题：打字机大字
    ctx.fillStyle = "#2a2622";
    ctx.font = `${70 * u}px ${FONTS.type}`;
    ctx.textAlign = "center";
    ctx.fillText(o.caption || "DAILY LIFE", W / 2, 130 * u);
    ctx.font = `${30 * u}px ${FONTS.hand}`;
    ctx.fillStyle = "#c8572a";
    ctx.fillText(o.note ? wrap(ctx, o.note, W * 0.8)[0]! : "", W / 2, H - 50 * u);
    ctx.textAlign = "left";
    star(ctx, 150 * u, 215 * u, 30 * u, "#c8572a", 4);
    sparkle(ctx, W - 150 * u, 220 * u, 36 * u, "#c8572a", 8);
  }
  if (n === 1 && o.note) {
    ctx.fillStyle = "#3a332c";
    ctx.font = `${44 * u}px ${FONTS.hand}`;
    ctx.textAlign = "center";
    wrap(ctx, o.note, W * 0.7).slice(0, 2).forEach((l, i) => ctx.fillText(l, W / 2, H - 150 * u + i * 56 * u));
    ctx.textAlign = "left";
  }
  grain(ctx, W, H, 0.1);
}

// ── ③ 文艺单张：大留白 + 沿照片边缘的手写字 ──────────────────────
const SOLO_PAPERS = [
  { label: "冷白纸", color: "#f3f1ec", ink: "#e2332a" },
  { label: "克莱因蓝", color: "#2260b5", ink: "#f4f1e6" },
  { label: "暖橙", color: "#e88b2e", ink: "#fbf3e2" },
];
function drawSolo(ctx: Ctx, W: number, H: number, imgs: Img[], o: TemplateOptions) {
  const u = W / 1080;
  const p = SOLO_PAPERS[o.paper] ?? SOLO_PAPERS[0]!;
  paper(ctx, W, H, p.color, 17, o.paper ? 0.07 : 0.03);
  const r = fit(imgs[0]!, 220 * u, 330 * u, 620 * u, 760 * u);
  softShadow(ctx, u, 0.5);
  ctx.drawImage(imgs[0]!, r.x, r.y, r.w, r.h);
  noShadow(ctx);
  // 手写文字：沿顶边写，写不下就转到右侧竖排
  const text = o.note || "今天的阳光，刚好落在你身上。";
  const size = 46 * u;
  ctx.font = `${size}px ${FONTS.hand}`;
  ctx.fillStyle = p.ink;
  ctx.textBaseline = "alphabetic";
  const rand = rng(9);
  let x = r.x + 8 * u, y = r.y - 26 * u, vertical = false;
  for (const ch of text) {
    const w = ctx.measureText(ch).width;
    if (!vertical && x + w > r.x + r.w + 40 * u) {
      vertical = true;
      x = r.x + r.w + 30 * u;
      y = r.y + 10 * u;
    }
    if (vertical && y > r.y + r.h + 20 * u) break;
    ctx.save();
    if (vertical) {
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 2 + (rand() - 0.5) * 0.08);
      ctx.fillText(ch, 0, 0);
      y += w + 2 * u;
    } else {
      ctx.translate(x, y + (rand() - 0.5) * 4 * u);
      ctx.rotate((rand() - 0.5) * 0.08);
      ctx.fillText(ch, 0, 0);
      x += w + 1 * u;
    }
    ctx.restore();
  }
  // 底部打字机小字
  ctx.font = `${30 * u}px ${FONTS.type}`;
  ctx.globalAlpha = 0.8;
  ctx.textAlign = "center";
  wrap(ctx, o.caption, 640 * u).slice(0, 3).forEach((l, i) => ctx.fillText(l, W / 2, r.y + r.h + 110 * u + i * 44 * u));
  ctx.textAlign = "left";
  ctx.globalAlpha = 1;
  if (o.paper === 2) {
    const sr = rng(41);
    for (let i = 0; i < 9; i++) {
      const sx = sr() * W, sy = sr() < 0.5 ? sr() * 260 * u : H - sr() * 260 * u;
      star(ctx, sx, sy, (16 + sr() * 40) * u, "rgba(60,30,10,0.5)", 50 + i, sr() > 0.5 ? "#3b2a1c" : "#f6dcae", 0.04);
    }
  }
  if (o.paper === 1) {
    [[r.x + 40 * u, r.y + 70 * u], [r.x + r.w - 60 * u, r.y + r.h * 0.4], [r.x + 60 * u, r.y + r.h - 80 * u]].forEach(([sx, sy], i) =>
      star(ctx, sx!, sy!, 34 * u, "#f4f1e6", 60 + i));
  }
  grain(ctx, W, H, o.paper ? 0.2 : 0.08);
}

// ── ④ 氛围动态景深：动态模糊背景 + 前景照片 + 黄色星芒 ───────────
function drawBlur(ctx: Ctx, W: number, H: number, imgs: Img[], o: TemplateOptions) {
  const u = W / 1080;
  const bg = imgs[o.swap && imgs.length > 1 ? imgs.length - 1 : 0]!;
  ctx.save();
  ctx.filter = `blur(${14 * u}px)`;
  for (let i = -6; i <= 6; i++) {
    ctx.globalAlpha = i === -6 ? 1 : 0.16;
    cover(ctx, bg, -80 * u + i * 26 * u, -40 * u, W + 160 * u, H + 80 * u);
  }
  ctx.restore();
  ctx.fillStyle = "rgba(10,14,30,0.12)";
  ctx.fillRect(0, 0, W, H);
  const n = imgs.length;
  const fw = n === 1 ? 700 * u : 560 * u;
  const gap = 70 * u;
  const fh = n === 1 ? 900 * u : Math.min(420 * u, (H - 260 * u - gap * (n - 1)) / n);
  const top = (H - (fh * n + gap * (n - 1))) / 2;
  const fg = n > 1 && o.swap ? [...imgs].reverse() : imgs;
  fg.forEach((img, i) => {
    const y = top + i * (fh + gap);
    softShadow(ctx, u, 0.6);
    ctx.fillStyle = "#000";
    ctx.fillRect((W - fw) / 2, y, fw, fh);
    noShadow(ctx);
    cover(ctx, img, (W - fw) / 2, y, fw, fh);
  });
  const sr = rng(77);
  const spots: [number, number][] = [[0.2, 0.28], [0.74, 0.27], [0.86, 0.42], [0.38, 0.4], [0.77, 0.6], [0.24, 0.7], [0.54, 0.72], [0.72, 0.8], [0.12, 0.5]];
  spots.forEach(([sx, sy], i) => sparkle(ctx, sx * W + (sr() - 0.5) * 30 * u, sy * H, (34 + sr() * 30) * u, "#f2c531", 90 + i, 9 + (i % 3)));
  if (o.caption) {
    ctx.fillStyle = "#f6efd9";
    ctx.font = `${34 * u}px ${FONTS.type}`;
    ctx.textAlign = "center";
    ctx.fillText(wrap(ctx, o.caption, W * 0.8)[0] ?? "", W / 2, H - 60 * u);
    ctx.textAlign = "left";
  }
  grain(ctx, W, H, 0.22);
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
  { id: "polaroid", name: "拍立得手记", en: "Polaroid", min: 1, max: 4, size: [1080, 1440], fields: ["caption", "date", "note", "paper"],
    papers: [{ label: "米灰", color: "#ece8df" }, { label: "雾蓝", color: "#d9e2ea" }, { label: "杏粉", color: "#efd9c7" }], draw: drawPolaroid },
  { id: "solo", name: "文艺单张", en: "Solo Print", min: 1, max: 1, size: [1080, 1440], fields: ["note", "caption", "paper"], papers: SOLO_PAPERS, draw: drawSolo },
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

export function defaultOptions(filmName: string | null): TemplateOptions {
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { caption: "first light, slow afternoon", note: "", date, paper: 0, swap: false, edge: true, filmName: filmName ?? "DAZZ 400" };
}
