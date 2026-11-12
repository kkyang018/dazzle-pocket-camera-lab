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

/**
 * 画一条蜡笔线。
 * @param w 线宽（画布像素）
 */
export function crayon(ctx: CanvasRenderingContext2D, pts: Pt[], color: string, w: number, seed: number, style: LineStyle = "solid") {
  if (pts.length < 2 || w <= 0) return;
  const r = rng(seed);
  const step = Math.max(0.6, w * 0.32);
  const samples = resample(pts, step);
  // 虚线/点线：按弧长决定哪些点要画
  const dashOn = w * 3.6, dashOff = w * 2.6, dotGap = w * 2.4;
  ctx.save();
  ctx.fillStyle = color;
  // 轻微的笔压起伏：线宽沿路径缓慢变化
  const phase = r() * 10;
  for (let i = 0; i < samples.length; i++) {
    const s = i * step;
    if (style === "dash" && s % (dashOn + dashOff) > dashOn) continue;
    if (style === "dot" && s % dotGap > step * 1.01) continue;
    const [x, y] = samples[i]!;
    const press = 0.82 + 0.18 * Math.sin(s / (w * 9) + phase);
    const dabs = style === "dot" ? 4 : 3;
    for (let k = 0; k < dabs; k++) {
      const rad = (w * (style === "dot" ? 0.62 : 0.5)) * press * (0.55 + r() * 0.5);
      ctx.globalAlpha = 0.62 + r() * 0.36;
      ctx.beginPath();
      ctx.arc(x + (r() - 0.5) * w * 0.45, y + (r() - 0.5) * w * 0.45, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
