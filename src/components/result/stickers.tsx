// 贴纸库：简单 SVG 手绘元素。pro=true 为进阶贴纸包。
import type { ReactNode } from "react";

type Def = { name: string; pro?: boolean; svg: ReactNode };
const S = { stroke: "#2b2118", strokeWidth: 2.2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

export const STICKERS: Record<string, Def> = {
  star: { name: "星星", svg: <path {...S} fill="#F6C945" d="M24 5l5.6 12 13 1.4-9.7 8.8 2.7 12.8L24 33.6 12.4 40l2.7-12.8L5.4 18.4l13-1.4z" /> },
  heart: { name: "爱心", svg: <path {...S} fill="#EF6B73" d="M24 41S7 30 7 18a8.5 8.5 0 0 1 17-2 8.5 8.5 0 0 1 17 2c0 12-17 23-17 23z" /> },
  flower: { name: "小花", svg: <g {...S}>{[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="24" cy="13" rx="6" ry="9" fill="#F4A3C0" transform={`rotate(${a} 24 24)`} />)}<circle cx="24" cy="24" r="5.5" fill="#F6C945" /></g> },
  leaf: { name: "叶子", svg: <g {...S}><path fill="#7DBE6A" d="M9 39C9 18 22 8 40 8c0 20-11 31-31 31z" /><path fill="none" d="M9 39L30 18" /></g> },
  coffee: { name: "咖啡杯", svg: <g {...S}><path fill="#F2E6D3" d="M9 18h24v12a10 10 0 0 1-10 10h-4A10 10 0 0 1 9 30z" /><path fill="none" d="M33 21h3a5 5 0 0 1 0 10h-3" /><path fill="none" d="M16 6c-2 3 2 5 0 8M23 6c-2 3 2 5 0 8" /><rect x="9" y="18" width="24" height="5" fill="#8A5A3B" /></g> },
  rain: { name: "雨滴", svg: <g {...S} fill="#7FB6E0"><path d="M16 8s-7 10-7 15a7 7 0 0 0 14 0c0-5-7-15-7-15z" /><path d="M33 18s-6 8-6 12a6 6 0 0 0 12 0c0-4-6-12-6-12z" /></g> },
  lamp: { name: "路灯", svg: <g {...S}><path fill="none" d="M20 44V14a6 6 0 0 1 6-6h4" /><path fill="#F6C945" d="M26 8h12l-2 7H28z" /><circle cx="32" cy="20" r="3" fill="#FFE9A0" stroke="none" opacity=".8" /><path fill="none" d="M15 44h10" /></g> },
  moon: { name: "月亮", svg: <path {...S} fill="#F6E08A" d="M32 6a17 17 0 1 0 10 27A14 14 0 0 1 32 6z" /> },
  sun: { name: "太阳", svg: <g {...S}><circle cx="24" cy="24" r="8" fill="#F7A93B" />{[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <path key={a} d="M24 6v6" transform={`rotate(${a} 24 24)`} />)}</g> },
  cloud: { name: "云朵", svg: <path {...S} fill="#FFFFFF" d="M14 36a8 8 0 0 1-1-16 11 11 0 0 1 21-3 9 9 0 0 1 1 19z" /> },
  camera: { name: "相机", svg: <g {...S}><rect x="6" y="14" width="36" height="24" rx="4" fill="#E8923A" /><path fill="#E8923A" d="M16 14l3-5h10l3 5" /><circle cx="24" cy="26" r="7" fill="#3a3a3a" /><circle cx="24" cy="26" r="3" fill="#9fd0e6" stroke="none" /></g> },
  sparkle: { name: "闪光", pro: true, svg: <g {...S} fill="#FFF3B0"><path d="M18 6c1 8 4 11 12 12-8 1-11 4-12 12-1-8-4-11-12-12 8-1 11-4 12-12z" /><path d="M36 26c.6 4 2 6 6 6.6-4 .6-5.4 2-6 6-.6-4-2-5.4-6-6 4-.6 5.4-2.6 6-6.6z" /></g> },
  wave: { name: "海浪", pro: true, svg: <path {...S} fill="#6FB7D6" d="M4 30c5-8 10-8 14 0s10 8 14 0 9-8 12 0v12H4z" /> },
  ticket: { name: "票根", pro: true, svg: <g {...S}><path fill="#F3D9A4" d="M5 14h38v7a3 3 0 0 0 0 6v7H5v-7a3 3 0 0 0 0-6z" /><path fill="none" strokeDasharray="2 3" d="M32 14v20" /></g> },
};

export const STICKER_KEYS = Object.keys(STICKERS);

export function Sticker({ id, className }: { id: string; className?: string }) {
  const d = STICKERS[id] ?? STICKERS['star']!;
  return (
    <svg viewBox="0 0 48 48" className={className} aria-label={d.name} role="img">
      {d.svg}
    </svg>
  );
}
