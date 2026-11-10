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
  frame?: { kind: "square" | "mini" | "wide"; color: string };
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
const p = (o: Partial<Preset>): Preset => ({ ...base, ...o });

export const CAMERAS: Camera[] = [
  // 胶片
  {
    id: "gold200", name: "金秋 200", category: "film", icon: filmGold, pro: false,
    likes: { warmth: 0.75, lum: 0.6 },
    preset: p({ exposure: 0.05, contrast: 1.08, saturation: 1.12, temperature: 0.45, fade: 0.08, grain: 0.07, vignette: 0.28, shadows: [0.02, 0.0, -0.03], highlights: [0.05, 0.02, -0.04],
      leak: { x: 1, y: 0.1, color: "255,120,40", strength: 0.22 } }),
  },
  {
    id: "green400", name: "青绿 400", category: "film", icon: filmGreen, pro: false,
    likes: { green: 0.8, warmth: 0.45 },
    preset: p({ contrast: 1.05, saturation: 0.95, temperature: -0.15, tint: 0.35, fade: 0.12, grain: 0.08, vignette: 0.22, shadows: [-0.02, 0.03, 0.02], highlights: [0.02, 0.02, -0.02] }),
  },
  {
    id: "portra160", name: "暖肤 160", category: "film", icon: filmPortra, pro: true,
    likes: { skin: 0.8, sat: 0.4 },
    preset: p({ exposure: 0.12, contrast: 0.92, saturation: 0.9, temperature: 0.25, tint: -0.1, fade: 0.1, grain: 0.05, vignette: 0.15, shadows: [0.01, 0.0, 0.02], highlights: [0.04, 0.02, 0.0] }),
  },
  {
    id: "silverhp", name: "银盐 HP", category: "film", icon: filmBw, pro: true,
    likes: { contrast: 0.8, sat: 0.2 },
    preset: p({ contrast: 1.28, mono: true, fade: 0.05, grain: 0.13, vignette: 0.35, shadows: [0.0, 0.0, 0.01], highlights: [0.02, 0.01, 0.0] }),
  },
  {
    id: "snap", name: "随手拍", category: "film", icon: filmDisposable, pro: false,
    likes: { lum: 0.32, sat: 0.5 },
    preset: p({ exposure: 0.25, contrast: 1.2, saturation: 1.2, temperature: 0.1, tint: 0.08, grain: 0.11, vignette: 0.45, shadows: [0.0, 0.02, 0.03], highlights: [0.04, 0.03, 0.0], dateStamp: true }),
  },
  // CCD
  {
    id: "ccds", name: "CCD-S", category: "ccd", icon: ccdSilver, pro: false,
    likes: { warmth: 0.3, lum: 0.6 },
    preset: p({ exposure: 0.1, contrast: 1.1, saturation: 1.05, temperature: -0.35, tint: -0.05, grain: 0.04, vignette: 0.1, shadows: [-0.01, 0.0, 0.04], highlights: [0.02, 0.03, 0.06] }),
  },
  {
    id: "cyber03", name: "Cyber 03", category: "ccd", icon: ccdCyber, pro: false,
    likes: { sat: 0.7, contrast: 0.6 },
    preset: p({ contrast: 1.22, saturation: 1.35, temperature: -0.1, tint: -0.15, grain: 0.03, vignette: 0.12, shadows: [0.02, -0.01, 0.05], highlights: [0.0, 0.02, 0.03] }),
  },
  {
    id: "dvnight", name: "DV 夜光", category: "ccd", icon: ccdDv, pro: true,
    likes: { lum: 0.25 },
    preset: p({ exposure: 0.45, contrast: 1.15, saturation: 0.8, temperature: -0.2, tint: 0.4, fade: 0.06, grain: 0.16, vignette: 0.4, shadows: [-0.02, 0.05, 0.02], highlights: [0.0, 0.04, 0.0] }),
  },
  {
    id: "candy", name: "糖果 Mini", category: "ccd", icon: ccdCandy, pro: false,
    likes: { lum: 0.7, skin: 0.5 },
    preset: p({ exposure: 0.22, contrast: 0.95, saturation: 1.15, temperature: 0.05, tint: -0.2, fade: 0.14, grain: 0.02, vignette: 0.05, shadows: [0.04, 0.01, 0.05], highlights: [0.04, 0.02, 0.04] }),
  },
  {
    id: "date98", name: "Date 98", category: "ccd", icon: ccdDate, pro: true,
    likes: { warmth: 0.6, sat: 0.5 },
    preset: p({ exposure: 0.08, contrast: 1.12, saturation: 1.1, temperature: 0.3, tint: 0.05, fade: 0.05, grain: 0.06, vignette: 0.2, shadows: [0.03, 0.0, -0.02], highlights: [0.03, 0.01, -0.02], dateStamp: true }),
  },
  // 拍立得
  {
    id: "frame70", name: "方框 70", category: "instant", icon: instant70, pro: true,
    likes: { warmth: 0.6, contrast: 0.4 },
    preset: p({ exposure: 0.05, contrast: 0.9, saturation: 0.85, temperature: 0.35, tint: 0.05, fade: 0.22, grain: 0.06, vignette: 0.3, shadows: [0.02, 0.02, -0.02], highlights: [0.05, 0.03, -0.02], frame: { kind: "square", color: "#f2ece0" } }),
  },
  {
    id: "mini", name: "宝丽 Mini", category: "instant", icon: instantMini, pro: false,
    likes: { skin: 0.6, lum: 0.6 },
    preset: p({ exposure: 0.15, contrast: 1.02, saturation: 1.08, temperature: -0.05, tint: -0.05, fade: 0.1, grain: 0.03, vignette: 0.12, shadows: [0.0, 0.01, 0.03], highlights: [0.02, 0.02, 0.02], frame: { kind: "mini", color: "#fbfaf7" } }),
  },
  {
    id: "wide", name: "宽幅 W", category: "instant", icon: instantWide, pro: false,
    likes: { green: 0.5, contrast: 0.5 },
    preset: p({ exposure: 0.05, contrast: 1.08, saturation: 1.05, temperature: 0.1, tint: 0.1, fade: 0.12, grain: 0.04, vignette: 0.18, shadows: [0.0, 0.02, 0.0], highlights: [0.03, 0.03, 0.0], frame: { kind: "wide", color: "#f5f1e8" } }),
  },
  {
    id: "dusk", name: "夕照", category: "instant", icon: instantDusk, pro: true,
    likes: { warmth: 0.75, lum: 0.4 },
    preset: p({ exposure: 0.08, contrast: 1.0, saturation: 1.1, temperature: 0.3, tint: -0.45, fade: 0.16, grain: 0.06, vignette: 0.3, shadows: [0.04, -0.01, 0.04], highlights: [0.06, 0.01, 0.02],
      leak: { x: 0, y: 1, color: "255,70,120", strength: 0.2 }, frame: { kind: "square", color: "#1c1a1a" } }),
  },
  {
    id: "go", name: "Go 迷你", category: "instant", icon: instantGo, pro: false,
    likes: { sat: 0.6, lum: 0.55 },
    preset: p({ exposure: 0.1, contrast: 1.12, saturation: 1.2, temperature: 0.05, grain: 0.04, vignette: 0.2, shadows: [0.0, 0.0, 0.02], highlights: [0.02, 0.02, 0.0], frame: { kind: "square", color: "#ffffff" } }),
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
