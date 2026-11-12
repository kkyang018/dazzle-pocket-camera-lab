// 人物遮罩 → 手绘描边路径（纯计算，不依赖 DOM，方便测试）。
// 步骤：二值化 → 留下主要人物 → 向外膨胀一点（描边离身体有点距离）→ 沿边界追踪
// → 在照片边缘处断开（人被画面裁到的地方不画线）→ 简化 + 平滑 → 归一化到 0–1。
import type { Outline } from "./types";
import { smooth, type Pt } from "./crayon";

type Mask = ArrayLike<number>;

/** 4 邻接连通域，返回每个像素的编号和各连通域面积 */
function components(bin: Uint8Array, w: number, h: number) {
  const label = new Int32Array(w * h).fill(-1);
  const areas: number[] = [];
  const stack: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (!bin[i] || label[i]! >= 0) continue;
    const id = areas.length;
    let area = 0;
    label[i] = id;
    stack.push(i);
    while (stack.length) {
      const p = stack.pop()!;
      area++;
      const x = p % w, y = (p / w) | 0;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of nb) if (q >= 0 && bin[q] && label[q]! < 0) { label[q] = id; stack.push(q); }
    }
    areas.push(area);
  }
  return { label, areas };
}

/** 用倒角距离把前景向外膨胀 r 像素 */
function dilate(bin: Uint8Array, w: number, h: number, r: number) {
  const INF = 1e9, d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = bin[i] ? 0 : INF;
  const D = Math.SQRT2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    let v = d[i]!;
    if (x > 0) v = Math.min(v, d[i - 1]! + 1);
    if (y > 0) {
      v = Math.min(v, d[i - w]! + 1);
      if (x > 0) v = Math.min(v, d[i - w - 1]! + D);
      if (x < w - 1) v = Math.min(v, d[i - w + 1]! + D);
    }
    d[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    let v = d[i]!;
    if (x < w - 1) v = Math.min(v, d[i + 1]! + 1);
    if (y < h - 1) {
      v = Math.min(v, d[i + w]! + 1);
      if (x < w - 1) v = Math.min(v, d[i + w + 1]! + D);
      if (x > 0) v = Math.min(v, d[i + w - 1]! + D);
    }
    d[i] = v;
  }
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = d[i]! <= r ? 1 : 0;
  return out;
}

// 顺时针 8 邻域（y 向下）：W, NW, N, NE, E, SE, S, SW
const DIRS: Pt[] = [[-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]];
const dirOf = (dx: number, dy: number) => DIRS.findIndex(([a, b]) => a === dx && b === dy);

/** Moore 邻域边界追踪，从光栅顺序第一个前景像素开始 */
function trace(bin: Uint8Array, w: number, h: number, start: number): Pt[] {
  const fg = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && bin[y * w + x] === 1;
  let px = start % w, py = (start / w) | 0, back = 0;
  const sx = px, sy = py;
  const out: Pt[] = [[px, py]];
  const max = w * h * 4;
  for (let n = 0; n < max; n++) {
    let found = -1;
    for (let k = 1; k <= 8; k++) {
      const d = (back + k) % 8;
      if (fg(px + DIRS[d]![0], py + DIRS[d]![1])) { found = d; break; }
    }
    if (found < 0) break;
    const prev = (found + 7) % 8;
    const bx = px + DIRS[prev]![0], by = py + DIRS[prev]![1];
    px += DIRS[found]![0];
    py += DIRS[found]![1];
    back = dirOf(bx - px, by - py);
    if (back < 0) back = (found + 4) % 8;
    if (px === sx && py === sy) break;
    out.push([px, py]);
  }
  return out;
}

/** Ramer–Douglas–Peucker 简化 */
function rdp(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0]!, [bx, by] = pts[pts.length - 1]!;
  const len = Math.hypot(bx - ax, by - ay) || 1;
  let idx = 0, best = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i]!;
    const d = Math.abs((by - ay) * x - (bx - ax) * y + bx * ay - by * ax) / len;
    if (d > best) { best = d; idx = i; }
  }
  if (best <= eps) return [pts[0]!, pts[pts.length - 1]!];
  return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)];
}

/**
 * @param faces 人脸框（遮罩像素坐标 x,y,w,h）。传入时只保留含有人脸的区域，
 *   避免把书本、靠枕之类误认成人；传空数组表示没找到脸 → 不描边。
 */
export function maskToOutline(mask: Mask, w: number, h: number, threshold = 0.5, faces?: [number, number, number, number][]): Outline | null {
  const n = w * h;
  const bin = new Uint8Array(n);
  for (let i = 0; i < n; i++) bin[i] = mask[i]! >= threshold ? 1 : 0;
  const { label, areas } = components(bin, w, h);
  if (!areas.length) return null;
  const largest = Math.max(...areas);
  let withFace: Set<number> | null = null;
  if (faces) {
    withFace = new Set();
    for (const [fx, fy, fw, fh] of faces) {
      // 脸框里取几个点，落在哪个区域就算那个区域有人
      for (const [tx, ty] of [[0.5, 0.5], [0.5, 0.75], [0.3, 0.6], [0.7, 0.6], [0.5, 1.1]]) {
        const x = Math.round(fx + fw * tx!), y = Math.round(fy + fh * ty!);
        if (x >= 0 && y >= 0 && x < w && y < h && label[y * w + x]! >= 0) withFace.add(label[y * w + x]!);
      }
    }
    if (!withFace.size) return null;
  }
  // 主要人物：面积够大，最多 3 个
  const keep = new Set(areas.map((a, i) => [a, i] as const)
    .filter(([a, i]) => (withFace ? withFace.has(i) && a >= n * 0.01 : a >= n * 0.015 && a >= largest * 0.3))
    .sort((a, b) => b[0] - a[0]).slice(0, 3).map(([, i]) => i));
  if (!keep.size) return null;
  const total = [...keep].reduce((s, i) => s + areas[i]!, 0);
  if (total < n * 0.03 || total > n * 0.9) return null;

  const person = new Uint8Array(n);
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let i = 0; i < n; i++) if (keep.has(label[i]!)) {
    person[i] = 1;
    const x = i % w, y = (i / w) | 0;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const r = Math.max(2, Math.round(Math.max(w, h) * 0.014));
  const grown = dilate(person, w, h, r);
  const grownComp = components(grown, w, h);

  const margin = 2;
  const onEdge = ([x, y]: Pt) => x <= margin || y <= margin || x >= w - 1 - margin || y >= h - 1 - margin;
  const paths: Pt[][] = [];
  grownComp.areas.forEach((area, id) => {
    if (area < n * 0.015) return;
    const start = grownComp.label.findIndex((l) => l === id);
    let loop = trace(grown, w, h, start);
    if (loop.length < 20) return;
    const edgeAt = loop.findIndex(onEdge);
    let runs: Pt[][] = [];
    if (edgeAt < 0) {
      // 人完整在画面里：在最低点留个缺口，保持"开放"的手绘感
      let low = 0;
      loop.forEach(([, y], i) => { if (y > loop[low]![1]) low = i; });
      loop = [...loop.slice(low), ...loop.slice(0, low)];
      const cut = Math.round(loop.length * 0.05);
      runs = [loop.slice(cut, loop.length - cut)];
    } else {
      // 从照片边缘处断开，人被裁到的那一侧不画
      const rot = [...loop.slice(edgeAt), ...loop.slice(0, edgeAt)];
      let cur: Pt[] = [];
      for (const p of rot) {
        if (onEdge(p)) { if (cur.length) runs.push(cur); cur = []; } else cur.push(p);
      }
      if (cur.length) runs.push(cur);
    }
    for (const run of runs) if (run.length >= Math.max(24, (w + h) * 0.08)) paths.push(run);
  });
  if (!paths.length) return null;
  const tidy = paths.sort((a, b) => b.length - a.length).slice(0, 3)
    .map((p) => smooth(rdp(p, Math.max(1, Math.max(w, h) * 0.003)), 2).map(([x, y]) => [x / w, y / h] as Pt));
  return { paths: tidy, box: [x0 / w, y0 / h, (x1 - x0 + 1) / w, (y1 - y0 + 1) / h] };
}
