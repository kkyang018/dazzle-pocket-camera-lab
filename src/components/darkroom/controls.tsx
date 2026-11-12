import { useRef } from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** 曝光拨盘：上下/左右拖动的距离换算成旋转角度 */
export function ExposureDial({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const start = useRef<{ x: number; y: number; v: number } | null>(null);
  const t = useT();
  const angle = value * 60;
  const ticks = Array.from({ length: 41 }, (_, i) => i);
  return (
    <div className="flex flex-col items-center">
      <div
        role="slider"
        aria-label={t("曝光", "Exposure")}
        aria-valuemin={-2}
        aria-valuemax={2}
        aria-valuenow={value}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowRight") onChange(clamp(+(value + 0.1).toFixed(1), -2, 2));
          if (e.key === "ArrowDown" || e.key === "ArrowLeft") onChange(clamp(+(value - 0.1).toFixed(1), -2, 2));
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          start.current = { x: e.clientX, y: e.clientY, v: value };
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          const d = e.clientX - s.x + (s.y - e.clientY);
          onChange(clamp(Math.round((s.v + d / 90) * 10) / 10, -2, 2));
        }}
        onPointerUp={() => (start.current = null)}
        onPointerCancel={() => (start.current = null)}
        className="relative size-[72px] touch-none cursor-grab rounded-full bg-gradient-to-b from-surface-raised to-muted shadow-[inset_0_2px_3px_rgb(255_255_255/0.6),0_6px_14px_-6px_rgb(0_0_0/0.45)] outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <svg viewBox="0 0 100 100" className="absolute inset-0" style={{ transform: `rotate(${angle}deg)` }}>
          {ticks.map((i) => {
            const a = (i / 40) * Math.PI * 2;
            const long = i % 5 === 0;
            const r1 = long ? 38 : 42;
            return (
              <line
                key={i}
                x1={50 + Math.sin(a) * r1}
                y1={50 - Math.cos(a) * r1}
                x2={50 + Math.sin(a) * 46}
                y2={50 - Math.cos(a) * 46}
                stroke="currentColor"
                strokeWidth={long ? 1.6 : 0.8}
                className="text-foreground/50"
              />
            );
          })}
          <circle cx="50" cy="16" r="3" className="fill-primary" />
          <circle cx="50" cy="50" r="22" className="fill-surface stroke-foreground/10" />
        </svg>
        <span className="pointer-events-none absolute -top-1.5 left-1/2 h-2 w-0.5 -translate-x-1/2 rounded bg-foreground" />
      </div>
      <span className="mt-1.5 font-mono text-xs tabular-nums">
        {value > 0 ? "+" : value < 0 ? "−" : "±"}
        {Math.abs(value).toFixed(1)} EV
      </span>
    </div>
  );
}

/** 横向刻度尺：-1…1，拖动指针 */
export function Ruler({
  label,
  left,
  right,
  value,
  onChange,
  gradient,
}: {
  label: string;
  left: string;
  right: string;
  value: number;
  onChange: (v: number) => void;
  gradient: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const set = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    onChange(Math.round(clamp(((clientX - r.left) / r.width) * 2 - 1, -1, 1) * 50) / 50);
  };
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 text-right text-[11px] text-muted-foreground">{left}</span>
      <div
        ref={ref}
        role="slider"
        aria-label={label}
        aria-valuemin={-1}
        aria-valuemax={1}
        aria-valuenow={value}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") onChange(clamp(value + 0.05, -1, 1));
          if (e.key === "ArrowLeft") onChange(clamp(value - 0.05, -1, 1));
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          set(e.clientX);
        }}
        onPointerMove={(e) => e.buttons && set(e.clientX)}
        className="relative h-8 flex-1 touch-none cursor-pointer outline-none"
      >
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full opacity-70" style={{ background: gradient }} />
        <div className="absolute inset-x-0 top-0 flex h-3 justify-between">
          {Array.from({ length: 21 }, (_, i) => (
            <span key={i} className={cn("w-px bg-foreground/35", i % 5 === 0 ? "h-3" : "h-1.5")} />
          ))}
        </div>
        <span
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-foreground bg-surface-raised shadow"
          style={{ left: `${(value + 1) * 50}%` }}
        />
      </div>
      <span className="w-10 text-[11px] text-muted-foreground">{right}</span>
      <span className="w-9 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
        {value > 0 ? "+" : ""}
        {Math.round(value * 100)}
      </span>
    </div>
  );
}
