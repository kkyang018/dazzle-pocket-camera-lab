// 手绘计划：AI 失败或还没返回时用的本地规则版，以及对任何计划的清洗（保证颜色可读、数量合理）。
// 不依赖 DOM，服务端也会用 sanitizePlan。
import { ANCHORS, type Anchor, type MotifKind, type SoloPlan, type Theme } from "./types";

type RGB = [number, number, number];
const HEX = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
export const toRgb = (h: string): RGB | null => {
  const m = HEX.exec(h.trim());
  return m ? [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)] : null;
};
export const toHex = ([r, g, b]: RGB) =>
  "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const lum = ([r, g, b]: RGB) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

const CREAM: RGB = [245, 239, 228];

/** RGB(0–255) → HSL（h 0–360，s/l 0–1） */
export function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
export function hslToRgb(h: number, s: number, l: number): RGB {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
const hueDist = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

/** 照片的主色调：hue = 面积最大的色相，alt = 第二种明显的颜色，sat = 平均饱和度，lum = 平均明度 */
export type Tone = { hue: number; sat: number; lum: number; alt?: { hue: number; ratio: number } | null };

const isWarm = (h: number) => h >= 5 && h < 55;

/**
 * 纸张色相：
 * - 照片几乎没颜色 → 用 AI 线条色的色相
 * - 主色是暖色（暖光、木头、夕阳很常见，都选它会让大家的纸都是杏色）→
 *   有第二种明显的颜色就用它；没有就参考 AI 线条色
 * - 其他 → 照片主色
 */
export function paperHue(tone: Tone, aiHue: number | null): number {
  if (tone.sat < 0.06) return aiHue ?? 40;
  if (isWarm(tone.hue)) {
    if (tone.alt) return tone.alt.hue;
    if (aiHue != null && !isWarm(aiHue)) return aiHue;
  }
  return tone.hue;
}

/**
 * 有色彩的纸：色相见 paperHue；照片越鲜艳纸越素，照片越灰纸越有颜色。
 * 浅色纸亮度高，深色纸压暗。
 */
export function tintedPaper(tone: Tone, dark: boolean, aiHue: number | null = null): string {
  const hue = paperHue(tone, aiHue);
  const s = Math.min(0.5, Math.max(0.12, 0.55 - tone.sat * 0.9));
  return toHex(dark ? hslToRgb(hue, s * 0.8, 0.15) : hslToRgb(hue, s, 0.88));
}

/**
 * 柔和但有色彩的线条色：饱和度提到 0.45–0.72，明度收在 0.5–0.68；
 * 不够三种颜色时补一种和第一种相隔约 130° 的搭配色。
 */
export function livelyPalette(colors: string[]): string[] {
  const out = colors.map((c) => {
    const [h, s, l] = rgbToHsl(toRgb(c) ?? [200, 130, 90]);
    return toHex(hslToRgb(h, Math.min(0.72, Math.max(0.45, s * 1.25)), Math.min(0.68, Math.max(0.5, l))));
  });
  if (out.length < 3) {
    const [h] = rgbToHsl(toRgb(out[0] ?? "#D9875E")!);
    out.push(toHex(hslToRgb((h + 130) % 360, 0.55, 0.6)));
  }
  return out.slice(0, 3);
}

/** 在照片上最显眼的颜色：和照片主色相差得远、明度拉得开 */
export function standOut(colors: string[], tone: Tone): string {
  let best = colors[0] ?? "#E8873A", score = -1;
  for (const c of colors) {
    const rgb = toRgb(c);
    if (!rgb) continue;
    const [h, s] = rgbToHsl(rgb);
    const v = (hueDist(h, tone.hue) / 180) * Math.min(1, s * 1.6) * (tone.sat < 0.06 ? 0.3 : 1) + Math.abs(lum(rgb) - tone.lum) * 1.2;
    if (v > score) { score = v; best = c; }
  }
  if (score >= 0.38) return best;
  // 调色板里都不够显眼：取照片主色的对比色，按照片明暗定深浅
  return toHex(hslToRgb((tone.hue + 180) % 360, 0.75, tone.lum > 0.5 ? 0.42 : 0.72));
}

/** 纸张底色：保证足够浅（参考图都是浅底） */
export function paperColor(hex: string): string {
  let c = toRgb(hex) ?? CREAM;
  for (let i = 0; i < 12 && lum(c) < 0.86; i++) c = mix(c, CREAM, 0.25);
  return toHex(c);
}

/** 线条颜色：和底色拉开明度差，避免糊在纸上；同时避开纯黑纯白 */
export function inkColor(hex: string, paper: string): string {
  const p = toRgb(paper) ?? CREAM;
  let c = toRgb(hex) ?? [201, 130, 79];
  if (lum(c) < 0.18) c = mix(c, [200, 120, 100], 0.4);
  for (let i = 0; i < 10 && Math.abs(lum(c) - lum(p)) < 0.16; i++) {
    c = lum(p) > 0.5 ? mix(c, [60, 40, 30], 0.15) : mix(c, [255, 250, 240], 0.15);
  }
  return toHex(c);
}

/** 浅底上的浅色线（比如绿底上的奶白叶子）也允许，但要和底色有一点区别 */
export function sanitizePlan(plan: SoloPlan): SoloPlan {
  const background = paperColor(plan.background);
  const colors = (plan.colors.length ? plan.colors : ["#C9824F"]).slice(0, 3).map((c, i) => {
    const rgb = toRgb(c);
    // 第二、三种颜色允许是浅色点缀，只要和底色不同
    if (i > 0 && rgb && lum(rgb) > 0.85 && Math.abs(lum(rgb) - lum(toRgb(background)!)) > 0.04) return toHex(rgb);
    return inkColor(c, background);
  });
  const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5);
  return {
    ...plan,
    background,
    colors,
    motifs: plan.motifs.slice(0, 6),
    accents: plan.accents.slice(0, 3).map((a) => ({ ...a, x: clamp01(a.x), y: clamp01(a.y), angle: Number.isFinite(a.angle) ? a.angle : 0 })),
    flows: Math.max(1, Math.min(4, Math.round(plan.flows) || 2)),
  };
}

export type LocalStats = { lum: number; warmth: number; green: number; blue: number; dark: number; yellow: number };

const PRESETS: Record<Theme, { bg: string; colors: string[]; motifs: MotifKind[] }> = {
  night: { bg: "#F3EDE3", colors: ["#D98A8A", "#E0A944", "#8A93AE"], motifs: ["moon", "sparkle", "sparkle", "heart", "star"] },
  garden: { bg: "#E6F0B0", colors: ["#EE8530", "#FFF6DC"], motifs: ["sun", "leaf", "leaf", "leaf", "flower"] },
  sky: { bg: "#F6F1E7", colors: ["#5AA6E6", "#F2A07B"], motifs: ["cloud", "bird", "bird", "wave"] },
  water: { bg: "#F2F2EA", colors: ["#4F9BD9", "#E9A27C"], motifs: ["wave", "wave", "bird", "sparkle"] },
  city: { bg: "#F4EFE6", colors: ["#E07B5F", "#5E86C9", "#E2B04A"], motifs: ["sparkle", "star", "note", "heart"] },
  cafe: { bg: "#F6EEE2", colors: ["#C9824F", "#D98A8A"], motifs: ["steam", "heart", "sparkle", "flower"] },
  snow: { bg: "#F1F3F5", colors: ["#7EA6D8", "#D98AA0"], motifs: ["snowflake", "snowflake", "sparkle", "star"] },
  portrait: { bg: "#F5EEE6", colors: ["#E58A8A", "#E3A94B", "#8A9BC4"], motifs: ["heart", "sparkle", "flower", "star"] },
  other: { bg: "#F5EFE4", colors: ["#D9875E", "#7A9CC6"], motifs: ["sparkle", "heart", "flower", "star"] },
};

/** 没有 AI 时：按照片统计猜主题，给出一份能用的计划 */
export function localPlan(s: LocalStats, hasPerson: boolean, avg: RGB | null): SoloPlan {
  const theme: Theme =
    s.dark > 0.45 ? "night"
      : s.green > 0.22 ? "garden"
        : s.blue > 0.25 ? (s.lum > 0.55 ? "sky" : "water")
          : s.yellow > 0.25 && s.warmth > 0.55 ? "cafe"
            : hasPerson ? "portrait" : "other";
  const p = PRESETS[theme];
  const bg = theme === "garden" && avg ? toHex(mix(avg, [236, 245, 170], 0.75)) : p.bg;
  const anchors: Anchor[] = ["top-left", "top-right", "right", "bottom-left", "bottom-right", "left"];
  return sanitizePlan({
    theme,
    background: bg,
    colors: p.colors,
    motifs: p.motifs.map((kind, i) => ({ kind, anchor: anchors[i % anchors.length]!, size: kind === "cloud" ? "l" : i === 0 ? "m" : "s" })),
    accents: [],
    flows: 3,
    source: "local",
  });
}

export { ANCHORS };
