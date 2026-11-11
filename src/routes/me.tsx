import { createFileRoute, Link } from "@tanstack/react-router";
import { Switch } from "@/components/ui/switch";
import { AiMark, ApproxTag, ProMark } from "@/components/app/marks";
import { LocalProcessingNote } from "@/components/app/local-note";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/me")({
  head: () => ({
    meta: [
      { title: "我的 · Dazz Lab" },
      { name: "description", content: "Dazz Lab 个人设置：安静模式与标记说明。" },
      { property: "og:title", content: "我的 · Dazz Lab" },
      { property: "og:description", content: "安静模式与标记说明。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MePage,
});

function MePage() {
  const { quietMode, setQuietMode } = useApp();

  return (
    <main className="px-5 pt-[max(env(safe-area-inset-top),1.25rem)]">
      <header className="animate-rise">
        <span className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Profile</span>
        <h1 className="mt-6 font-serif text-[32px] leading-none font-bold">我的</h1>
        <Link to="/grid-lab" className="mt-3 inline-block font-mono text-[11px] text-primary">四宫格波点调试 →</Link>
      </header>

      <section className="mt-8">
        <SectionLabel>设置</SectionLabel>
        <div className="rounded-2xl border border-hairline bg-surface">
          <label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-4">
            <span>
              <span className="block text-sm font-medium">安静模式</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">开启后隐藏非必要动效</span>
            </span>
            <Switch checked={quietMode} onCheckedChange={setQuietMode} aria-label="安静模式" />
          </label>
        </div>
      </section>

      <section className="mt-7">
        <SectionLabel>标记说明</SectionLabel>
        <ul className="divide-y divide-hairline rounded-2xl border border-hairline bg-surface">
          <MarkRow mark={<ProMark />} title="Pro 功能" desc="全部可试用，点一下角标查看" />
          <MarkRow mark={<AiMark />} title="AI 推荐 / AI 生成" desc="由 AI 给出的建议或内容" />
          <MarkRow mark={<ApproxTag />} title="近似预览" desc="在相册照片上模拟的相机效果" />
        </ul>
      </section>

      <LocalProcessingNote className="py-8" />
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
