import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-state";

export const PRO_HINT = "Pro 功能 · 试用中";

/** Pro 标记：琥珀色圆环角标（类似 ®），点击只显示一行提示，不弹窗。 */
export function ProMark({ className }: { className?: string }) {
  const { showHint } = useApp();
  return (
    <button
      type="button"
      aria-label={PRO_HINT}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        showHint(PRO_HINT);
      }}
      className={cn(
        "inline-grid size-3.5 shrink-0 place-items-center rounded-full border-[1.5px] border-pro font-mono text-[7.5px] font-semibold leading-none text-pro",
        className,
      )}
    >
      P
    </button>
  );
}

/** AI 标记：青绿色四角星，用于 AI 推荐 / AI 生成内容。 */
export function AiMark({ className, label = "AI 推荐" }: { className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={label}
      className={cn("inline-block size-3.5 shrink-0 text-ai", className)}
    >
      <path
        fill="currentColor"
        d="M12 1c.6 5.6 4.4 10 11 11-6.6 1-10.4 5.4-11 11-.6-5.6-4.4-10-11-11 6.6-1 10.4-5.4 11-11Z"
      />
    </svg>
  );
}

/** 在用户相册照片上模拟相机效果时显示。 */
export function ApproxTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-foreground/25 bg-background/60 px-2 py-0.5 font-mono text-[10px] tracking-wide text-foreground/80 backdrop-blur-sm",
        className,
      )}
    >
      近似预览
    </span>
  );
}
