import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/** 隐私小字：照片在本机处理；只有 AI 看图会上传一张小缩略图（详见「我的 · 隐私」） */
export function LocalProcessingNote({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground", className)}>
      <Lock className="size-3" strokeWidth={1.8} />
      照片在你的设备上处理 · AI 看图只上传一张小缩略图
    </p>
  );
}
