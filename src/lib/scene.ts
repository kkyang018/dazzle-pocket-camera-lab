// 本地“AI 分析”：主色提取 + 启发式内容识别（不调用外部接口）。
export type SceneStats = {
  lum: number; // 平均亮度 0-1
  warmth: number; // 0 冷 · 1 暖
  green: number; // 绿色像素占比
  blue: number; // 蓝色像素占比
  dark: number; // 暗部占比
  bright: number; // 高光点占比
  yellow: number; // 暖黄像素占比
  skin: number;
};

export type Keyword = { label: string; tags: string[] };

/** 规则：绿色多→植物；暗部多且有光点→夜景/灯光；暖黄主导→咖啡/室内 …… 最多 3 个 */
export function detectKeywords(s: SceneStats): Keyword[] {
  const out: { k: Keyword; score: number }[] = [];
  const add = (score: number, label: string, tags: string[]) => score > 0 && out.push({ k: { label, tags }, score });
  add(s.green > 0.22 ? s.green : 0, "植物", ["leaf", "flower"]);
  add(s.dark > 0.45 && s.bright > 0.015 ? s.dark : 0, "夜景/灯光", ["lamp", "moon", "star"]);
  add(s.yellow > 0.25 && s.warmth > 0.55 ? s.yellow : 0, "咖啡/室内", ["coffee", "heart"]);
  add(s.blue > 0.25 ? s.blue : 0, "天空/水", ["cloud", "wave"]);
  add(s.lum < 0.45 && s.warmth < 0.45 && s.dark <= 0.45 ? 0.3 : 0, "阴天/雨", ["rain", "cloud"]);
  add(s.lum > 0.62 ? s.lum - 0.3 : 0, "日光", ["sun", "sparkle"]);
  add(s.skin > 0.25 ? s.skin : 0, "人像", ["heart", "sparkle"]);
  return out.sort((a, b) => b.score - a.score).slice(0, 3).map((o) => o.k);
}

export const DEFAULT_STICKERS = ["star", "heart", "camera", "sparkle"];

/** 由关键词选 3-5 个贴纸；没有匹配时用模板默认组合 */
export function pickStickers(keywords: Keyword[]): string[] {
  const set: string[] = [];
  for (const k of keywords) for (const t of k.tags) if (!set.includes(t)) set.push(t);
  if (set.length === 0) return [...DEFAULT_STICKERS];
  for (const d of DEFAULT_STICKERS) if (set.length < 3 && !set.includes(d)) set.push(d);
  return set.slice(0, 5);
}

const hex = (n: number) => Math.round(n).toString(16).padStart(2, "0");

/** 统计 + 主色（粗量化后取出现最多且彼此不太接近的 3 个颜色） */
export function analyzeScene(src: HTMLCanvasElement) {
  const size = 64;
  const k = size / Math.max(src.width, src.height);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(src.width * k));
  c.height = Math.max(1, Math.round(src.height * k));
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
  let n = 0, lum = 0, rs = 0, bs = 0, green = 0, blue = 0, dark = 0, bright = 0, yellow = 0, skin = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]!, g = d[i + 1]!, b = d[i + 2]!;
    const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    n++; lum += l; rs += r; bs += b;
    if (g > r * 1.05 && g > b * 1.05) green++;
    if (b > r * 1.1 && b > g * 0.95) blue++;
    if (l < 0.25) dark++;
    if (l > 0.85) bright++;
    if (r > b * 1.25 && g > b * 1.05 && mx - mn > 30) yellow++;
    if (r > 90 && r > g && g > b && r - b > 30 && r - g < 90) skin++;
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const e = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    // 饱和色权重更高，避免主色全是灰
    const w = 1 + ((mx - mn) / 255) * 2;
    e.n += w; e.r += r * w; e.g += g * w; e.b += b * w;
    bins.set(key, e);
  }
  const sorted = [...bins.values()].sort((a, b) => b.n - a.n).map((e) => [e.r / e.n, e.g / e.n, e.b / e.n] as const);
  const picked: (readonly [number, number, number])[] = [];
  for (const col of sorted) {
    if (picked.every((p) => Math.abs(p[0] - col[0]) + Math.abs(p[1] - col[1]) + Math.abs(p[2] - col[2]) > 90)) picked.push(col);
    if (picked.length === 3) break;
  }
  const palette = picked.map(([r, g, b]) => `#${hex(r)}${hex(g)}${hex(b)}`);
  const stats: SceneStats = {
    lum: lum / n,
    warmth: Math.min(1, Math.max(0, ((rs - bs) / n / 255) * 2.5 + 0.5)),
    green: green / n, blue: blue / n, dark: dark / n, bright: bright / n, yellow: yellow / n, skin: skin / n,
  };
  return { palette, stats, keywords: detectKeywords(stats) };
}

/** 主色中挑一个足够深、能在浅色纸上读清楚的作为文字色 */
export function inkColor(palette: string[]) {
  const lumOf = (h: string) => {
    const v = parseInt(h.slice(1), 16);
    return (0.299 * (v >> 16) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255;
  };
  return [...palette].sort((a, b) => lumOf(a) - lumOf(b))[0] ?? "#3a2a1a";
}
