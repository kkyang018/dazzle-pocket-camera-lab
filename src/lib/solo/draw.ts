// 手绘单张的版式与绘制。所有位置都按照片矩形和画布宽度换算，
// 所以同一份计划在预览（1080）和导出（4000）上画出来完全一致。
import { FRAMES } from "@/lib/render";
import { grain, noShadow, rng, softShadow, type Ctx, type Img } from "@/lib/templates/draw";
import { crayon, spline, type LineStyle, type Pt } from "./crayon";
import { MOTIFS, accentStrokes, type Stroke } from "./motifs";
import { inkColor, lum, paperColor, toHex, toRgb } from "./plan";
import type { Anchor, MotifSize, Outline, SoloData } from "./types";

export type PhotoRect = { px: number; py: number; pw: number; ph: number };

/** 照片保持原比例，横图约占 60% 宽，方图 54%，竖图 48%，略高于正中 */
export function soloPhotoRect(W: number, H: number, img: { width: number; height: number }): PhotoRect {
  const ar = img.width / img.height;
  let pw = W * (ar >= 1.2 ? 0.6 : ar >= 0.85 ? 0.54 : 0.48);
  let ph = pw / ar;
  if (ph > H * 0.5) { ph = H * 0.5; pw = ph * ar; }
  return { px: (W - pw) / 2, py: H * 0.48 - ph / 2, pw, ph };
}

export type FrameKind = keyof typeof FRAMES;

/** 拍立得相纸里照片区域的位置（0–1，相对整张相纸） */
export function innerRect(img: { width: number; height: number }, kind: FrameKind | null): [number, number, number, number] {
  if (!kind) return [0, 0, 1, 1];
  const f = FRAMES[kind];
  const sw = img.width / (1 + 2 * f.side);
  const side = (img.width - sw) / 2, top = sw * f.top, sh = img.height - top - sw * f.bottom;
  return [side / img.width, top / img.height, sw / img.width, sh / img.height];
}

/** 从相纸上裁出照片部分（人物识别、AI 看图都用这块） */
export function cropInner(img: Img, kind: FrameKind | null): Img {
  if (!kind) return img;
  const [x, y, w, h] = innerRect(img, kind);
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * w);
  c.height = Math.round(img.height * h);
  c.getContext("2d")!.drawImage(img, img.width * x, img.height * y, c.width, c.height, 0, 0, c.width, c.height);
  return c;
}

/** 深色纸：保留 AI 选的底色色相，压到很暗 */
export function darkPaper(hex: string): string {
  const c = toRgb(hex) ?? [245, 239, 228];
  const ink: [number, number, number] = [26, 24, 22];
  return toHex([c[0] * 0.12 + ink[0] * 0.88, c[1] * 0.12 + ink[1] * 0.88, c[2] * 0.12 + ink[2] * 0.88]);
}

/** 照片平均色 → 默认纸色（AI 还没回来时用） */
export function averageColor(img: Img): [number, number, number] {
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, 16, 16);
  const d = g.getImageData(0, 0, 16, 16).data;
  let r = 0, gg = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]!; gg += d[i + 1]!; b += d[i + 2]!; }
  const n = d.length / 4;
  return [r / n, gg / n, b / n];
}

const SIZE: Record<MotifSize, number> = { s: 0.042, m: 0.062, l: 0.15 };

function place(pts: Pt[], cx: number, cy: number, s: number, deg: number, flip: boolean): Pt[] {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
  return pts.map(([x, y]) => {
    const fx = flip ? -x : x;
    return [cx + (fx * c - y * sn) * s, cy + (fx * sn + y * c) * s];
  });
}

/** 照片外的线和图案都限制在照片四周 20% 的范围内 */
export const BAND = 0.2;
type Band = { x: number; y: number; L: number; T: number; R: number; B: number; s: number };
function bandOf(r: PhotoRect): Band {
  const x = r.pw * BAND, y = r.ph * BAND;
  return { x, y, L: r.px - x, T: r.py - y, R: r.px + r.pw + x, B: r.py + r.ph + y, s: Math.min(x, y) };
}
const clampTo = (b: Band, [x, y]: Pt, pad = 0): Pt => [Math.min(b.R - pad, Math.max(b.L + pad, x)), Math.min(b.B - pad, Math.max(b.T + pad, y))];

/** 锚点在照片外侧的位置，距离按 20% 范围换算 */
function anchorPoint(a: Anchor, r: PhotoRect, rand: () => number, band: Band): Pt {
  const out = band.s * 0.55, j = () => (rand() - 0.5);
  const { px, py, pw, ph } = r;
  switch (a) {
    case "top-left": return [px - out * 0.4 + j() * out, py - out * 0.9 + j() * out * 0.5];
    case "top": return [px + pw * (0.3 + rand() * 0.4), py - out * (0.9 + rand() * 0.5)];
    case "top-right": return [px + pw + out * 0.3 + j() * out, py - out * 0.8 + j() * out * 0.5];
    case "right": return [px + pw + out * (0.7 + rand() * 0.5), py + ph * (0.3 + rand() * 0.4)];
    case "bottom-right": return [px + pw + out * 0.5 + j() * out, py + ph + out * 0.7 + j() * out * 0.5];
    case "bottom": return [px + pw * (0.3 + rand() * 0.4), py + ph + out * (0.9 + rand() * 0.4)];
    case "bottom-left": return [px - out * 0.4 + j() * out, py + ph + out * 0.8 + j() * out * 0.5];
    case "left": return [px - out * (0.7 + rand() * 0.5), py + ph * (0.3 + rand() * 0.4)];
  }
}
const MIRROR: Record<Anchor, Anchor> = {
  "top-left": "top-right", top: "top", "top-right": "top-left", right: "left",
  "bottom-right": "bottom-left", bottom: "bottom", "bottom-left": "bottom-right", left: "right",
};

/**
 * 一条从纸上出发、越过照片边缘的长线：松弛的 S 形，偶尔打一个小圈，
 * 末端落在照片边缘里一点点（参考图里线和照片"交织"的感觉）。
 */
function flowLine(r: PhotoRect, k: number, rand: () => number, band: Band): Pt[] {
  const { px, py, pw, ph } = r;
  const W = band.s * 5; // 下面的比例按"照片短边"换算，W ≈ 照片短边
  const corner = k % 4; // 0 左上 1 右上 2 右下 3 左下
  const sx = corner === 0 || corner === 3 ? -1 : 1, sy = corner < 2 ? -1 : 1;
  const cx = sx < 0 ? px : px + pw, cy = sy < 0 ? py : py + ph;
  // 起点：在角的外侧，方向随机偏向水平或竖直
  const horizontal = rand() < 0.5;
  const ang = Math.atan2(sy * (horizontal ? 0.35 : 1), sx * (horizontal ? 1 : 0.35)) + (rand() - 0.5) * 0.5;
  // 线不要伸太远：起点在 20% 范围内
  const far = band.s * (0.75 + rand() * 0.2);
  const start: Pt = [cx + Math.cos(ang) * far, cy + Math.sin(ang) * far];
  // 终点：越过照片边缘一点
  const end: Pt = horizontal
    ? [cx - sx * W * (0.02 + rand() * 0.03), cy - sy * ph * (0.12 + rand() * 0.22)]
    : [cx - sx * pw * (0.12 + rand() * 0.22), cy - sy * W * (0.02 + rand() * 0.03)];
  const dx = end[0] - start[0], dy = end[1] - start[1], L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const ctrl: Pt[] = [start];
  // 一个大弯 + 一个反向小弯，像随手一甩的弧线
  const flip = rand() < 0.5 ? 1 : -1;
  const bows = [[0.3, 0.05 + rand() * 0.04], [0.68, -(0.02 + rand() * 0.025)]] as const;
  for (const [t, a] of bows) {
    const amp = W * a * flip;
    ctrl.push([start[0] + dx * t + nx * amp, start[1] + dy * t + ny * amp]);
  }
  // 偶尔打一个圆润的小圈（在第一个弯和第二个弯之间）
  if (rand() < 0.25) {
    const [ax, ay] = ctrl[1]!, [bx, by] = ctrl[2]!;
    const mx = (ax + bx) / 2, my = (ay + by) / 2, rad = W * (0.025 + rand() * 0.012), side = flip;
    const ox = mx + nx * rad * side, oy = my + ny * rad * side;
    const base = Math.atan2(-ny * side, -nx * side);
    const loop: Pt[] = [];
    for (let j = 0; j <= 9; j++) {
      const a = base - (side * j * Math.PI * 2) / 9;
      loop.push([ox + Math.cos(a) * rad, oy + Math.sin(a) * rad]);
    }
    ctrl.splice(2, 0, ...loop);
  }
  ctrl.push(end);
  return spline(ctrl, 16).map((p) => clampTo(band, p));
}

/** 照片里的点缀挪到人物轮廓外侧（像参考图里招手旁的小线），不压在身上 */
function snapToOutline(a: { x: number; y: number }, outline: Outline, aspect: number) {
  let best: Pt | null = null, bd = Infinity;
  for (const path of outline.paths) for (const p of path) {
    const d = Math.hypot((p[0] - a.x) * aspect, p[1] - a.y);
    if (d < bd) { bd = d; best = p; }
  }
  if (!best || bd > 0.35) return null;
  const [bx, by, bw, bh] = outline.box;
  const ccx = bx + bw / 2, ccy = by + bh * 0.45;
  let dx = (best[0] - ccx) * aspect, dy = best[1] - ccy;
  const l = Math.hypot(dx, dy) || 1;
  dx /= l; dy /= l;
  return { x: best[0] + (dx * 0.07) / aspect, y: best[1] + dy * 0.07, angle: (Math.atan2(dy, dx) * 180) / Math.PI };
}

function strokeAll(ctx: Ctx, strokes: Stroke[], colors: string[], ci: number, cx: number, cy: number, size: number, deg: number, flip: boolean, lw: number, seed: number, style?: LineStyle) {
  strokes.forEach((s, i) => {
    const color = colors[(ci + (s.c ?? 0)) % colors.length]!;
    crayon(ctx, place(s.pts, cx, cy, size, deg, flip), color, lw * (s.w ?? 1), seed + i * 13, s.style ?? style ?? "solid");
  });
}

export type SoloLook = {
  /** 深色纸 */
  dark: boolean;
  /** 拍立得照片：img 是整张相纸，照片只占其中一块 */
  frame: FrameKind | null;
};

export function drawSoloCard(ctx: Ctx, W: number, H: number, img: Img, data: SoloData | null, seed: number, look: SoloLook = { dark: false, frame: null }) {
  const u = W / 1080;
  // rect = 整张画面（拍立得是整张相纸）；inner = 照片部分，描边和点缀按它换算
  const rect = soloPhotoRect(W, H, img);
  const [ix, iy, iw, ih] = innerRect(img, look.frame);
  const px = rect.px + rect.pw * ix, py = rect.py + rect.ph * iy, pw = rect.pw * iw, ph = rect.ph * ih;
  const plan = data?.plan;
  const avg = averageColor(cropInner(img, look.frame));
  const light = plan?.background ?? paperColor(toHex([avg[0] * 0.25 + 245 * 0.75, avg[1] * 0.25 + 239 * 0.75, avg[2] * 0.25 + 228 * 0.75]));
  const paper = look.dark ? darkPaper(light) : light;
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, H);

  const drawPhoto = () => {
    if (look.frame) {
      // 相纸放在纸上：一点投影
      ctx.save();
      softShadow(ctx, u, look.dark ? 1.4 : 0.8);
      ctx.drawImage(img, rect.px, rect.py, rect.pw, rect.ph);
      noShadow(ctx);
      ctx.restore();
    } else ctx.drawImage(img, rect.px, rect.py, rect.pw, rect.ph);
  };

  if (!plan) {
    drawPhoto();
    grain(ctx, W, H, 0.04);
    return;
  }

  const lw = 6 * u;
  // 深色纸上把线条色调亮，保证看得清
  const colors = (plan.colors.length ? plan.colors : ["#C9824F"]).map((c) => (look.dark ? inkColor(c, paper) : c));
  // 照片里的点缀：照片偏暗用最亮的颜色，否则用最深的颜色
  const lumOf = (h: string) => lum(toRgb(h) ?? [128, 128, 128]);
  const photoDark = lum(avg) < 0.4;
  const inPhoto = colors.reduce((a, b) => ((photoDark ? lumOf(b) > lumOf(a) : lumOf(b) < lumOf(a)) ? b : a));
  const rand = rng(seed * 7919 + 17);
  const flip = seed % 2 === 0; // "换一组"时左右镜像，再加上随机抖动

  // 挑图案：按种子打乱候选，留 3–5 个
  const pool = plan.motifs.slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j]!, pool[i]!]; }
  const motifs = pool.slice(0, Math.min(pool.length, 4 + Math.floor(rand() * 3)));
  const band = bandOf(rect);
  const placed = motifs.map((m, i) => {
    const anchor = flip ? MIRROR[m.anchor] : m.anchor;
    const [x, y] = anchorPoint(anchor, rect, rand, band);
    // 图案半径不超过 20% 范围的一半左右，大图案（云）可以更大一些、压住照片一角
    const cap = band.s * (m.size === "l" ? 0.8 : 0.42);
    const size = Math.min(cap, W * SIZE[m.size] * (0.85 + rand() * 0.3));
    return { m, x, y, size, deg: m.kind === "cloud" || m.kind === "wave" ? (rand() - 0.5) * 8 : (rand() - 0.5) * 30, ci: (i + 1) % colors.length };
  });
  // 同一锚点的图案沿边错开，避免叠在一起；最后夹回 20% 范围内
  placed.forEach((a, i) => placed.slice(0, i).forEach((b) => {
    const d = Math.hypot(a.x - b.x, a.y - b.y), min = (a.size + b.size) * 1.15;
    if (d < min) { a.x += (min - d) * (a.x >= W / 2 ? 1 : -1) * 0.8; a.y += (min - d) * 0.5; }
  }));
  placed.forEach((p) => { [p.x, p.y] = clampTo(band, [p.x, p.y], p.size); });

  const drawMotif = (p: (typeof placed)[number], k: number) =>
    strokeAll(ctx, MOTIFS[p.m.kind](rng(seed * 31 + k)), colors, p.ci, p.x, p.y, p.size, p.deg, flip, lw * 0.9, seed * 101 + k * 7);

  // 大图案（云）在照片后面，被照片压住一角
  placed.forEach((p, k) => p.m.size === "l" && drawMotif(p, k));

  drawPhoto();

  // 越过照片边缘的长线：实线 / 虚线 / 点线轮换
  const styles: LineStyle[] = ["solid", "dash", "dot"];
  // 长线分散到不同的角：先对角，再补另外两个角
  const startCorner = Math.floor(rand() * 4);
  const corners = [0, 2, 1, 3].map((d) => (startCorner + d) % 4);
  for (let k = 0; k < plan.flows; k++) {
    const line = flowLine(rect, corners[k % 4]!, rand, band);
    crayon(ctx, line, colors[(k + 1) % colors.length]!, lw * (k === 0 ? 1 : 0.85), seed * 211 + k, styles[(k + seed) % 3]!);
  }

  placed.forEach((p, k) => p.m.size !== "l" && drawMotif(p, k));

  // 主体描边：贴着人物、在照片边缘断开；再补一遍偏移的淡线，像手描了两次
  const outline = data?.outline;
  // 描边色和照片明度太接近会看不清，换成照片上最显眼的颜色
  const outlineColor = Math.abs(lumOf(colors[0]!) - lum(avg)) < 0.22 ? inPhoto : colors[0]!;
  if (outline) {
    outline.paths.forEach((path, i) => {
      const pts = path.map(([x, y]) => [px + x * pw, py + y * ph] as Pt);
      crayon(ctx, pts, outlineColor, lw * (i ? 1 : 1.2), seed * 401 + i, "solid", { wobble: 0.7 });
      // 第二遍：只描中间一段，略微错开、更细更淡
      const a = Math.floor(pts.length * (0.15 + rand() * 0.15)), b = Math.floor(pts.length * (0.55 + rand() * 0.3));
      const second = pts.slice(a, b).map(([x, y]) => [x + lw * 0.9, y - lw * 0.6] as Pt);
      ctx.save();
      ctx.globalAlpha = 0.45;
      crayon(ctx, second, outlineColor, lw * 0.55, seed * 409 + i, "solid", { wobble: 1.2 });
      ctx.restore();
    });
  }

  // 照片里的点缀：AI 给位置；有人物描边时挪到轮廓外侧，不压在身上；没有时在肩旁放几道小线
  let accents = plan.accents.map((a) => {
    if (!outline || a.kind === "speed") return a;
    const s = snapToOutline(a, outline, pw / ph);
    return s ? { ...a, ...s } : a;
  });
  if (!accents.length && outline) {
    const [bx, by, bw, bh] = outline.box;
    accents = [{ kind: "ticks", x: Math.min(0.95, bx + bw * 0.92), y: by + bh * 0.12, angle: -35 }];
  }
  accents.forEach((a, k) => {
    const size = W * (a.kind === "speed" ? 0.07 : 0.05);
    strokeAll(ctx, accentStrokes(a.kind, rng(seed * 53 + k)), [inPhoto], 0, px + a.x * pw, py + a.y * ph, size, a.angle, false, lw * 0.85, seed * 601 + k * 11);
  });

  grain(ctx, W, H, 0.04);
}
