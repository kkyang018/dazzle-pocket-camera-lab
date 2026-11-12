// 中英文切换：语言放在 AppProvider 里（只在内存，默认中文）。
// 组件里用 t("中文", "English")，两种语言写在一起，改文案时不会漏掉另一种。
import { useCallback } from "react";
import { useApp } from "@/lib/app-state";

export type Lang = "zh" | "en";

/** 在组件外（数据、工具函数）按语言二选一 */
export const pick = (lang: Lang, zh: string, en: string) => (lang === "en" ? en : zh);

export function useT() {
  const { lang } = useApp();
  return useCallback((zh: string, en: string) => pick(lang, zh, en), [lang]);
}
