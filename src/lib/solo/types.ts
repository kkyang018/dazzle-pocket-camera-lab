// 手绘单张：AI 只给"计划"（主题、配色、图案、点缀位置），线条全部由本地代码画。
// 这个文件浏览器和服务端共用，不能依赖 DOM。

/** 本地图案库里的图案 */
export const MOTIF_KINDS = [
  "moon", "sparkle", "star", "heart", "sun", "leaf", "flower", "cloud", "bird", "wave", "steam", "snowflake", "raindrop", "note",
] as const;
export type MotifKind = (typeof MOTIF_KINDS)[number];

/** 照片周围的 8 个锚点 */
export const ANCHORS = ["top-left", "top", "top-right", "right", "bottom-right", "bottom", "bottom-left", "left"] as const;
export type Anchor = (typeof ANCHORS)[number];

export const MOTIF_SIZES = ["s", "m", "l"] as const;
export type MotifSize = (typeof MOTIF_SIZES)[number];

/** 照片内部的点缀：招手小线、闪光、速度线 */
export const ACCENT_KINDS = ["ticks", "burst", "speed"] as const;
export type AccentKind = (typeof ACCENT_KINDS)[number];

export const THEMES = ["night", "garden", "sky", "water", "city", "cafe", "snow", "portrait", "other"] as const;
export type Theme = (typeof THEMES)[number];

export type SoloPlan = {
  theme: Theme;
  /** 纸张底色（会被调亮） */
  background: string;
  /** 2–3 种线条颜色，第一种用于主体描边 */
  colors: string[];
  /** 4–6 个候选图案，排版时按种子挑选摆放 */
  motifs: { kind: MotifKind; anchor: Anchor; size: MotifSize }[];
  /** 照片内的点缀，坐标以照片为 0–1 */
  accents: { kind: AccentKind; x: number; y: number; angle: number }[];
  /** 穿过照片边缘的长线条数 */
  flows: number;
  /** 计划来自 AI 还是本地规则 */
  source: "ai" | "local";
};

/** 主体描边：若干条开放折线，坐标以照片为 0–1 */
export type Outline = {
  paths: [number, number][][];
  /** 人物外框 x,y,w,h（0–1） */
  box: [number, number, number, number];
};

export type SoloData = { plan: SoloPlan; outline: Outline | null };
