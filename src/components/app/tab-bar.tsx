import { Link, useRouterState } from "@tanstack/react-router";
import { Aperture, CircleUserRound, Images } from "lucide-react";
import { cn } from "@/lib/utils";

/** 底部三个标签：Lab（选照片 → 选相机 → 暗房）、印样台（相册 → 成品）、我的 */
export function TabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const section = pathname.startsWith("/me") ? "me" : pathname.startsWith("/album") || pathname.startsWith("/result") ? "album" : "lab";
  const tabs = [
    { to: "/", label: "Lab", name: "Lab", icon: Aperture, active: section === "lab" },
    { to: "/album", label: "印样台", name: "印样台", icon: Images, active: section === "album" },
    { to: "/me", label: "我的", name: "我的", icon: CircleUserRound, active: section === "me" },
  ] as const;

  return (
    <nav
      aria-label="主导航"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[390px] border-t border-hairline bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
    >
      <ul className="grid grid-cols-3">
        {tabs.map(({ to, label, name, icon: Icon, active }) => (
          <li key={to}>
            <Link
              to={to}
              aria-label={name}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-16 flex-col items-center justify-center gap-1 transition-colors",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <Icon className="size-[22px]" strokeWidth={1.6} aria-hidden />
              <span className="font-mono text-[10px] tracking-[0.14em] uppercase">{label}</span>
              <span className={cn("size-1 rounded-full transition-colors", active ? "bg-primary" : "bg-transparent")} />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
