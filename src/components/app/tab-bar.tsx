import { Link, useRouterState } from "@tanstack/react-router";
import { Aperture, CircleUserRound } from "lucide-react";
import { cn } from "@/lib/utils";

export function TabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // 选照片 → 相机陈列 → 暗房 都属于 Lab 标签
  const meActive = pathname.startsWith("/me");
  const tabs = [
    { to: "/", label: "Lab", icon: Aperture, active: !meActive },
    { to: "/me", label: "我的", icon: CircleUserRound, active: meActive },
  ] as const;

  return (
    <nav
      aria-label="主导航"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[390px] border-t border-hairline bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
    >
      <ul className="grid grid-cols-2">
        {tabs.map(({ to, label, icon: Icon, active }) => (
          <li key={to}>
            <Link
              to={to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-16 flex-col items-center justify-center gap-1 transition-colors",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <Icon className="size-[22px]" strokeWidth={1.6} />
              <span className="font-mono text-[10px] tracking-[0.14em] uppercase">{label}</span>
              <span className={cn("size-1 rounded-full transition-colors", active ? "bg-primary" : "bg-transparent")} />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
