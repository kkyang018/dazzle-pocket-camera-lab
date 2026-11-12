// 手绘单张的版式与绘制。所有位置都按照片矩形和画布宽度换算，
// 所以同一份计划在预览（1080）和导出（4000）上画出来完全一致。
import { grain, rng, type Ctx, type Img } from "@/lib/templates/draw";
import { crayon, smooth, type LineStyle, type Pt } from "./crayon";
import { MOTIFS, accentStrokes, type Stroke } from "./motifs";
import { paperColor, toHex } from "./plan";
import type { Anchor, MotifSize, SoloData } from "./types";

export type PhotoRect = { px: number; py: number; pw: number; ph: number };

/** 照片保持原比例，横图约占 60% 宽，方图 54%，竖图 48%，略高于正中 */
export function soloPhotoRect(W: number, H: number, img: { width: number; height: number }): PhotoRect {
  const ar = img.width / img.height;
  let pw = W * (ar >= 1.2 ? 0.6 : ar >= 0.85 ? 0.54 : 0.48);
  let ph = pw / ar;
  if (ph > H * 0.5) { ph = H * 0.5; pw = ph * ar; }
  return { px: (W - pw) / 2, py: H * 0.48 - ph / 2, pw, ph };
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

/** 锚点在照片外侧的位置（单位：照片矩形），角上的更靠外 */
function anchorPoint(a: Anchor, r: PhotoRect, rand: () => number, W: number): Pt {
  const out = W * 0.07, j = () => (rand() - 0.5);
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

/** 一条从纸上出发、越过照片边缘的长线 */
function flowLine(r: PhotoRect, k: number, rand: () => number, W: number): Pt[] {
  const { px, py, pw, ph } = r;
  const corner = k % 4; // 0 左上 1 右上 2 右下 3 左下
  const sx = corner === 0 || corner === 3 ? -1 : 1, sy = corner < 2 ? -1 : 1;
  const cx = sx < 0 ? px : px + pw, cy = sy < 0 ? py : py + ph;
  const far = W * (0.14 + rand() * 0.08);
  // 一半从侧面进，一半从上下进
  const side = rand() < 0.5;
  const start: Pt = side ? [cx + sx * far, cy - sy * ph * (0.25 + rand() * 0.3)] : [cx - sx * pw * (0.2 + rand() * 0.3), cy + sy * far * 0.9];
  const bend: Pt = [cx + sx * W * (0.03 + rand() * 0.05), cy + sy * W * (0.03 + rand() * 0.05)];
  const inside: Pt = side
    ? [cx - sx * pw * (0.04 + rand() * 0.08), cy + sy * W * (0.06 + rand() * 0.06)]
    : [cx - sx * W * (0.02 + rand() * 0.05), cy - sy * ph * (0.06 + rand() * 0.1)];
  const wobble: Pt = [(start[0] + bend[0]) / 2 + (rand() - 0.5) * W * 0.08, (start[1] + bend[1]) / 2 + (rand() - 0.5) * W * 0.08];
  return smooth([start, wobble, bend, inside], 4);
}

function strokeAll(ctx: Ctx, strokes: Stroke[], colors: string[], ci: number, cx: number, cy: number, size: number, deg: number, flip: boolean, lw: number, seed: number, style?: LineStyle) {
  strokes.forEach((s, i) => {
    const color = colors[(ci + (s.c ?? 0)) % colors.length]!;
    crayon(ctx, place(s.pts, cx, cy, size, deg, flip), color, lw * (s.w ?? 1), seed + i * 13, s.style ?? style ?? "solid");
  });
}

export function drawSoloCard(ctx: Ctx, W: number, H: number, img: Img, data: SoloData | null, seed: number) {
  const u = W / 1080;
  const rect = soloPhotoRect(W, H, img);
  const { px, py, pw, ph } = rect;
  const plan = data?.plan;
  const avg = averageColor(img);
  ctx.fillStyle = plan?.background ?? paperColor(toHex([avg[0] * 0.25 + 245 * 0.75, avg[1] * 0.25 + 239 * 0.75, avg[2] * 0.25 + 228 * 0.75]));
  ctx.fillRect(0, 0, W, H);

  if (!plan) {
    ctx.drawImage(img, px, py, pw, ph);
    grain(ctx, W, H, 0.04);
    return;
  }

  const lw = 6 * u;
  const colors = plan.colors.length ? plan.colors : ["#C9824F"];
  // 照片里的点缀用最深的颜色，浅色画在照片上会看不见
  const lumOf = (h: string) => { const v = parseInt(h.slice(1), 16); return (0.299 * (v >> 16) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255; };
  const deepest = colors.reduce((a, b) => (lumOf(b) < lumOf(a) ? b : a));
  const rand = rng(seed * 7919 + 17);
  const flip = seed % 2 === 0; // "换一组"时左右镜像，再加上随机抖动

  // 挑图案：按种子打乱候选，留 3–5 个
  const pool = plan.motifs.slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j]!, pool[i]!]; }
  const motifs = pool.slice(0, Math.min(pool.length, 4 + Math.floor(rand() * 3)));
  const placed = motifs.map((m, i) => {
    const anchor = flip ? MIRROR[m.anchor] : m.anchor;
    const [x, y] = anchorPoint(anchor, rect, rand, W);
    const size = W * SIZE[m.size] * (m.kind === "cloud" && m.size === "l" ? 1.5 : 1) * (0.85 + rand() * 0.3);
    return { m, x, y, size, deg: m.kind === "cloud" || m.kind === "wave" ? (rand() - 0.5) * 8 : (rand() - 0.5) * 30, ci: (i + 1) % colors.length };
  });
  // 同一锚点的图案沿边错开，避免叠在一起
  placed.forEach((a, i) => placed.slice(0, i).forEach((b) => {
    const d = Math.hypot(a.x - b.x, a.y - b.y), min = (a.size + b.size) * 1.15;
    if (d < min) { a.x += (min - d) * (a.x >= W / 2 ? 1 : -1) * 0.8; a.y += (min - d) * 0.5; }
  }));

  const drawMotif = (p: (typeof placed)[number], k: number) =>
    strokeAll(ctx, MOTIFS[p.m.kind](rng(seed * 31 + k)), colors, p.ci, p.x, p.y, p.size, p.deg, flip, lw * 0.9, seed * 101 + k * 7);

  // 大图案（云）在照片后面，被照片压住一角
  placed.forEach((p, k) => p.m.size === "l" && drawMotif(p, k));

  ctx.drawImage(img, px, py, pw, ph);

  // 越过照片边缘的长线：实线 / 虚线 / 点线轮换
  const styles: LineStyle[] = ["solid", "dash", "dot"];
  // 长线分散到不同的角：先对角，再补另外两个角
  const startCorner = Math.floor(rand() * 4);
  const corners = [0, 2, 1, 3].map((d) => (startCorner + d) % 4);
  for (let k = 0; k < plan.flows; k++) {
    const line = flowLine(rect, corners[k % 4]!, rand, W);
    crayon(ctx, line, colors[(k + 1) % colors.length]!, lw * (k === 0 ? 1 : 0.85), seed * 211 + k, styles[(k + seed) % 3]!);
  }

  placed.forEach((p, k) => p.m.size !== "l" && drawMotif(p, k));

  // 主体描边：贴着人物、在照片边缘断开
  const outline = data?.outline;
  if (outline) {
    outline.paths.forEach((path, i) => {
      const pts = path.map(([x, y]) => [px + x * pw, py + y * ph] as Pt);
      crayon(ctx, pts, colors[0]!, lw * (i ? 0.85 : 1), seed * 401 + i, "solid");
    });
  }

  // 照片里的点缀：AI 给位置；没有时在人物肩旁放几道小线
  let accents = plan.accents;
  if (!accents.length && outline) {
    const [bx, by, bw, bh] = outline.box;
    accents = [{ kind: "ticks", x: Math.min(0.95, bx + bw * 0.92), y: by + bh * 0.12, angle: -35 }];
  }
  accents.forEach((a, k) => {
    const size = W * (a.kind === "speed" ? 0.07 : 0.05);
    strokeAll(ctx, accentStrokes(a.kind, rng(seed * 53 + k)), [deepest], 0, px + a.x * pw, py + a.y * ph, size, a.angle, false, lw * 0.85, seed * 601 + k * 11);
  });

  grain(ctx, W, H, 0.04);
}
