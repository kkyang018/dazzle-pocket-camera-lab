import filmGold from "@/assets/cameras/film-gold.webp";
import filmGreen from "@/assets/cameras/film-green.webp";
import filmPortra from "@/assets/cameras/film-portra.webp";
import filmBw from "@/assets/cameras/film-bw.webp";
import filmDisposable from "@/assets/cameras/film-disposable.webp";
import ccdSilver from "@/assets/cameras/ccd-silver.webp";
import ccdCyber from "@/assets/cameras/ccd-cyber.webp";
import ccdDv from "@/assets/cameras/ccd-dv.webp";
import ccdCandy from "@/assets/cameras/ccd-candy.webp";
import ccdDate from "@/assets/cameras/ccd-date.webp";
import instant70 from "@/assets/cameras/instant-70.webp";
import instantMini from "@/assets/cameras/instant-mini.webp";
import instantWide from "@/assets/cameras/instant-wide.webp";
import instantDusk from "@/assets/cameras/instant-dusk.webp";
import instantGo from "@/assets/cameras/instant-go.webp";

export type CameraCategory = "film" | "ccd" | "instant";

export const CATEGORIES: { id: CameraCategory; label: string }[] = [
  { id: "film", label: "胶片" },
  { id: "ccd", label: "CCD" },
  { id: "instant", label: "拍立得" },
];

type RGB = [number, number, number];
export type FlashTone = "cool" | "warm" | "neutral" | "soft";
export type FlashMode = "off" | "auto" | "on";

/** 自动档：画面偏暗时才打闪 */
export function flashStrength(mode: FlashMode, lum: number) {
  if (mode === "on") return 1;
  if (mode === "off") return 0;
  return lum < 0.42 ? 1 : 0;
}

/** 相机效果预设：色偏 / 对比度 / 饱和度 / 颗粒 / 暗角等组合 */
export type Preset = {
  exposure: number; // EV
  contrast: number; // 1 = 原样
  saturation: number; // 1 = 原样
  temperature: number; // -1 冷 … 1 暖
  tint: number; // -1 品红 … 1 绿
  fade: number; // 0…1 褪色（抬黑位）
  grain: number; // 0…0.3
  vignette: number; // 0…1
  shadows: RGB; // 阴影染色
  highlights: RGB; // 高光染色
  mono?: boolean;
  leak?: { x: number; y: number; color: string; strength: number };
  dateStamp?: boolean;
  /** 闪光强度 0…1 */
  flash?: number;
  flashTone?: FlashTone;
  frame?: { kind: "square" | "mini" | "wide"; color: string };
  /** 锐化 0…1 */
  sharpen?: number;
  /** 按色相单独调：hue 中心（度）、width 影响范围（度，默认 45）、sat 饱和倍数、lum 明度加减、shift 色相偏移（度） */
  hsl?: { hue: number; width?: number; sat?: number; lum?: number; shift?: number }[];
  /** 高光发光（炫光）：amount 强度、threshold 从多亮开始发光、radius 光晕大小（相对长边）、tint 光的颜色倍数 */
  bloom?: { amount: number; threshold: number; radius: number; tint: RGB };
  /** 局部对比（质感/清晰度）0…1 */
  clarity?: number;
  /** 颗粒大小倍数（默认 1，越大越粗） */
  grainSize?: number;
  /** 画幅裁剪中心 0…1（默认居中） */
  cropX?: number;
  cropY?: number;
  /** 拍立得取景放大倍数（≥1，默认 1） */
  cropZoom?: number;
};

/** 照片画面特征，0…1 */
export type PhotoStats = {
  lum: number;
  sat: number;
  warmth: number;
  skin: number;
  green: number;
  contrast: number;
};

export type Camera = {
  id: string;
  name: string;
  category: CameraCategory;
  icon: string;
  pro: boolean;
  /** 网红滤镜一句话说明 */
  tagline: string;
  /** 闪光灯色调：冷白直闪 / 暖金直闪 / 中性 / 柔光 */
  flashTone: FlashTone;
  /** AI 推荐用：这台相机最适合的画面特征 */
  likes: Partial<PhotoStats>;
  preset: Preset;
};

const base: Preset = {
  exposure: 0,
  contrast: 1,
  saturation: 1,
  temperature: 0,
  tint: 0,
  fade: 0,
  grain: 0,
  vignette: 0,
  shadows: [0, 0, 0],
  highlights: [0, 0, 0],
};
/** 加强分离色调与饱和，让胶片/CCD 风格更鲜明 */
const p = (o: Partial<Preset>): Preset => {
  const m = { ...base, ...o };
  const k = (c: RGB): RGB => [c[0] * 2, c[1] * 2, c[2] * 2];
  return { ...m, shadows: k(m.shadows), highlights: k(m.highlights), contrast: 1 + (m.contrast - 1) * 1.4, saturation: m.mono ? 1 : 1 + (m.saturation - 1) * 1.4, vignette: Math.min(0.8, m.vignette * 1.2) };
};

export const CAMERAS: Camera[] = [
  // 胶片 —— 参考网上最火的胶卷色调
  {
    id: "gold200", name: "Gold 200", tagline: "柯达暖金 · 奶油黄", category: "film", icon: filmGold, pro: false, flashTone: "warm",
    likes: { warmth: 0.75, lum: 0.6 },
    preset: p({ exposure: 0.08, contrast: 1.06, saturation: 1.15, temperature: 0.55, tint: 0.04, fade: 0.1, grain: 0.08, vignette: 0.25, shadows: [0.03, 0.01, -0.04], highlights: [0.07, 0.04, -0.05],
      leak: { x: 1, y: 0.05, color: "255,130,40", strength: 0.2 } }),
  },
  {
    // 参考：雪林骑马、江边围巾两组 —— 整体棕琥珀、蓝绿退成橄榄、哑光抬黑、粗颗粒
    id: "brown400", name: "Brown 400", tagline: "复古棕调 · 电影质感", category: "film", icon: filmGreen, pro: false, flashTone: "warm",
    likes: { warmth: 0.6, sat: 0.4 },
    preset: p({ exposure: -0.05, contrast: 0.97, saturation: 0.84, temperature: 0.62, tint: 0.07, fade: 0.2, grain: 0.12, grainSize: 1.3, vignette: 0.24,
      shadows: [0.035, 0.018, -0.018], highlights: [0.045, 0.025, -0.04],
      hsl: [{ hue: 205, width: 60, sat: 0.3, shift: -10 }, { hue: 115, width: 55, sat: 0.55, shift: -45 }, { hue: 30, width: 35, sat: 1.1, lum: -0.03 }] }),
  },
  {
    id: "portra160", name: "Portra 160", tagline: "奶油肤色 · 柔和低反差", category: "film", icon: filmPortra, pro: true, flashTone: "warm",
    likes: { skin: 0.8, sat: 0.4 },
    preset: p({ exposure: 0.15, contrast: 0.9, saturation: 0.88, temperature: 0.3, tint: -0.08, fade: 0.12, grain: 0.05, vignette: 0.14, shadows: [0.02, 0.0, 0.02], highlights: [0.06, 0.03, 0.0] }),
  },
  {
    id: "hp5", name: "HP5 黑白", tagline: "街头黑白 · 粗颗粒", category: "film", icon: filmBw, pro: true, flashTone: "neutral",
    likes: { contrast: 0.8, sat: 0.2 },
    preset: p({ contrast: 1.32, mono: true, fade: 0.06, grain: 0.15, vignette: 0.38, highlights: [0.02, 0.01, 0.0] }),
  },
  {
    // 参考：海边单车、长椅草地两组 —— 阳光下的高反差胶片：黑位深、颜色浓但自然、天空偏青
    id: "cpm35", name: "CPM35", tagline: "高反差胶片 · 暖金日期戳", category: "film", icon: filmDisposable, pro: false, flashTone: "warm",
    likes: { lum: 0.55, sat: 0.55 },
    preset: p({ exposure: 0.06, contrast: 1.18, saturation: 1.1, temperature: 0.18, tint: 0.04, fade: 0.03, grain: 0.07, vignette: 0.12,
      shadows: [-0.005, 0.01, 0.015], highlights: [0.025, 0.02, 0.0],
      hsl: [{ hue: 210, width: 45, sat: 1.12, shift: -8 }, { hue: 100, width: 50, sat: 0.95, shift: -8 }], dateStamp: true }),
  },
  // CCD —— 千禧数码卡片机
  {
    id: "ixus95", name: "IXUS 95", tagline: "冷白皮 · 清透直闪", category: "ccd", icon: ccdSilver, pro: false, flashTone: "cool",
    likes: { skin: 0.6, lum: 0.55 },
    preset: p({ exposure: 0.2, contrast: 1.12, saturation: 0.92, temperature: -0.45, tint: -0.08, fade: 0.04, grain: 0.03, vignette: 0.1, shadows: [-0.02, 0.0, 0.05], highlights: [0.03, 0.04, 0.08] }),
  },
  {
    // 参考：铁道口、便利店两组 —— 暗部打开、天空冷青、灯光和高光偏暖、局部对比清晰
    id: "cybert", name: "Cyber T", tagline: "质感通透 · 冷暖分离", category: "ccd", icon: ccdCyber, pro: false, flashTone: "cool",
    likes: { contrast: 0.7, lum: 0.45 },
    preset: p({ exposure: 0.1, contrast: 1.04, saturation: 0.98, temperature: 0.05, tint: 0, fade: 0.08, grain: 0.03, vignette: 0.1, clarity: 0.4,
      shadows: [-0.02, 0.005, 0.025], highlights: [0.035, 0.02, -0.015],
      hsl: [{ hue: 30, width: 35, sat: 1.15 }, { hue: 210, width: 50, sat: 0.95, shift: -12 }, { hue: 110, width: 45, sat: 0.8 }] }),
  },
  {
    // 参考：海湾沙滩、仰拍大树两组 —— 高光发出暖金色光晕、颜色浓、青蓝通透，像油画
    id: "glowdv", name: "Glow DV", tagline: "炫光油画 · 暖金发光", category: "ccd", icon: ccdDv, pro: true, flashTone: "warm",
    likes: { lum: 0.6, green: 0.5 },
    preset: p({ exposure: 0.1, contrast: 1.04, saturation: 1.12, temperature: 0.28, tint: 0.02, fade: 0.05, grain: 0.03, vignette: 0.12,
      shadows: [0.0, 0.01, 0.02], highlights: [0.04, 0.025, -0.01],
      hsl: [{ hue: 50, width: 40, sat: 1.2 }, { hue: 190, width: 45, sat: 1.12, shift: -6 }, { hue: 100, width: 40, sat: 1.1, shift: -10 }],
      bloom: { amount: 0.75, threshold: 0.5, radius: 0.035, tint: [1.0, 0.85, 0.6] } }),
  },
  {
    id: "pinkccd", name: "粉调 CCD", tagline: "元气粉 · 少女感", category: "ccd", icon: ccdCandy, pro: false, flashTone: "cool",
    likes: { lum: 0.7, skin: 0.5 },
    preset: p({ exposure: 0.25, contrast: 0.96, saturation: 1.1, temperature: -0.05, tint: -0.3, fade: 0.14, grain: 0.02, vignette: 0.06, shadows: [0.05, 0.0, 0.05], highlights: [0.05, 0.02, 0.05] }),
  },
  {
    id: "date98", name: "Date 98", tagline: "橙色日期 · 胶卷暖调", category: "ccd", icon: ccdDate, pro: true, flashTone: "warm",
    likes: { warmth: 0.6, sat: 0.5 },
    preset: p({ exposure: 0.08, contrast: 1.12, saturation: 1.1, temperature: 0.35, tint: 0.05, fade: 0.06, grain: 0.06, vignette: 0.2, shadows: [0.03, 0.0, -0.02], highlights: [0.04, 0.02, -0.02], dateStamp: true }),
  },
  // 拍立得
  {
    id: "sx70", name: "SX-70", tagline: "折叠宝丽来 · 褪色暖黄", category: "instant", icon: instant70, pro: true, flashTone: "soft",
    likes: { warmth: 0.6, contrast: 0.4 },
    preset: p({ exposure: 0.05, contrast: 0.88, saturation: 0.8, temperature: 0.4, tint: 0.05, fade: 0.25, grain: 0.06, vignette: 0.3, shadows: [0.02, 0.03, -0.02], highlights: [0.06, 0.04, -0.03], frame: { kind: "square", color: "#f3f1ec" } }),
  },
  {
    id: "instaxmini", name: "Instax Mini", tagline: "日系白边 · 清透微冷", category: "instant", icon: instantMini, pro: false, flashTone: "soft",
    likes: { skin: 0.6, lum: 0.6 },
    preset: p({ exposure: 0.18, contrast: 1.0, saturation: 1.05, temperature: -0.12, tint: -0.04, fade: 0.1, grain: 0.03, vignette: 0.1, shadows: [0.0, 0.01, 0.04], highlights: [0.02, 0.03, 0.04], frame: { kind: "mini", color: "#f7f6f2" } }),
  },
  {
    // 参考：茶卡盐湖两组 —— 明亮、空气感、低饱和粉彩，橙色仍然跳，颗粒明显
    id: "wide300", name: "Wide 300", tagline: "宽幅相纸 · 明媚低饱和", category: "instant", icon: instantWide, pro: false, flashTone: "soft",
    likes: { lum: 0.65, sat: 0.35 },
    preset: p({ exposure: 0.28, contrast: 0.9, saturation: 0.8, temperature: 0.1, tint: -0.03, fade: 0.16, grain: 0.09, grainSize: 1.2, vignette: 0.05,
      shadows: [-0.01, 0.01, 0.025], highlights: [0.03, 0.02, 0.0],
      hsl: [{ hue: 20, width: 30, sat: 1.25 }, { hue: 200, width: 50, sat: 0.85, lum: 0.02 }], frame: { kind: "wide", color: "#f6f5f1" } }),
  },
  {
    id: "dusk", name: "Dusk 70", tagline: "落日漏光 · 黑边相纸", category: "instant", icon: instantDusk, pro: true, flashTone: "warm",
    likes: { warmth: 0.75, lum: 0.4 },
    preset: p({ exposure: 0.08, contrast: 1.0, saturation: 1.1, temperature: 0.3, tint: -0.45, fade: 0.16, grain: 0.06, vignette: 0.3, shadows: [0.05, -0.01, 0.05], highlights: [0.07, 0.01, 0.02],
      leak: { x: 0, y: 1, color: "255,70,120", strength: 0.24 }, frame: { kind: "square", color: "#1c1a1a" } }),
  },
  {
    id: "rainbow", name: "Rainbow Go", tagline: "彩虹经典 · 浓郁复古", category: "instant", icon: instantGo, pro: false, flashTone: "soft",
    likes: { sat: 0.6, lum: 0.55 },
    preset: p({ exposure: 0.1, contrast: 1.12, saturation: 1.25, temperature: 0.12, tint: 0.02, fade: 0.08, grain: 0.04, vignette: 0.22, shadows: [0.0, 0.0, 0.03], highlights: [0.04, 0.02, 0.0], frame: { kind: "square", color: "#f7f6f3" } }),
  },
];

export function getCamera(id: string | null | undefined) {
  return CAMERAS.find((c) => c.id === id) ?? null;
}

/** 0…1：照片特征离相机偏好越近分数越高 */
export function scoreCamera(likes: Partial<PhotoStats>, stats: PhotoStats) {
  const keys = Object.keys(likes) as (keyof PhotoStats)[];
  if (keys.length === 0) return 0;
  const diff = keys.reduce((s, k) => s + Math.abs((likes[k] ?? 0) - stats[k]), 0) / keys.length;
  return 1 - diff;
}

/** 每类取 2-3 台 AI 推荐：第 3 名和第 1 名足够接近时才放进来 */
export function recommend(cameras: Camera[], scores: Record<string, number>): string[] {
  const sorted = [...cameras].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
  if (sorted.length <= 2) return sorted.map((c) => c.id);
  const top = scores[sorted[0]!.id] ?? 0;
  const third = scores[sorted[2]!.id] ?? 0;
  return sorted.slice(0, third >= top - 0.06 ? 3 : 2).map((c) => c.id);
}

/** 排序：置顶（最近置顶的在前）＞ AI 推荐（按推荐顺序）＞ 其余（默认顺序） */
export function orderCameras(cameras: Camera[], recommended: string[], pinned: string[]): Camera[] {
  const byId = new Map(cameras.map((c) => [c.id, c]));
  const pinnedHere = pinned.filter((id) => byId.has(id));
  const rec = recommended.filter((id) => byId.has(id) && !pinnedHere.includes(id));
  const front = [...pinnedHere, ...rec];
  return [...front.map((id) => byId.get(id)!), ...cameras.filter((c) => !front.includes(c.id))];
}
