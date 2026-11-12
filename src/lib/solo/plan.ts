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

/**
 * 线条颜色：和底色拉开明度差，避免糊在纸上。
 * 只调明度、保留色相和饱和度（以前是往棕色里混，所以总带棕黄）。
 */
export function inkColor(hex: string, paper: string): string {
  const p = toRgb(paper) ?? CREAM;
  const c = toRgb(hex) ?? [201, 130, 79];
  const [h, s] = rgbToHsl(c);
  let l = rgbToHsl(c)[2];
  if (l < 0.22) l = 0.3;
  const darkPaper = lum(p) < 0.5;
  for (let i = 0; i < 12 && Math.abs(lum(hslToRgb(h, s, l)) - lum(p)) < 0.16; i++) l += darkPaper ? 0.05 : -0.05;
  return toHex(hslToRgb(h, s, Math.min(0.9, Math.max(0.2, l))));
}

/**
 * 配色情绪：莫兰迪（柔和灰调）、高饱和、复古深色纸、粉彩、取自照片、深色线条。
 * 排序让"换一组"前几次就能看到差别很大的组合。
 */
export const MOODS = ["morandi", "vivid", "retro", "pastel", "photo", "deep"] as const;
export type Mood = (typeof MOODS)[number];
/** 色相搭配：邻近、互补、三角、分裂互补 */
const HARMONIES: number[][] = [[0, 32, -28], [0, 180, 155], [0, 120, 240], [0, 150, 210]];

/** 复古深色纸（参考复古色卡：深青、丝绒绿、咖啡、里昂蓝、茄紫、砖红） */
const RETRO_PAPERS = ["#193D40", "#446242", "#5B3B1E", "#084973", "#3B2A4A", "#6E2A20"];
/** 复古亮色线条：芥末黄、橙、藏红、奶油、豆沙粉、孔雀青、雾蓝、正红、橄榄 */
const RETRO_INKS = ["#FFC20A", "#F3620F", "#D26E36", "#EAE1CB", "#D18E97", "#078D8C", "#BED4DD", "#DA0D1E", "#979E6C", "#E99E26"];

/** 从照片取的颜色里挑：最有颜色的做纸张底色（调浅），其余做线条 */
function photoMood(photoColors: string[], tone: Tone, dark: boolean, seed: number) {
  const cs = photoColors.map((c) => rgbToHsl(toRgb(c) ?? [128, 128, 128])).filter(([, s]) => s > 0.12);
  const pick = cs.length ? cs[(seed - 1) % cs.length]! : ([tone.hue, 0.35, 0.5] as [number, number, number]);
  const paper = toHex(hslToRgb(pick[0], Math.min(0.5, Math.max(0.2, pick[1] * 0.75)), dark ? 0.16 : 0.8));
  const others = cs.filter((c) => c !== pick).map(([h, s]) => hslToRgb(h, Math.max(0.45, s), 0.5));
  while (others.length < 3) others.push(hslToRgb((pick[0] + 150 + others.length * 70) % 360, 0.6, 0.5));
  return { paper, colors: others.slice(0, 3).map(toHex) };
}

/** 复古深色纸：选和照片主色色相差最远的那张深色纸（有对比），配亮色复古线条 */
function retroMood(tone: Tone, seed: number) {
  const ranked = [...RETRO_PAPERS].sort((a, b) =>
    hueDist(rgbToHsl(toRgb(b)!)[0], tone.hue) - hueDist(rgbToHsl(toRgb(a)!)[0], tone.hue));
  const paper = ranked[(seed - 1) % 2]!; // 对比最强的前两张轮换
  const ph = rgbToHsl(toRgb(paper)!)[0];
  const inks = [...RETRO_INKS]
    .filter((c) => lum(toRgb(c)!) > 0.32)
    .sort((a, b) => hueDist(rgbToHsl(toRgb(b)!)[0], ph) - hueDist(rgbToHsl(toRgb(a)!)[0], ph));
  // 色相彼此拉开的 3 种
  const colors: string[] = [];
  for (const c of [...inks.slice(seed % 3), ...inks]) {
    const h = rgbToHsl(toRgb(c)!)[0];
    if (colors.every((x) => hueDist(rgbToHsl(toRgb(x)!)[0], h) > 35)) colors.push(c);
    if (colors.length === 3) break;
  }
  return { paper, colors };
}

/**
 * 按"情绪 + 色相搭配"出一套线条色和纸张色，"换一组"（seed）会换到下一种组合。
 * 起始情绪看照片：照片鲜艳 → 先给莫兰迪；照片灰 → 先给高饱和。
 * @param photoColors 照片里的主要颜色（"取自照片"情绪用）
 */
export function schemePalette(baseHue: number, seed: number, tone: Tone, dark: boolean, photoColors: string[] = []): { mood: Mood; colors: string[]; paper: string } {
  const start = tone.sat > 0.28 ? 0 : 1;
  const mood = MOODS[(start + seed - 1) % MOODS.length]!;
  if (mood === "photo") {
    const m = photoMood(photoColors, tone, dark, seed);
    return { mood, paper: m.paper, colors: m.colors.map((c) => inkColor(c, m.paper)) };
  }
  if (mood === "retro") {
    const m = retroMood(tone, seed);
    return { mood, paper: m.paper, colors: m.colors.map((c) => inkColor(c, m.paper)) };
  }
  const harmony = HARMONIES[Math.floor((seed - 1) / MOODS.length + seed) % HARMONIES.length]!;
  const hue0 = (baseHue + (seed - 1) * 23 + 360) % 360;
  const spec: [number, number] = ({ morandi: [0.24, 0.6], vivid: [0.78, 0.55], pastel: [0.55, 0.72], deep: [0.6, 0.38] } as const)[mood as "morandi" | "vivid" | "pastel" | "deep"] as [number, number];
  const colors = harmony.map((off, i) => {
    const h = (hue0 + off + 360) % 360;
    let s = spec[0] * (i === 2 ? 0.85 : 1), l = spec[1] + (i - 1) * 0.04;
    // 橙黄一带明度低了就像棕色：抬亮、提饱和，让它是橙 / 芥末黄而不是棕
    if (h >= 18 && h <= 48 && mood !== "morandi") { l = Math.max(l, 0.6); s = Math.max(s, 0.6); }
    return toHex(hslToRgb(h, s, l));
  });
  // 纸张：莫兰迪 / 粉彩跟线条同色系，高饱和 / 深色用照片色调（鲜艳的线配安静的纸）
  const pHue = mood === "morandi" || mood === "pastel" ? (hue0 + 180) % 360 : paperHue(tone, hue0);
  const ps = mood === "pastel" ? 0.4 : mood === "morandi" ? 0.14 : Math.min(0.45, Math.max(0.12, 0.55 - tone.sat * 0.9));
  const paper = toHex(dark ? hslToRgb(pHue, ps * 0.8, 0.15) : hslToRgb(pHue, ps, 0.89));
  return { mood, colors: colors.map((c) => inkColor(c, paper)), paper };
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

export type LocalStats = { lum: number; warmth: number; green: number; blue: number; dark: number; yellow: number; bright?: number };

/** 各主题的图案（第一个是最贴合场景、一定会出现的那个） */
const PRESETS: Record<Theme, { bg: string; colors: string[]; motifs: MotifKind[] }> = {
  night: { bg: "#F3EDE3", colors: ["#D98A8A", "#E0A944", "#8A93AE"], motifs: ["moon", "starburst", "star", "sparkle", "heart"] },
  garden: { bg: "#E6F0B0", colors: ["#EE8530", "#FFF6DC"], motifs: ["sun", "leaf", "leaf", "flower", "starburst"] },
  sky: { bg: "#F6F1E7", colors: ["#5AA6E6", "#F2A07B"], motifs: ["cloud", "bird", "bird", "star", "sparkle"] },
  water: { bg: "#F2F2EA", colors: ["#4F9BD9", "#E9A27C"], motifs: ["wave", "bird", "cloud", "starburst", "sparkle"] },
  city: { bg: "#F4EFE6", colors: ["#E07B5F", "#5E86C9", "#E2B04A"], motifs: ["starburst", "cloud", "star", "note", "heart"] },
  cafe: { bg: "#F6EEE2", colors: ["#C9824F", "#D98A8A"], motifs: ["steam", "heart", "starburst", "sparkle", "flower"] },
  snow: { bg: "#F1F3F5", colors: ["#7EA6D8", "#D98AA0"], motifs: ["snowflake", "snowflake", "starburst", "star", "cloud"] },
  portrait: { bg: "#F5EEE6", colors: ["#E58A8A", "#E3A94B", "#8A9BC4"], motifs: ["heart", "starburst", "star", "sparkle", "flower"] },
  other: { bg: "#F5EFE4", colors: ["#D9875E", "#7A9CC6"], motifs: ["starburst", "star", "sparkle", "heart", "cloud"] },
};

/** 没有 AI 时：按照片统计猜主题，给出一份能用的计划 */
export function localPlan(s: LocalStats, hasPerson: boolean, avg: RGB | null): SoloPlan {
  // 雪景：有不少很亮的白、整体偏冷 —— 放在"夜晚"前判断（雪夜也算雪景）
  // 白天雪景：亮白多、偏冷；雪夜 / 蓝调黄昏雪景：整体蓝、暗部多、几乎没有绿色
  const snowy = ((s.bright ?? 0) > 0.08 && s.warmth < 0.6 && s.blue + (s.bright ?? 0) > 0.2)
    || (s.blue > 0.28 && s.dark > 0.3 && s.green < 0.05);
  const theme: Theme =
    snowy ? "snow"
      : s.dark > 0.45 ? "night"
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
