// 蜡笔笔触：沿路径等距撒小色点，透明度和位置轻微随机，形成颗粒感。
// 线宽按画布尺寸缩放，所以预览和 4000px 导出看起来一样。
import { rng } from "@/lib/templates/draw";

export type Pt = [number, number];
export type LineStyle = "solid" | "dash" | "dot";

/** 把折线按弧长等距重采样 */
export function resample(pts: Pt[], step: number): Pt[] {
  if (pts.length < 2) return pts.slice();
  const out: Pt[] = [pts[0]!];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]!, [x1, y1] = pts[i]!;
    const seg = Math.hypot(x1 - x0, y1 - y0);
    let d = step - carry;
    while (d <= seg) {
      const t = d / seg;
      out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
      d += step;
    }
    carry = seg - (d - step);
  }
  return out;
}

/** Chaikin 平滑，让折线变成顺滑的手绘曲线 */
export function smooth(pts: Pt[], iterations = 2, closed = false): Pt[] {
  let p = pts;
  for (let k = 0; k < iterations && p.length > 2; k++) {
    const q: Pt[] = closed ? [] : [p[0]!];
    const n = closed ? p.length : p.length - 1;
    for (let i = 0; i < n; i++) {
      const a = p[i]!, b = p[(i + 1) % p.length]!;
      q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    if (!closed) q.push(p[p.length - 1]!);
    p = q;
  }
  return p;
}

/** 平滑噪声：几条随机相位的正弦叠加，值域约 -1..1 */
function noise1(r: () => number) {
  const f = [1, 2.3, 5.1].map((k) => ({ k, p: r() * Math.PI * 2, a: 1 / k }));
  const sum = f.reduce((s, x) => s + x.a, 0);
  return (t: number) => f.reduce((s, x) => s + Math.sin(t * x.k + x.p) * x.a, 0) / sum;
}

export type CrayonOpts = {
  /** 手抖幅度（线宽倍数），0 = 不抖 */
  wobble?: number;
  /** 起笔收笔变细 */
  taper?: boolean;
};

/**
 * 画一条蜡笔线：手抖、笔压起伏、起收笔变细、纸纹造成的颗粒和小断口。
 * @param w 线宽（画布像素）
 */
export function crayon(ctx: CanvasRenderingContext2D, pts: Pt[], color: string, w: number, seed: number, style: LineStyle = "solid", opts: CrayonOpts = {}) {
  if (pts.length < 2 || w <= 0) return;
  const r = rng(seed);
  const wobble = opts.wobble ?? 0.55, taper = opts.taper ?? true;
  const step = Math.max(0.6, w * 0.3);
  const samples = resample(pts, step);
  const total = samples.length * step;
  // 虚线/点线：每一段/每个点的长度和间距都随机一点，像手画的，不那么规则
  const shake = noise1(r), press = noise1(r), tooth = noise1(r);
  const wl = w * 14; // 手抖的波长
  const gaps: boolean[] = [];
  if (style !== "solid") {
    let s = 0;
    while (s < samples.length * step) {
      const on = style === "dash" ? w * (2.4 + r() * 3.6) : step * 1.01;
      const off = style === "dash" ? w * (1.8 + r() * 2.4) : w * (1.8 + r() * 1.6);
      for (let x = s; x < s + on; x += step) gaps.push(false);
      for (let x = s + on; x < s + on + off; x += step) gaps.push(true);
      s += on + off;
    }
  }
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < samples.length; i++) {
    const s = i * step;
    if (style !== "solid" && gaps[i]) continue;
    // 纸纹：偶尔的小断口
    if (style === "solid" && tooth(s / (w * 2.2)) > 0.8) continue;
    const [x0, y0] = samples[i]!;
    const [xa, ya] = samples[Math.max(0, i - 1)]!, [xb, yb] = samples[Math.min(samples.length - 1, i + 1)]!;
    const len = Math.hypot(xb - xa, yb - ya) || 1;
    const nx = -(yb - ya) / len, ny = (xb - xa) / len; // 法线
    const off = shake(s / wl) * w * wobble;
    const x = x0 + nx * off, y = y0 + ny * off;
    // 笔压：缓慢起伏 + 起收笔变细
    let p = 0.78 + 0.22 * press(s / (w * 18));
    if (taper && style === "solid") {
      // 短笔画（太阳光芒等）收得少一点，长线收得明显
      const edge = Math.min(s, total - s) / Math.max(1, Math.min(w * 6, total * 0.3));
      p *= 0.45 + 0.55 * Math.min(1, edge);
    }
    const dabs = style === "dot" ? 4 : 3;
    for (let k = 0; k < dabs; k++) {
      const rad = (w * (style === "dot" ? 0.62 : 0.52)) * p * (0.5 + r() * 0.55);
      ctx.globalAlpha = 0.45 + r() * 0.5;
      ctx.beginPath();
      ctx.arc(x + (r() - 0.5) * w * 0.5, y + (r() - 0.5) * w * 0.5, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Catmull-Rom 曲线穿过所有控制点，适合画松弛的长线 */
export function spline(ctrl: Pt[], perSeg = 16): Pt[] {
  if (ctrl.length < 3) return ctrl;
  const p = [ctrl[0]!, ...ctrl, ctrl[ctrl.length - 1]!];
  const out: Pt[] = [];
  for (let i = 1; i < p.length - 2; i++) {
    const [p0, p1, p2, p3] = [p[i - 1]!, p[i]!, p[i + 1]!, p[i + 2]!];
    for (let j = 0; j < perSeg; j++) {
      const t = j / perSeg, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((d) =>
        0.5 * (2 * p1[d]! + (-p0[d]! + p2[d]!) * t + (2 * p0[d]! - 5 * p1[d]! + 4 * p2[d]! - p3[d]!) * t2 + (-p0[d]! + 3 * p1[d]! - 3 * p2[d]! + p3[d]!) * t3),
      ) as Pt);
    }
  }
  out.push(ctrl[ctrl.length - 1]!);
  return out;
}
