// 成品模板的 Canvas 绘制工具：预览与导出共用同一套绘制，只是尺寸不同。
export type Ctx = CanvasRenderingContext2D;
export type Img = HTMLCanvasElement;

export function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 裁切铺满 */
export function cover(ctx: Ctx, img: Img, x: number, y: number, w: number, h: number, cx = 0.5, cy = 0.5) {
  const r = Math.max(w / img.width, h / img.height);
  const sw = w / r, sh = h / r;
  ctx.drawImage(img, (img.width - sw) * cx, (img.height - sh) * cy, sw, sh, x, y, w, h);
}

/** 按比例放进框里，返回实际矩形 */
export function fit(img: Img, x: number, y: number, w: number, h: number) {
  const r = Math.min(w / img.width, h / img.height);
  const iw = img.width * r, ih = img.height * r;
  return { x: x + (w - iw) / 2, y: y + (h - ih) / 2, w: iw, h: ih };
}

export function withRot(ctx: Ctx, cx: number, cy: number, deg: number, fn: () => void) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.translate(-cx, -cy);
  fn();
  ctx.restore();
}

export function softShadow(ctx: Ctx, u: number, strength = 1) {
  ctx.shadowColor = `rgba(20,14,8,${0.28 * strength})`;
  ctx.shadowBlur = 26 * u;
  ctx.shadowOffsetY = 10 * u;
}
export function noShadow(ctx: Ctx) {
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

/** 颗粒：用小噪点图平铺 */
export function grain(ctx: Ctx, W: number, H: number, amount: number, seed = 3) {
  const n = document.createElement("canvas");
  n.width = n.height = 256;
  const g = n.getContext("2d")!;
  const d = g.createImageData(256, 256);
  const r = rng(seed);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = r() * 255;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  ctx.save();
  ctx.globalAlpha = amount;
  ctx.globalCompositeOperation = "overlay";
  const scale = Math.max(1, W / 1080);
  ctx.scale(scale, scale);
  ctx.fillStyle = ctx.createPattern(n, "repeat")!;
  ctx.fillRect(0, 0, W / scale, H / scale);
  ctx.restore();
}

/** 纸张：底色 + 轻微纤维斑驳 */
export function paper(ctx: Ctx, W: number, H: number, color: string, seed = 5, fiber = 0.05) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  const r = rng(seed);
  ctx.save();
  for (let i = 0; i < 260; i++) {
    ctx.globalAlpha = fiber * r();
    ctx.fillStyle = r() > 0.5 ? "#fff" : "#000";
    const x = r() * W, y = r() * H, s = (W / 1080) * (2 + r() * 40);
    ctx.beginPath();
    ctx.ellipse(x, y, s, s * (0.2 + r()), r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // 边缘微暗
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(40,25,10,0.12)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

/** 手绘星芒（粉笔/蜡笔感：多条略抖的射线） */
export function sparkle(ctx: Ctx, x: number, y: number, r: number, color: string, seed: number, rays = 10) {
  const rand = rng(seed);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  for (let pass = 0; pass < 2; pass++) {
    ctx.globalAlpha = pass ? 0.55 : 0.95;
    ctx.lineWidth = r * (pass ? 0.09 : 0.13);
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 + rand() * 0.25;
      const len = r * (0.65 + rand() * 0.4);
      const inner = r * 0.08;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * inner + rand() * r * 0.04, y + Math.sin(a) * inner);
      const mx = x + Math.cos(a + 0.05) * len * 0.55, my = y + Math.sin(a + 0.05) * len * 0.55;
      ctx.quadraticCurveTo(mx, my, x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** 手绘五角星描边 */
export function star(ctx: Ctx, x: number, y: number, r: number, color: string, seed: number, fill?: string, width = 0.09) {
  const rand = rng(seed);
  const pts: [number, number][] = [];
  const rot = rand() * 0.5 - 0.25;
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + rot + (i * Math.PI) / 5;
    const rr = (i % 2 ? r * 0.45 : r) * (0.9 + rand() * 0.2);
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (width > 0) {
    ctx.strokeStyle = color;
    ctx.lineWidth = r * width;
    ctx.stroke();
    // 第二遍略错位，像手描两次
    ctx.globalAlpha = 0.5;
    ctx.translate(r * 0.04, r * 0.03);
    ctx.stroke();
  }
  ctx.restore();
}

/** 和纸胶带 */
export function tape(ctx: Ctx, cx: number, cy: number, w: number, h: number, deg: number, kind: "gingham" | "kraft" | "clear", u: number) {
  withRot(ctx, cx, cy, deg, () => {
    const x = cx - w / 2, y = cy - h / 2;
    ctx.save();
    ctx.beginPath();
    // 撕口锯齿
    const teeth = 7;
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    for (let i = 0; i <= teeth; i++) ctx.lineTo(x + w + (i % 2 ? 4 * u : 0), y + (h * i) / teeth);
    ctx.lineTo(x, y + h);
    for (let i = teeth; i >= 0; i--) ctx.lineTo(x + (i % 2 ? -4 * u : 0), y + (h * i) / teeth);
    ctx.closePath();
    ctx.clip();
    if (kind === "gingham") {
      ctx.fillStyle = "rgba(236,240,248,0.92)";
      ctx.fillRect(x - 10, y - 10, w + 20, h + 20);
      const s = 14 * u;
      ctx.fillStyle = "rgba(120,145,200,0.35)";
      for (let i = 0; i < w / s + 2; i += 2) ctx.fillRect(x + i * s, y, s, h);
      for (let j = 0; j < h / s + 2; j += 2) ctx.fillRect(x, y + j * s, w, s);
    } else if (kind === "kraft") {
      ctx.fillStyle = "rgba(214,186,140,0.88)";
      ctx.fillRect(x - 10, y - 10, w + 20, h + 20);
    } else {
      ctx.fillStyle = "rgba(255,255,250,0.5)";
      ctx.fillRect(x - 10, y - 10, w + 20, h + 20);
    }
    ctx.restore();
  });
}

/** 渗墨日期印章：多层错位 + 轻微模糊 */
export function inkStamp(ctx: Ctx, text: string, x: number, y: number, size: number, color: string, deg: number, seed: number) {
  const rand = rng(seed);
  withRot(ctx, x, y, deg, () => {
    ctx.save();
    ctx.font = `500 ${size}px "Special Elite", "IBM Plex Mono", monospace`;
    ctx.textBaseline = "alphabetic";
    let cx = x;
    for (const ch of text) {
      const w = ctx.measureText(ch).width + size * 0.06;
      const dy = (rand() - 0.5) * size * 0.06;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = size * 0.12;
      ctx.globalAlpha = 0.55 + rand() * 0.25;
      ctx.fillText(ch, cx, y + dy);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.5 + rand() * 0.3;
      ctx.fillText(ch, cx + size * 0.015, y + dy + size * 0.01);
      cx += w;
    }
    ctx.restore();
  });
}

/** 按宽度换行（中英文都按字符切） */
export function wrap(ctx: Ctx, text: string, maxW: number) {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    const tokens = para.match(/[A-Za-z0-9'’,.!?;:\-]+\s*|\s+|./gu) ?? [];
    for (const t of tokens) {
      if (ctx.measureText(line + t).width > maxW && line) {
        lines.push(line.trimEnd());
        line = t.trimStart();
      } else line += t;
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

export const FONTS = {
  type: '"Special Elite", "Noto Serif SC", serif',
  hand: '"Gochi Hand", "Ma Shan Zheng", cursive',
  script: '"Caveat", "Ma Shan Zheng", cursive',
  mono: '"IBM Plex Mono", monospace',
  serif: '"Noto Serif SC", serif',
};

export async function loadFonts() {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all(
    ['20px "Special Elite"', '20px "Gochi Hand"', '700 20px "Caveat"', '20px "Ma Shan Zheng"', '500 20px "IBM Plex Mono"'].map((f) =>
      document.fonts.load(f, "Aa字").catch(() => undefined),
    ),
  );
}
