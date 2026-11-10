import { Link } from "@tanstack/react-router";
import { Aperture, CircleUserRound } from "lucide-react";

const tabs = [
  { to: "/", label: "Lab", icon: Aperture, exact: true },
  { to: "/me", label: "我的", icon: CircleUserRound, exact: false },
] as const;

export function TabBar() {
  return (
    <nav
      aria-label="主导航"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[390px] border-t border-hairline bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
    >
      <ul className="grid grid-cols-2">
        {tabs.map(({ to, label, icon: Icon, exact }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact }}
              className="group flex h-16 flex-col items-center justify-center gap-1 text-muted-foreground transition-colors data-[status=active]:text-foreground"
            >
              <Icon className="size-[22px]" strokeWidth={1.6} />
              <span className="font-mono text-[10px] tracking-[0.14em] uppercase">{label}</span>
              <span className="size-1 rounded-full bg-transparent transition-colors group-data-[status=active]:bg-primary" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
