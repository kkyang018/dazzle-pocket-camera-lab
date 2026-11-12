import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-state";
import { pick, useT } from "@/lib/i18n";

export const PRO_HINT = "Pro 功能 · 试用中";
export const PRO_HINT_EN = "Pro feature · free trial";
/** Pro 提示文案（按当前语言） */
export const proHint = (lang: "zh" | "en") => pick(lang, PRO_HINT, PRO_HINT_EN);

const PRO_MARK_CLASS =
  "inline-grid size-3.5 shrink-0 place-items-center rounded-full border-[1.5px] border-pro font-mono text-[7.5px] font-semibold leading-none text-pro";

/**
 * Pro 标记：琥珀色圆环角标（类似 ®），点击只显示一行提示，不弹窗。
 * 放在别的按钮里面时传 `inline`：只画角标，不再嵌套 <button>，由外层按钮负责提示。
 */
export function ProMark({ className, inline = false }: { className?: string; inline?: boolean }) {
  const { showHint, lang } = useApp();
  if (inline) {
    return (
      <span aria-hidden className={cn(PRO_MARK_CLASS, className)}>
        P
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-label={proHint(lang)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        showHint(proHint(lang), "pro");
      }}
      className={cn(PRO_MARK_CLASS, className)}
    >
      P
    </button>
  );
}

/** AI 推荐角标：四角星 + 文字，青绿色 */
export function AiBadge({ className }: { className?: string }) {
  const t = useT();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full bg-ai/15 py-0.5 pr-1.5 pl-1 text-[9px] leading-none font-medium text-ai",
        className,
      )}
    >
      <AiMark className="size-2.5" label="" />
      {t("AI推荐", "AI pick")}
    </span>
  );
}

/** AI 标记：青绿色四角星，用于 AI 推荐 / AI 生成内容。label 不传时按语言用"AI 推荐 / AI pick" */
export function AiMark({ className, label }: { className?: string; label?: string }) {
  const t = useT();
  const text = label ?? t("AI 推荐", "AI pick");
  return (
    <svg
      viewBox="0 0 24 24"
      role={text ? "img" : undefined}
      aria-label={text || undefined}
      aria-hidden={text ? undefined : true}
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
  const t = useT();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-foreground/25 bg-background/60 px-2 py-0.5 font-mono text-[10px] tracking-wide text-foreground/80 backdrop-blur-sm",
        className,
      )}
    >
      {t("近似预览", "Approx.")}
    </span>
  );
}
