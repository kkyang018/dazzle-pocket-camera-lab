// AI 返回给模板的数据结构（浏览器和服务端共用）
export const STICKER_FAMILIES = ["dot", "star", "heart", "spiral", "spark", "flower", "firework"] as const;
export type StickerFamily = (typeof STICKER_FAMILIES)[number];

/** 手绘单张的一条线；坐标以照片为 0–1，可伸出照片外 */
export type SoloStroke = { pts: [number, number][]; color: string; style: "solid" | "dash" | "dot"; width: number };

export type PuzzleAI = {
  family: StickerFamily;
  color: string;
  /** 每张照片：主体中心（用于裁切）和要避开的框 x,y,w,h */
  photos: { focus: [number, number]; avoid: [number, number, number, number][] }[];
};
