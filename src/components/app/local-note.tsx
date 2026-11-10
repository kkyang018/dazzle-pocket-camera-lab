import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export function LocalProcessingNote({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground", className)}>
      <Lock className="size-3" strokeWidth={1.8} />
      照片只在你的设备上处理，不会上传
    </p>
  );
}
