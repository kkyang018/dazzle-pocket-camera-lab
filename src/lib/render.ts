// 浏览器本地渲染：预览用长边 1080 的缩小图，导出时用原图重新渲染（长边 ≤ 4000）。
import type { PhotoStats, Preset } from "./cameras";

export const PREVIEW_EDGE = 1080;
export const EXPORT_EDGE = 4000;

export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

/** 按原始方向缩放到长边 maxEdge（drawImage 会应用 EXIF 方向） */
export function scaleToCanvas(img: HTMLImageElement, maxEdge: number) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const s = Math.min(1, maxEdge / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * s));
  c.height = Math.max(1, Math.round(h * s));
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 取一张很小的缩略图，统计亮度、饱和度、冷暖、肤色、绿色、反差 */
export function analyze(src: HTMLCanvasElement): PhotoStats {
  const size = 48;
  const s = size / Math.max(src.width, src.height);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(src.width * s));
  c.height = Math.max(1, Math.round(src.height * s));
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let n = 0, lum = 0, lum2 = 0, sat = 0, rs = 0, bs = 0, skin = 0, green = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]! / 255, g = d[i + 1]! / 255, b = d[i + 2]! / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    lum += l; lum2 += l * l; sat += mx === 0 ? 0 : (mx - mn) / mx; rs += r; bs += b;
    if (r > 0.35 && r > g && g > b && r - b > 0.12 && r - g < 0.35 && mx - mn > 0.08) skin++;
    if (g > r * 1.05 && g > b * 1.05) green++;
    n++;
  }
  lum /= n;
  const sd = Math.sqrt(Math.max(0, lum2 / n - lum * lum));
  return {
    lum,
    sat: sat / n,
    warmth: clamp01(((rs - bs) / n) * 2.5 + 0.5),
    skin: clamp01((skin / n) * 3),
    green: clamp01((green / n) * 3),
    contrast: clamp01(sd * 3.2),
  };
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FRAMES = {
  square: { aspect: 1, side: 0.06, top: 0.06, bottom: 0.24 },
  mini: { aspect: 0.74, side: 0.075, top: 0.09, bottom: 0.28 },
  wide: { aspect: 1.55, side: 0.04, top: 0.045, bottom: 0.14 },
} as const;

/** 把相机预设应用到一张画布上，返回新画布 */
export function renderWithPreset(src: HTMLCanvasElement, p: Preset, seed = 7) {
  let sx = 0, sy = 0, sw = src.width, sh = src.height;
  const frame = p.frame ? FRAMES[p.frame.kind] : null;
  if (frame) {
    if (sw / sh > frame.aspect) {
      const nw = Math.round(sh * frame.aspect);
      sx = Math.round((sw - nw) * (p.cropX ?? 0.5));
      sw = nw;
    } else {
      const nh = Math.round(sw / frame.aspect);
      sy = Math.round((sh - nh) * (p.cropY ?? 0.5));
      sh = nh;
    }
  }

  const c = document.createElement("canvas");
  c.width = sw;
  c.height = sh;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
  const img = ctx.getImageData(0, 0, sw, sh);
  const d = img.data;

  const ev = 2 ** p.exposure;
  const ct = p.contrast, st = p.saturation, fade = p.fade;
  const tR = p.temperature * 0.12, tB = -p.temperature * 0.12, tG = p.tint * 0.08;
  const [sR, sG, sB] = p.shadows, [hR, hG, hB] = p.highlights;
  const cx = sw / 2, cy = sh / 2, inv = 1 / (cx * cx + cy * cy), vig = p.vignette;
  const rand = mulberry32(seed);
  const grain = p.grain;
  const lift = fade * 0.35, keep = 1 - fade * 0.5;
  // 直闪：中心提亮、边缘快速衰减、反差更硬
  const fl = p.flash ?? 0;
  const tone = p.flashTone ?? "neutral";
  const fT = tone === "cool" ? [0.92, 1.0, 1.1] : tone === "warm" ? [1.1, 1.0, 0.86] : [1, 1, 1];
  const fBoost = tone === "soft" ? 0.75 : 0.95;
  const fcy = cy * 0.85;
  const fCt = tone === "soft" ? 1.22 : 1.32;

  for (let y = 0, i = 0; y < sh; y++) {
    const dy = y - cy;
    for (let x = 0; x < sw; x++, i += 4) {
      let r = (d[i]! / 255) * ev + tR;
      let g = (d[i + 1]! / 255) * ev + tG;
      let b = (d[i + 2]! / 255) * ev + tB;
      if (fl > 0) {
        // 硬直闪：亮面陡峭提亮、暗部/背景压实，按原亮度拉开反差
        const fdx = (x - cx) / cx, fdy = (y - fcy) / cy;
        const fall = 1 / (1 + 2.6 * (fdx * fdx * 0.8 + fdy * fdy));
        const L = Math.min(1, Math.max(0, 0.299 * r + 0.587 * g + 0.114 * b));
        const tonal = L * L * (3 - 2 * L); // 越亮受光越多
        const gain = 1 + fl * fBoost * fall * (0.35 + 1.5 * tonal);
        const crush = 1 - fl * (1 - fall) * 0.55 - fl * (1 - tonal) * 0.25;
        const m = gain * crush;
        r = r * m * fT[0]!; g = g * m * fT[1]!; b = b * m * fT[2]!;
        const k2 = 1 + (fCt - 1) * fl * 1.4;
        r = (r - 0.42) * k2 + 0.42; g = (g - 0.42) * k2 + 0.42; b = (b - 0.42) * k2 + 0.42;
      }
      r = (r - 0.5) * ct + 0.5;
      g = (g - 0.5) * ct + 0.5;
      b = (b - 0.5) * ct + 0.5;
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      if (p.mono) {
        r = g = b = l;
      } else {
        r = l + (r - l) * st;
        g = l + (g - l) * st;
        b = l + (b - l) * st;
      }
      const lc = l < 0 ? 0 : l > 1 ? 1 : l;
      const shw = (1 - lc) * (1 - lc), hiw = lc * lc;
      r += sR * shw + hR * hiw;
      g += sG * shw + hG * hiw;
      b += sB * shw + hB * hiw;
      r = lift + r * keep;
      g = lift + g * keep;
      b = lift + b * keep;
      if (vig > 0) {
        const dx = x - cx;
        const dist = (dx * dx + dy * dy) * inv;
        const v = 1 - vig * dist * Math.sqrt(dist);
        r *= v; g *= v; b *= v;
      }
      if (grain > 0) {
        const n = (rand() - 0.5) * grain * (1 - Math.abs(lc - 0.5));
        r += n; g += n; b += n;
      }
      d[i] = r * 255;
      d[i + 1] = g * 255;
      d[i + 2] = b * 255;
    }
  }
  if (p.sharpen && p.sharpen > 0) sharpenData(d, sw, sh, p.sharpen * 0.8);
  ctx.putImageData(img, 0, 0);

  if (p.leak) {
    const { x, y, color, strength } = p.leak;
    const grad = ctx.createRadialGradient(x * sw, y * sh, 0, x * sw, y * sh, Math.max(sw, sh) * 0.75);
    grad.addColorStop(0, `rgba(${color},${strength})`);
    grad.addColorStop(1, `rgba(${color},0)`);
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, sw, sh);
    ctx.globalCompositeOperation = "source-over";
  }

  if (p.dateStamp) drawDateStamp(ctx, sw, sh);

  if (!frame || !p.frame) return c;
  const out = document.createElement("canvas");
  const side = Math.round(sw * frame.side);
  const top = Math.round(sw * frame.top);
  out.width = sw + side * 2;
  out.height = sh + top + Math.round(sw * frame.bottom);
  const octx = out.getContext("2d")!;
  octx.fillStyle = p.frame.color;
  octx.fillRect(0, 0, out.width, out.height);
  // 相纸质感：纸纹、药水囊压痕、影像凹陷阴影
  const pr = mulberry32(seed + 7);
  for (let n = 0; n < (out.width * out.height) / 90; n++) {
    octx.fillStyle = pr() > 0.5 ? "rgba(0,0,0,0.035)" : "rgba(255,255,255,0.05)";
    octx.fillRect(pr() * out.width, pr() * out.height, 1.4, 1.4);
  }
  const bot = out.height - sh - top;
  if (bot > side * 1.5) {
    const g = octx.createLinearGradient(0, out.height - bot * 0.35, 0, out.height);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.5, "rgba(0,0,0,0.05)");
    g.addColorStop(1, "rgba(0,0,0,0.12)");
    octx.fillStyle = g;
    octx.fillRect(0, out.height - bot * 0.35, out.width, bot * 0.35);
  }
  // 细小压纹：极淡的随机短纤维，不画明显横线
  for (let n = 0; n < (out.width * out.height) / 400; n++) {
    const x = pr() * out.width, y = pr() * out.height, l = 2 + pr() * 4, a = pr() * Math.PI;
    octx.strokeStyle = pr() > 0.5 ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.04)";
    octx.lineWidth = 0.6;
    octx.beginPath(); octx.moveTo(x, y); octx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); octx.stroke();
  }
  const sheen = octx.createLinearGradient(0, 0, out.width, out.height);
  sheen.addColorStop(0, "rgba(255,255,255,0.18)"); sheen.addColorStop(0.5, "rgba(255,255,255,0)"); sheen.addColorStop(1, "rgba(120,100,70,0.08)");
  octx.fillStyle = sheen; octx.fillRect(0, 0, out.width, out.height);
  octx.drawImage(c, side, top);
  octx.strokeStyle = "rgba(0,0,0,0.28)";
  octx.lineWidth = Math.max(1, sw / 400);
  octx.strokeRect(side, top, sw, sh);
  const sg = octx.createLinearGradient(0, top, 0, top + sh * 0.06);
  sg.addColorStop(0, "rgba(0,0,0,0.25)");
  sg.addColorStop(1, "rgba(0,0,0,0)");
  octx.fillStyle = sg;
  octx.fillRect(side, top, sw, sh * 0.06);
  return out;
}

function drawDateStamp(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const now = new Date();
  const text = `'98 ${String(now.getMonth() + 1).padStart(2, " ")} ${String(now.getDate()).padStart(2, " ")}`;
  const size = Math.round(Math.min(w, h) * 0.05);
  ctx.save();
  ctx.font = `600 ${size}px "IBM Plex Mono", ui-monospace, monospace`;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255,150,40,0.95)";
  ctx.shadowColor = "rgba(255,90,20,0.9)";
  ctx.shadowBlur = size * 0.5;
  ctx.fillText(text, w - size * 1.1, h - size * 1.1);
  ctx.restore();
}

/** 3×3 锐化（unsharp 近似） */
function sharpenData(d: Uint8ClampedArray, w: number, h: number, a: number) {
  const src = new Uint8ClampedArray(d);
  const c = 1 + 4 * a;
  const row = w * 4;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1, i = y * row + 4; x < w - 1; x++, i += 4) {
      for (let k = 0; k < 3; k++) {
        const j = i + k;
        d[j] = src[j]! * c - a * (src[j - 4]! + src[j + 4]! + src[j - row]! + src[j + row]!);
      }
    }
  }
}
