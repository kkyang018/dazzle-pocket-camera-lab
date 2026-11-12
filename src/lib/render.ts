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

/** 拍立得相纸边距（相对照片宽度）；成品模板要知道照片在相纸里的位置 */
export const FRAMES = {
  square: { aspect: 1, side: 0.06, top: 0.06, bottom: 0.24 },
  mini: { aspect: 0.74, side: 0.075, top: 0.09, bottom: 0.28 },
  wide: { aspect: 1.55, side: 0.04, top: 0.045, bottom: 0.14 },
} as const;

/** 把相机预设应用到一张画布上，返回新画布 */
export function renderWithPreset(src: HTMLCanvasElement, p: Preset, seed = 7) {
  let sx = 0, sy = 0, sw = src.width, sh = src.height;
  const frame = p.frame ? FRAMES[p.frame.kind] : null;
  if (frame) {
    // 先按相纸比例取最大的一块，再按缩放倍数取中间更小的一块（双指放大取景）
    let cw = sw, ch = sh;
    if (sw / sh > frame.aspect) cw = sh * frame.aspect;
    else ch = sw / frame.aspect;
    const z = Math.max(1, p.cropZoom ?? 1);
    cw = Math.max(1, Math.round(cw / z)); ch = Math.max(1, Math.round(ch / z));
    sx = Math.round((sw - cw) * (p.cropX ?? 0.5));
    sy = Math.round((sh - ch) * (p.cropY ?? 0.5));
    sw = cw; sh = ch;
  }

  const c = document.createElement("canvas");
  c.width = sw;
  c.height = sh;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
  const img = ctx.getImageData(0, 0, sw, sh);
  const d = img.data;

  const ev = 2 ** p.exposure;
  const st = p.saturation, fade = p.fade;
  // 色温/色调：像白平衡一样按比例调（暗部不会被染脏），再留一点点整体色偏
  const wbR = 1 + p.temperature * 0.14, wbB = 1 - p.temperature * 0.14, wbG = 1 + p.tint * 0.07;
  const tR = p.temperature * 0.03, tB = -p.temperature * 0.03, tG = p.tint * 0.02;
  const [sR, sG, sB] = p.shadows, [hR, hG, hB] = p.highlights;
  const cx = sw / 2, cy = sh / 2, inv = 1 / (cx * cx + cy * cy), vig = p.vignette;
  const lift = fade * 0.35, keep = 1 - fade * 0.5;
  const curve = toneCurve(p.contrast);
  const bands = p.hsl?.map((b) => ({ hue: b.hue, width: b.width ?? 45, sat: b.sat ?? 1, lum: b.lum ?? 0, shift: ((b.shift ?? 0) * Math.PI) / 180 }));
  // 局部对比：先取一张很糊的底图，像素和它的差就是"细节"，按比例放大
  const clarity = p.clarity ?? 0;
  const blur = clarity > 0 ? blurredData(src, sx, sy, sw, sh, 0.02) : null;
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
      let r = (d[i]! / 255) * ev * wbR + tR;
      let g = (d[i + 1]! / 255) * ev * wbG + tG;
      let b = (d[i + 2]! / 255) * ev * wbB + tB;
      if (blur) {
        const l0 = 0.299 * r + 0.587 * g + 0.114 * b;
        const mid = 4 * Math.min(1, Math.max(0, l0)) * (1 - Math.min(1, Math.max(0, l0)));
        const k = clarity * 1.6 * mid;
        r += (r - (blur[i]! / 255) * ev * wbR) * k;
        g += (g - (blur[i + 1]! / 255) * ev * wbG) * k;
        b += (b - (blur[i + 2]! / 255) * ev * wbB) * k;
      }
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
      // 胶片式 S 曲线：高光柔和滚降、暗部不死黑（查表，快）
      r = curve[r <= 0 ? 0 : r >= CURVE_MAX ? CURVE_N - 1 : (r * CURVE_SCALE) | 0]!;
      g = curve[g <= 0 ? 0 : g >= CURVE_MAX ? CURVE_N - 1 : (g * CURVE_SCALE) | 0]!;
      b = curve[b <= 0 ? 0 : b >= CURVE_MAX ? CURVE_N - 1 : (b * CURVE_SCALE) | 0]!;
      let l = 0.299 * r + 0.587 * g + 0.114 * b;
      if (p.mono) {
        r = g = b = l;
      } else {
        r = l + (r - l) * st;
        g = l + (g - l) * st;
        b = l + (b - l) * st;
        if (bands) {
          // 按色相调：越接近这个色相、颜色越浓，影响越大；灰色不受影响
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b), chroma = mx - mn;
          if (chroma > 0.02) {
            let h = mx === r ? ((g - b) / chroma) % 6 : mx === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4;
            h *= 60; if (h < 0) h += 360;
            let sMul = 1, lAdd = 0, rot = 0;
            const cw = Math.min(1, chroma * 4);
            for (const bd of bands) {
              let dh = Math.abs(h - bd.hue); if (dh > 180) dh = 360 - dh;
              if (dh >= bd.width) continue;
              const w = (1 - dh / bd.width) * cw;
              sMul *= 1 + (bd.sat - 1) * w; lAdd += bd.lum * w; rot += bd.shift * w;
            }
            if (rot !== 0) {
              // 绕灰轴旋转色相（Rodrigues），明度不变
              const cr = Math.cos(rot), sr = Math.sin(rot), k1 = (1 - cr) / 3, k2 = sr / Math.SQRT2 / Math.sqrt(1.5);
              const R = r, G = g, B = b;
              r = R * (cr + k1) + G * (k1 - k2) + B * (k1 + k2);
              g = R * (k1 + k2) + G * (cr + k1) + B * (k1 - k2);
              b = R * (k1 - k2) + G * (k1 + k2) + B * (cr + k1);
            }
            l = 0.299 * r + 0.587 * g + 0.114 * b;
            r = l + (r - l) * sMul + lAdd;
            g = l + (g - l) * sMul + lAdd;
            b = l + (b - l) * sMul + lAdd;
            l += lAdd;
          }
        }
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
      d[i] = r * 255;
      d[i + 1] = g * 255;
      d[i + 2] = b * 255;
    }
  }
  if (p.sharpen && p.sharpen > 0) sharpenData(d, sw, sh, p.sharpen * 0.8);
  ctx.putImageData(img, 0, 0);

  if (p.bloom) drawBloom(ctx, c, sw, sh, p.bloom);

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

  // 颗粒：按"长边 1080 的预览"定颗粒大小，所以预览和 4000px 导出看起来一样粗细
  if (p.grain > 0) drawGrain(ctx, sw, sh, p.grain, p.grainSize ?? 1, seed);

  if (p.dateStamp) drawDateStamp(ctx, sw, sh);

  if (!frame || !p.frame) return c;
  const out = document.createElement("canvas");
  const side = Math.round(sw * frame.side);
  const top = Math.round(sw * frame.top);
  out.width = sw + side * 2;
  out.height = sh + top + Math.round(sw * frame.bottom);
  const octx = out.getContext("2d")!;
  // 拍立得相纸自带圆角
  const rad = Math.max(2, Math.round(out.width * 0.008));
  octx.beginPath();
  octx.roundRect(0, 0, out.width, out.height, rad);
  octx.clip();
  octx.fillStyle = p.frame.color;
  octx.fillRect(0, 0, out.width, out.height);
  // 黑边相纸：压纹和表面高光要弱很多，不然黑底会被提成灰色
  const fv = parseInt(p.frame.color.replace("#", ""), 16);
  const darkPaper = ((fv >> 16) * 0.299 + ((fv >> 8) & 255) * 0.587 + (fv & 255) * 0.114) / 255 < 0.3;
  const hiA = darkPaper ? 0.05 : 0.14, sheenA = darkPaper ? 0.05 : 0.15;
  const pr = mulberry32(seed + 7);
  const bot = out.height - sh - top;
  if (bot > side * 1.5) {
    const g = octx.createLinearGradient(0, out.height - bot * 0.35, 0, out.height);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.06)");
    octx.fillStyle = g;
    octx.fillRect(0, out.height - bot * 0.35, out.width, bot * 0.35);
  }
  // 压纹：参考实拍相纸的细密斜向菱格压纹
  const unit = Math.max(1, out.width / 400);
  const gap = 2.6 * unit, D = out.width + out.height;
  octx.lineWidth = 0.55 * unit;
  for (const dir of [1, -1]) {
    for (let k = -out.height; k < D; k += gap) {
      const x0 = dir > 0 ? k : out.width - k;
      const jit = (pr() - 0.5) * 0.4 * unit;
      octx.strokeStyle = "rgba(70,75,80,0.075)";
      octx.beginPath(); octx.moveTo(x0 + jit, 0); octx.lineTo(x0 + jit + dir * out.height, out.height); octx.stroke();
      octx.strokeStyle = `rgba(255,255,255,${hiA})`;
      octx.beginPath(); octx.moveTo(x0 + jit + 0.8 * unit, 0); octx.lineTo(x0 + jit + 0.8 * unit + dir * out.height, out.height); octx.stroke();
    }
  }
  const yel = octx.createRadialGradient(out.width / 2, out.height / 2, Math.min(out.width, out.height) * 0.35, out.width / 2, out.height / 2, Math.max(out.width, out.height) * 0.75);
  yel.addColorStop(0, "rgba(150,140,120,0)"); yel.addColorStop(1, "rgba(150,140,120,0.07)");
  octx.fillStyle = yel; octx.fillRect(0, 0, out.width, out.height);
  const sheen = octx.createLinearGradient(0, 0, out.width, out.height);
  sheen.addColorStop(0, `rgba(255,255,255,${sheenA})`); sheen.addColorStop(0.5, "rgba(255,255,255,0)"); sheen.addColorStop(1, "rgba(0,0,0,0.04)");
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

// ── 色调曲线：S 曲线 + 高光滚降，预先算成查找表 ─────────────────────
const CURVE_N = 2048, CURVE_MAX = 1.6, CURVE_SCALE = (CURVE_N - 1) / CURVE_MAX;
const curveCache = new Map<number, Float32Array>();
/** contrast = 中间调斜率（1 = 原样）；超过 0.82 的高光柔和压回 1 以内 */
export function toneCurve(contrast: number) {
  const key = Math.round(contrast * 1000);
  let t = curveCache.get(key);
  if (t) return t;
  t = new Float32Array(CURVE_N);
  const k = contrast;
  for (let i = 0; i < CURVE_N; i++) {
    let x = i / CURVE_SCALE;
    // 高光滚降：0.82 以上逐渐逼近 1，而不是一刀切
    if (x > 0.82) x = 0.82 + 0.18 * (1 - Math.exp(-(x - 0.82) / 0.18));
    // 对称 S 曲线，中点斜率 = k，两端不截断
    t[i] = x < 0.5 ? 0.5 * Math.pow(2 * x, k) : 1 - 0.5 * Math.pow(2 * (1 - x), k);
  }
  curveCache.set(key, t);
  return t;
}

/** 很糊的底图（长边缩到 radius 对应的尺寸再放大），给局部对比用 */
function blurredData(src: HTMLCanvasElement, sx: number, sy: number, sw: number, sh: number, radius: number) {
  const L = Math.max(8, Math.round(1 / radius));
  const k = L / Math.max(sw, sh);
  const small = document.createElement("canvas");
  small.width = Math.max(2, Math.round(sw * k)); small.height = Math.max(2, Math.round(sh * k));
  const s = small.getContext("2d")!;
  s.imageSmoothingQuality = "high";
  s.drawImage(src, sx, sy, sw, sh, 0, 0, small.width, small.height);
  const big = document.createElement("canvas");
  big.width = sw; big.height = sh;
  const b = big.getContext("2d", { willReadFrequently: true })!;
  b.imageSmoothingQuality = "high";
  b.drawImage(small, 0, 0, sw, sh);
  return b.getImageData(0, 0, sw, sh).data;
}

/** 高光发光：取亮部 → 缩小模糊 → 带颜色"滤色"叠回去 */
function drawBloom(ctx: CanvasRenderingContext2D, c: HTMLCanvasElement, sw: number, sh: number, o: NonNullable<Preset["bloom"]>) {
  const L = Math.max(24, Math.round(4 / o.radius));
  const k = L / Math.max(sw, sh);
  const small = document.createElement("canvas");
  small.width = Math.max(2, Math.round(sw * k)); small.height = Math.max(2, Math.round(sh * k));
  const s = small.getContext("2d", { willReadFrequently: true })!;
  s.imageSmoothingQuality = "high";
  s.drawImage(c, 0, 0, small.width, small.height);
  const im = s.getImageData(0, 0, small.width, small.height), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = (0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!) / 255;
    const v = Math.max(0, (l - o.threshold) / (1 - o.threshold));
    const w = v * v * (3 - 2 * v);
    d[i] = d[i]! * w * o.tint[0]; d[i + 1] = d[i + 1]! * w * o.tint[1]; d[i + 2] = d[i + 2]! * w * o.tint[2];
  }
  s.putImageData(im, 0, 0);
  // 再糊一遍：缩一半再放回
  const half = document.createElement("canvas");
  half.width = Math.max(2, Math.round(small.width / 2)); half.height = Math.max(2, Math.round(small.height / 2));
  const h = half.getContext("2d")!;
  h.imageSmoothingQuality = "high";
  h.drawImage(small, 0, 0, half.width, half.height);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.imageSmoothingQuality = "high";
  ctx.globalAlpha = Math.min(1, o.amount);
  ctx.drawImage(small, 0, 0, sw, sh);
  ctx.globalAlpha = Math.min(1, o.amount * 0.8);
  ctx.drawImage(half, 0, 0, sw, sh);
  ctx.restore();
}

/** 胶片颗粒：以 1080 长边为基准生成噪点再等比放大，柔和成团；叠加模式，亮部暗部自然变弱 */
function drawGrain(ctx: CanvasRenderingContext2D, sw: number, sh: number, amount: number, size: number, seed: number) {
  const scale = (Math.max(sw, sh) / PREVIEW_EDGE) * Math.max(0.5, size) * 1.15;
  const gw = Math.max(2, Math.ceil(sw / scale)), gh = Math.max(2, Math.ceil(sh / scale));
  const n = document.createElement("canvas");
  n.width = gw; n.height = gh;
  const g = n.getContext("2d")!;
  const im = g.createImageData(gw, gh), d = im.data;
  const r = mulberry32(seed * 7 + 3);
  for (let i = 0; i < d.length; i += 4) {
    // 主要是明度颗粒，带一点点彩色
    const v = (r() + r() - 1) * 0.5;
    d[i] = 128 + (v + (r() - 0.5) * 0.12) * 255;
    d[i + 1] = 128 + v * 255;
    d[i + 2] = 128 + (v + (r() - 0.5) * 0.12) * 255;
    d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = Math.min(1, amount * 2.4);
  ctx.imageSmoothingQuality = "low";
  ctx.drawImage(n, 0, 0, sw, sh);
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
