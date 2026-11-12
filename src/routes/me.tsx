import { createFileRoute } from "@tanstack/react-router";
import { Switch } from "@/components/ui/switch";
import { AiMark, ApproxTag, ProMark } from "@/components/app/marks";
import { LangToggle } from "@/components/app/lang-toggle";
import { useApp } from "@/lib/app-state";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/me")({
  head: () => ({
    meta: [
      { title: "我的 · Dazz Lab" },
      { name: "description", content: "Dazz Lab 个人设置：安静模式、标记说明与隐私说明。" },
      { property: "og:title", content: "我的 · Dazz Lab" },
      { property: "og:description", content: "安静模式、标记说明与隐私说明。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MePage,
});

function MePage() {
  const { quietMode, setQuietMode } = useApp();
  const t = useT();

  return (
    <main className="px-5 pt-[max(env(safe-area-inset-top),1.25rem)]">
      <header className="animate-rise">
        <span className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Profile</span>
        <h1 className="mt-6 font-serif text-[32px] leading-none font-bold">{t("我的", "Me")}</h1>
      </header>

      <section className="mt-8">
        <SectionLabel>{t("设置", "Settings")}</SectionLabel>
        <div className="divide-y divide-hairline rounded-2xl border border-hairline bg-surface">
          <div className="flex items-center justify-between gap-4 px-4 py-4">
            <span>
              <span className="block text-sm font-medium">{t("语言", "Language")}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">中文 / English</span>
            </span>
            <LangToggle className="font-mono" />
          </div>
          <label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-4">
            <span>
              <span className="block text-sm font-medium">{t("安静模式", "Quiet mode")}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{t("开启后隐藏非必要动效", "Hides non-essential motion")}</span>
            </span>
            <Switch checked={quietMode} onCheckedChange={setQuietMode} aria-label={t("安静模式", "Quiet mode")} />
          </label>
        </div>
      </section>

      <section className="mt-7">
        <SectionLabel>{t("标记说明", "Marks")}</SectionLabel>
        <ul className="divide-y divide-hairline rounded-2xl border border-hairline bg-surface">
          <MarkRow mark={<ProMark />} title={t("Pro 功能", "Pro feature")} desc={t("全部可试用，点一下角标查看", "All free to try — tap the badge for details")} />
          <MarkRow mark={<AiMark />} title={t("AI 推荐 / AI 生成", "AI pick / AI-made")} desc={t("由 AI 给出的建议或内容", "Suggestions or content from AI")} />
          <MarkRow mark={<ApproxTag />} title={t("近似预览", "Approx. preview")} desc={t("在相册照片上模拟的相机效果", "Camera look simulated on your photo")} />
        </ul>
      </section>

      <section className="mt-7">
        <SectionLabel>{t("隐私", "Privacy")}</SectionLabel>
        <ul className="divide-y divide-hairline rounded-2xl border border-hairline bg-surface">
          <InfoRow title={t("照片处理", "Photo processing")} desc={t("显影、成品模板、人物识别都在这台设备上完成，原图不会上传", "Developing, print templates and person detection all run on this device; originals are never uploaded")} />
          <InfoRow title={t("AI 看图", "AI vision")} desc={t("手绘单张会把一张长边 512px 的缩略图发给 AI，用来挑图案和配色；AI 只返回文字数据", "Hand-drawn sends one 512px thumbnail to AI to pick doodles and colors; AI returns text data only")} />
          <InfoRow title={t("照片地点", "Photo location")} desc={t("读取照片里的 GPS 坐标，只把坐标发给地名服务换成城市名，用在拍立得的地点章上", "Reads GPS from the photo and sends only the coordinates to a place-name service for the Polaroid location stamp")} />
          <InfoRow title={t("保存位置", "Storage")} desc={t("印样台的照片只存在这台设备的浏览器里，清除浏览器数据后会消失", "Prints are stored only in this browser on this device and disappear if you clear browser data")} />
        </ul>
      </section>
      <div className="h-8" />
    </main>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2.5 px-1 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
      {children}
    </h2>
  );
}

function InfoRow({ title, desc }: { title: string; desc: string }) {
  return (
    <li className="px-4 py-3.5">
      <span className="block text-sm">{title}</span>
      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{desc}</span>
    </li>
  );
}

function MarkRow({ mark, title, desc }: { mark: React.ReactNode; title: string; desc: string }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3.5">
      <span className="flex w-16 shrink-0 justify-start">{mark}</span>
      <span>
        <span className="block text-sm">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{desc}</span>
      </span>
    </li>
  );
}
