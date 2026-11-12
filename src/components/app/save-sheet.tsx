import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Download, X } from "lucide-react";
import { useApp } from "@/lib/app-state";
import { useT } from "@/lib/i18n";

/**
 * 手机上的保存面板：直接下载在 iPhone / App 内置浏览器里会打开一个文件预览页，离开了 App。
 * 所以手机上先在当前页弹出这个面板：点「保存到相册」调系统分享里的「存储图像」，
 * 也可以长按图片保存。全程不跳页。
 */
let files: File[] | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openSaveSheet(list: File[]) {
  files = list;
  emit();
}
const close = () => {
  files = null;
  emit();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function SaveSheet() {
  const list = useSyncExternalStore(subscribe, () => files, () => null);
  const t = useT();
  const { showHint } = useApp();
  const urls = useMemo(() => list?.map((f) => URL.createObjectURL(f)) ?? [], [list]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  const [busy, setBusy] = useState(false);
  if (!list) return null;

  const canShare = typeof navigator !== "undefined" && !!navigator.canShare?.({ files: list });
  const save = async () => {
    setBusy(true);
    try {
      // 这里是用户刚点的按钮，系统分享一定能弹出来（不会像以前那样等导出太久而失效）
      await navigator.share({ files: list });
      close();
      showHint(t("已保存", "Saved"));
    } catch (e) {
      if ((e as Error).name !== "AbortError") showHint(t("没能打开系统保存，长按图片保存", "Couldn't open save — press and hold the image"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] mx-auto flex max-w-[390px] flex-col justify-end bg-background/70 backdrop-blur-sm" onClick={close}>
      <div
        role="dialog"
        aria-label={t("保存到相册", "Save to photos")}
        onClick={(e) => e.stopPropagation()}
        className="animate-rise rounded-t-3xl border-t border-hairline bg-surface px-5 pt-4 pb-[max(env(safe-area-inset-bottom),1.25rem)]"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-base font-bold">{t("保存到相册", "Save to photos")}</h2>
          <button type="button" onClick={close} aria-label={t("关闭", "Close")} className="-mr-1 grid size-8 place-items-center rounded-full text-muted-foreground">
            <X className="size-4" />
          </button>
        </div>
        <div className="scrollbar-none -mx-5 mt-3 flex snap-x gap-2 overflow-x-auto px-5">
          {urls.map((u, i) => (
            <img
              key={u}
              src={u}
              alt={list[i]!.name}
              className={list.length > 1 ? "max-h-[46dvh] w-[72%] shrink-0 snap-center rounded-lg object-contain" : "mx-auto max-h-[52dvh] max-w-full rounded-lg object-contain"}
            />
          ))}
        </div>
        <p className="mt-2.5 text-center font-mono text-[10px] text-muted-foreground">
          {canShare
            ? t("点下面的按钮，选「存储图像」· 也可以长按图片保存", "Tap below, then “Save Image” · or press and hold the image")
            : t("长按图片，选「存储图像」或「保存到相册」", "Press and hold the image, then “Save Image”")}
        </p>
        {canShare && (
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-[15px] font-medium text-primary-foreground shadow-glow-amber disabled:opacity-70"
          >
            <Download className="size-4" />
            {list.length > 1 ? t(`保存 ${list.length} 张到相册`, `Save ${list.length} to photos`) : t("保存到相册", "Save to photos")}
          </button>
        )}
      </div>
    </div>
  );
}
