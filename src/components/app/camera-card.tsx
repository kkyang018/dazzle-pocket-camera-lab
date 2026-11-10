import { Pin } from "lucide-react";
import { AiBadge, ProMark } from "@/components/app/marks";
import { useLongPress } from "@/hooks/use-long-press";
import type { Camera } from "@/lib/cameras";
import { cn } from "@/lib/utils";

export function CameraCard({
  camera,
  selected,
  recommended,
  pinned,
  onSelect,
  onTogglePin,
}: {
  camera: Camera;
  selected: boolean;
  recommended: boolean;
  pinned: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
}) {
  const press = useLongPress({ onLongPress: onTogglePin });

  return (
    <div className="relative w-[92px] shrink-0 snap-start">
      <button
        type="button"
        {...press}
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`${camera.name}${camera.pro ? "，Pro" : ""}${recommended ? "，AI推荐" : ""}${pinned ? "，已置顶" : ""}`}
        className={cn(
          "touch-hold flex w-full flex-col items-center rounded-2xl border px-1.5 pt-6 pb-2.5 transition-all active:scale-95",
          selected
            ? "border-primary bg-surface-raised shadow-glow-amber"
            : "border-hairline bg-surface",
        )}
      >
        <img
          src={camera.icon}
          alt=""
          width={64}
          height={64}
          draggable={false}
          loading="lazy"
          className={cn(
            "pointer-events-none size-16 object-contain drop-shadow-[0_6px_10px_rgb(0_0_0/0.55)] transition-transform",
            selected && "-translate-y-0.5 scale-105",
          )}
        />
        <span className="mt-1.5 flex max-w-full items-center gap-0.5 text-[12px] leading-tight">
          {pinned && <Pin className="size-2.5 shrink-0 fill-current text-primary" strokeWidth={2} />}
          <span className="truncate">{camera.name}</span>
        </span>
      </button>
      {recommended && <AiBadge className="pointer-events-none absolute top-1.5 left-1.5" />}
      {camera.pro && <ProMark className="absolute top-1.5 right-1.5" />}
    </div>
  );
}
