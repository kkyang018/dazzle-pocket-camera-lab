import { useCallback, useEffect, useRef } from "react";

type Options = {
  onLongPress: () => void;
  /** 手指抬起 / 移开（无论是否触发过长按） */
  onRelease?: () => void;
  delay?: number;
};

/** 长按：按住 delay 毫秒触发；移动超过 10px 视为滑动取消；触发后吞掉随后的 click。 */
export function useLongPress({ onLongPress, onRelease, delay = 450 }: Options) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => clear, [clear]);

  const end = useCallback(() => {
    clear();
    origin.current = null;
    onRelease?.();
  }, [clear, onRelease]);

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      fired.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      clear();
      timer.current = setTimeout(() => {
        fired.current = true;
        onLongPress();
      }, delay);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const o = origin.current;
      if (o && !fired.current && Math.hypot(e.clientX - o.x, e.clientY - o.y) > 10) clear();
    },
    onPointerUp: end,
    onPointerCancel: end,
    onPointerLeave: end,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onClickCapture: (e: React.MouseEvent) => {
      if (fired.current) {
        e.preventDefault();
        e.stopPropagation();
        fired.current = false;
      }
    },
  };
}
