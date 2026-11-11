import { useRef, useState, type ReactNode } from "react";
import { ProMark } from "@/components/app/marks";
import { cn } from "@/lib/utils";
import { STICKERS, STICKER_KEYS, Sticker } from "./stickers";

export type Placed = { uid: number; id: string; x: number; y: number; r: number; s: number };

/** 根据贴纸 id 生成围绕/叠放的初始位置 */
export function layoutStickers(ids: string[], mode: "around" | "over"): Placed[] {
  const around = [[12, 10], [86, 14], [10, 78], [88, 70], [50, 92]];
  const over = [[18, 18], [78, 22], [22, 76], [76, 72], [50, 48]];
  const pts = mode === "around" ? around : over;
  return ids.map((id, i) => ({ uid: i + 1, id, x: pts[i]![0]!, y: pts[i]![1]!, r: ((i * 37) % 30) - 15, s: 1 - (i % 2) * 0.15 }));
}

/** 可拖动、点击替换的贴纸层 */
export function StickerBoard({ items, onChange, children, className }: {
  items: Placed[];
  onChange: (p: Placed[]) => void;
  children: ReactNode;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ uid: number; sx: number; sy: number; moved: boolean } | null>(null);
  const [sel, setSel] = useState<number | null>(null);

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    const r = box.current?.getBoundingClientRect();
    if (!d || !r) return;
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 5) d.moved = true;
    if (!d.moved) return;
    const x = Math.min(96, Math.max(4, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.min(96, Math.max(4, ((e.clientY - r.top) / r.height) * 100));
    onChange(items.map((it) => (it.uid === d.uid ? { ...it, x, y } : it)));
  };

  return (
    <div>
      <div ref={box} className={cn("relative touch-none select-none", className)} onPointerDown={(e) => e.target === e.currentTarget && setSel(null)}>
        {children}
        {items.map((it) => (
          <button
            key={it.uid}
            type="button"
            aria-label={`贴纸 ${STICKERS[it.id]?.name ?? ""}`}
            className={cn("absolute size-12 -translate-x-1/2 -translate-y-1/2 cursor-grab drop-shadow-[0_2px_2px_rgb(0_0_0/0.3)]", sel === it.uid && "rounded-lg outline-2 outline-dashed outline-ai")}
            style={{ left: `${it.x}%`, top: `${it.y}%`, transform: `translate(-50%,-50%) rotate(${it.r}deg) scale(${it.s})` }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { uid: it.uid, sx: e.clientX, sy: e.clientY, moved: false };
            }}
            onPointerMove={move}
            onPointerUp={() => {
              if (drag.current && !drag.current.moved) setSel((s) => (s === it.uid ? null : it.uid));
              drag.current = null;
            }}
          >
            <Sticker id={it.id} className="size-full" />
          </button>
        ))}
      </div>
      <div className={cn("mt-3 overflow-hidden transition-[max-height] duration-200", sel ? "max-h-24" : "max-h-0")}>
        <p className="mb-1 font-mono text-[10px] text-muted-foreground">替换贴纸</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {STICKER_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              aria-label={`换成${STICKERS[k]!.name}`}
              onClick={() => sel && onChange(items.map((it) => (it.uid === sel ? { ...it, id: k } : it)))}
              className="relative grid size-11 shrink-0 place-items-center rounded-lg bg-muted"
            >
              <Sticker id={k} className="size-8" />
              {STICKERS[k]!.pro && <ProMark className="absolute -top-0.5 -right-0.5" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
