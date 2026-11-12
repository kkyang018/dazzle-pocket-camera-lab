import { useApp } from "@/lib/app-state";
import { cn } from "@/lib/utils";

/** 中 / EN 语言切换：两段式小开关 */
export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useApp();
  return (
    <div role="group" aria-label="Language / 语言" className={cn("flex items-center rounded-full border border-hairline bg-surface/70 p-0.5 tracking-[0.08em] normal-case", className)}>
      {(["zh", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] leading-none transition-colors",
            lang === l ? "bg-foreground text-background" : "text-muted-foreground",
          )}
        >
          {l === "zh" ? "中" : "EN"}
        </button>
      ))}
    </div>
  );
}