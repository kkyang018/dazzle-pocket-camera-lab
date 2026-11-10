import { useApp } from "@/lib/app-state";

/** 一行轻提示，自动消失，不打断操作。 */
export function HintBar() {
  const { hint } = useApp();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-3 z-50 mx-auto flex w-full max-w-[390px] justify-center px-4"
    >
      {hint && (
        <div
          key={hint.id}
          className="animate-hint inline-flex items-center gap-2 rounded-full border border-hairline bg-popover/90 px-3.5 py-1.5 font-mono text-[11px] text-popover-foreground shadow-lg backdrop-blur-md"
        >
          {hint.kind === "pro" && (
            <span className="size-2.5 rounded-full border-[1.5px] border-pro" aria-hidden />
          )}
          {hint.text}
        </div>
      )}
    </div>
  );
}
