// 本地手绘图案库：每个图案由几笔折线组成，单位坐标（中心 0,0，半径约 1）。
// 排版时再平移、缩放、旋转，用蜡笔笔触画出来，所以任何分辨率都清晰。
import type { AccentKind, MotifKind } from "./types";
import { smooth, type LineStyle, type Pt } from "./crayon";

export type Stroke = { pts: Pt[]; style?: LineStyle; /** 线宽倍数 */ w?: number; /** 用第几种颜色（相对图案主色偏移） */ c?: number };
type Rand = () => number;

const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 28): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
  });
const rot = (pts: Pt[], deg: number): Pt[] => {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return pts.map(([x, y]) => [x * c - y * s, x * s + y * c]);
};
const DEG = Math.PI / 180;

function moon(r: Rand): Stroke[] {
  // 月牙：外弧 + 内弧，开口朝右上
  const cx = 0.42 + r() * 0.08;
  const ex = Math.cos(45 * DEG), ey = Math.sin(45 * DEG);
  const ri = Math.hypot(ex - cx, ey);
  const ai = Math.atan2(ey, ex - cx);
  const pts = [...arc(0, 0, 1, 1, 45 * DEG, 315 * DEG, 40), ...arc(cx, 0, ri, ri, -ai, -(2 * Math.PI - ai), 30)];
  return [{ pts: rot(pts, -35 + r() * 20) }];
}

function sparkle(r: Rand): Stroke[] {
  // 四角星 ✦：四个尖，尖之间向内凹
  const tips: Pt[] = [[0, -1], [0.62, 0], [0, 1], [-0.62, 0]].map(([x, y]) => [x! * (0.9 + r() * 0.15), y! * (0.95 + r() * 0.1)] as Pt);
  const pts: Pt[] = [];
  for (let k = 0; k < 4; k++) {
    const a = tips[k]!, b = tips[(k + 1) % 4]!;
    const c: Pt = [(a[0] + b[0]) * 0.12, (a[1] + b[1]) * 0.12];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10, u = 1 - t;
      pts.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
    }
  }
  return [{ pts: rot(pts, (r() - 0.5) * 16) }];
}

function star(r: Rand): Stroke[] {
  const pts: Pt[] = [];
  const o = (r() - 0.5) * 0.3;
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI / 2 + o + (i * Math.PI) / 5;
    const rr = i % 2 ? 0.45 : 1;
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  return [{ pts }];
}

/** 多芒星：8 或 12 道细长星芒，长短交替（像星光、闪耀） */
function starburst(r: Rand): Stroke[] {
  const n = r() < 0.5 ? 8 : 12;
  const o = r() * Math.PI;
  const pts: Pt[] = [];
  for (let i = 0; i <= n * 2; i++) {
    const a = o + (i * Math.PI) / n;
    const rr = i % 2 ? 0.16 + r() * 0.04 : (i / 2) % 2 ? 0.62 + r() * 0.1 : 1;
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  return [{ pts }];
}

function heart(r: Rand): Stroke[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = (i / 48) * Math.PI * 2;
    pts.push([(16 * Math.sin(t) ** 3) / 17, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17]);
  }
  return [{ pts: rot(pts, (r() - 0.5) * 24) }];
}

function sun(r: Rand): Stroke[] {
  // 半开的圆 + 放射短线（参考图：只在上半圈有光芒）
  const out: Stroke[] = [{ pts: arc(0, 0.15, 0.5, 0.5, 170 * DEG, 395 * DEG, 30), w: 1.1 }];
  const n = 6 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const a = (200 + (i * 170) / (n - 1)) * DEG + (r() - 0.5) * 0.1;
    const r0 = 0.72, r1 = 0.95 + r() * 0.15;
    out.push({ pts: [[Math.cos(a) * r0, 0.15 + Math.sin(a) * r0], [Math.cos(a) * r1, 0.15 + Math.sin(a) * r1]], w: 1.1 });
  }
  return out;
}

function leaf(r: Rand): Stroke[] {
  const b = 0.42 + r() * 0.12;
  const right: Pt[] = [], left: Pt[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16, y = -1 + 2 * t, x = Math.sin(Math.PI * t) * b;
    right.push([x, y]);
    left.push([-x, y]);
  }
  const deg = (r() - 0.5) * 80 + 30;
  return [
    { pts: rot([...right, ...left.reverse()], deg) },
    { pts: rot([[0, -0.75], [0.02, 0.6], [0, 1.15]], deg), w: 0.8 },
    { pts: rot([[0.01, -0.1], [b * 0.7, -0.45]], deg), w: 0.7 },
    { pts: rot([[0.01, 0.3], [-b * 0.7, -0.05]], deg), w: 0.7 },
  ];
}

function flower(r: Rand): Stroke[] {
  const petals = 5 + Math.floor(r() * 2);
  const out: Stroke[] = [];
  const o = r() * Math.PI;
  for (let i = 0; i < petals; i++) {
    const a = o + (i / petals) * Math.PI * 2;
    const pts = arc(0, 0, 0.42, 0.26, 0, Math.PI * 2, 18).map(([x, y]) => [x + 0.55, y] as Pt);
    out.push({ pts: rot(pts, (a * 180) / Math.PI) });
  }
  out.push({ pts: arc(0, 0, 0.16, 0.16, 0, Math.PI * 2, 14), c: 1 });
  return out;
}

function cloud(r: Rand): Stroke[] {
  // 扇贝边的云：上半圈鼓包，下边较平
  const pts: Pt[] = [];
  const bumps = 4 + Math.floor(r() * 2);
  for (let i = 0; i <= 120; i++) {
    const t = (i / 120) * Math.PI * 2;
    const upper = Math.sin(t) < 0;
    const bump = upper ? 0.2 * Math.abs(Math.sin(t * bumps * 0.5 + 0.3)) : 0.04 * Math.abs(Math.sin(t * 3));
    pts.push([Math.cos(t) * (1 + bump), Math.sin(t) * (upper ? 0.62 : 0.34) * (1 + bump)]);
  }
  return [{ pts, style: r() < 0.6 ? "dash" : "solid" }];
}

function bird(r: Rand): Stroke[] {
  const lift = 0.35 + r() * 0.2;
  return [{ pts: smooth([[-1, 0.15], [-0.5, -lift], [0, 0.12], [0.5, -lift], [1, 0.15]], 3) }];
}

function wave(r: Rand): Stroke[] {
  const out: Stroke[] = [];
  const lines = 2 + Math.floor(r() * 2);
  for (let k = 0; k < lines; k++) {
    const len = 1.2 + r() * 0.8, x0 = -1 + r() * 0.4, y0 = -0.35 + k * 0.38;
    const pts: Pt[] = [];
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      pts.push([x0 + len * t, y0 + Math.sin(t * Math.PI * 3 + k) * 0.08]);
    }
    out.push({ pts, style: k % 2 ? "dash" : "solid", w: k ? 0.8 : 1 });
  }
  return out;
}

function steam(r: Rand): Stroke[] {
  return [-0.4, 0, 0.4].map((x, k) => ({
    pts: Array.from({ length: 21 }, (_, i) => {
      const t = i / 20;
      return [x + Math.sin(t * Math.PI * 2 + k + r()) * 0.12, 0.9 - t * 1.8] as Pt;
    }),
    w: 0.85,
  }));
}

function snowflake(): Stroke[] {
  const out: Stroke[] = [];
  for (let k = 0; k < 3; k++) {
    const a = (k * 60 + 90) * DEG, c = Math.cos(a), s = Math.sin(a);
    out.push({ pts: [[-c, -s], [c, s]] });
    for (const e of [-1, 1]) {
      const ex = c * e * 0.7, ey = s * e * 0.7;
      for (const side of [-1, 1]) {
        const b = a + side * 40 * DEG;
        out.push({ pts: [[ex, ey], [ex + Math.cos(b) * e * 0.28, ey + Math.sin(b) * e * 0.28]], w: 0.7 });
      }
    }
  }
  return out;
}

function raindrop(): Stroke[] {
  // 水滴：上尖下圆
  const pts: Pt[] = [];
  for (let i = 0; i <= 36; i++) {
    const t = (i / 36) * Math.PI * 2;
    pts.push([0.75 * Math.sin(t) * Math.sin(t / 2), -Math.cos(t)]);
  }
  return [{ pts }];
}

function note(r: Rand): Stroke[] {
  const head = arc(-0.3, 0.65, 0.3, 0.2, 0, Math.PI * 2, 18).map(([x, y]) => [x, y] as Pt);
  return [
    { pts: rot(head, -20) },
    { pts: [[-0.02, 0.6], [-0.02, -0.9]] },
    { pts: smooth([[-0.02, -0.9], [0.35, -0.6], [0.5, -0.2 - r() * 0.1]], 2) },
  ];
}

export const MOTIFS: Record<MotifKind, (r: Rand) => Stroke[]> = {
  moon, sparkle, star, starburst, heart, sun, leaf, flower, cloud, bird, wave, steam,
  snowflake: () => snowflake(), raindrop: () => raindrop(), note,
};

/** 照片里的点缀；角度为点缀"朝外"的方向（度） */
export function accentStrokes(kind: AccentKind, r: Rand): Stroke[] {
  if (kind === "ticks") {
    // 招手/动作旁的几道短线，呈扇形
    const n = 3 + Math.floor(r() * 2);
    return Array.from({ length: n }, (_, i) => {
      const a = (-45 + (i * 90) / (n - 1) + (r() - 0.5) * 8) * DEG;
      const r0 = 0.45 + r() * 0.1, r1 = 0.85 + r() * 0.15;
      return { pts: [[Math.cos(a) * r0, Math.sin(a) * r0], [Math.cos(a) * r1, Math.sin(a) * r1]] as Pt[] };
    });
  }
  if (kind === "burst") {
    // 闪光：一圈长短不一的放射线
    const n = 9 + Math.floor(r() * 4);
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.2;
      const r0 = 0.22, r1 = i % 2 ? 0.6 + r() * 0.15 : 0.9 + r() * 0.15;
      return { pts: [[Math.cos(a) * r0, Math.sin(a) * r0], [Math.cos(a) * r1, Math.sin(a) * r1]] as Pt[], w: 0.85 };
    });
  }
  // 速度线：三条平行短线，往"angle"的反方向拖尾
  return [0, 1, 2].map((k) => {
    const y = (k - 1) * 0.32, len = k === 1 ? 1.6 : 1.1 + r() * 0.3;
    return { pts: [[0, y], [len, y + (r() - 0.5) * 0.05]] as Pt[], w: 0.9 };
  });
}
