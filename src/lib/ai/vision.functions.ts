import { createServerFn } from "@tanstack/react-start";
import { streamText } from "ai";
import { z } from "zod";
import { ACCENT_KINDS, ANCHORS, MOTIF_KINDS, MOTIF_SIZES, THEMES, type SoloPlan } from "@/lib/solo/types";
import { sanitizePlan } from "@/lib/solo/plan";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const isDataUrl = (s: unknown): s is string => typeof s === "string" && s.startsWith("data:image/") && s.length < 2_000_000;
const clamp = (v: number, a: number, b: number) => (Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : (a + b) / 2);
const HEX = /^#[0-9a-fA-F]{6}$/;

function friendly(e: unknown): string {
  const status = (e as { statusCode?: number })?.statusCode;
  if (status === 429) return "AI 有点忙，稍后再试";
  if (status === 402) return "AI 额度用完了";
  if (status === 403) return "AI 暂不可用";
  return "AI 看图失败，先用本地效果";
}

/** 取出文本里第一个完整的 JSON 对象 */
function firstJson(text: string): unknown {
  const start = text.indexOf("{");
  if (start < 0) throw new Error("no json");
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return JSON.parse(text.slice(start, i + 1));
  }
  throw new Error("unterminated json");
}

async function run<S extends z.ZodTypeAny>(schema: S, shape: string, system: string, text: string, images: string[]): Promise<z.infer<S>> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("missing key");
  const { createGateway, VISION_MODEL } = await import("./gateway.server");
  const provider = createGateway(key);
  const result = streamText({
    model: provider(VISION_MODEL),
    system: `${system}\nReply with ONE JSON object only, no markdown, shaped like: ${shape}`,
    maxRetries: 1,
    messages: [{ role: "user", content: [{ type: "text", text }, ...images.map((u) => ({ type: "image" as const, image: new URL(u) }))] }],
  });
  const out = await result.text;
  return schema.parse(firstJson(out));
}

// ── 模板一：手绘单张 —— AI 只看图做决定，线条由本地代码画 ─────────────────
const soloSchema = z.object({
  theme: z.enum(THEMES).catch("other"),
  background: z.string(),
  colors: z.array(z.string()).min(1),
  motifs: z.array(z.object({ kind: z.enum(MOTIF_KINDS), anchor: z.enum(ANCHORS), size: z.enum(MOTIF_SIZES).catch("s") })),
  accents: z.array(z.object({ kind: z.enum(ACCENT_KINDS), x: z.number(), y: z.number(), angle: z.number() })).catch([]),
  flows: z.number().catch(3),
});

const SOLO_SYSTEM = `You art-direct a minimal "hand-drawn journal" card: the photo sits centered on plain light paper, and soft crayon doodles are drawn around and slightly over it.
You do NOT draw. You only choose, as JSON:
- theme: what the photo is about (night, garden, sky, water, city, cafe, snow, portrait, other).
- background: a very light paper color that harmonizes with the photo (cream for most photos, a pale tint like light lime for lush green photos). It will be lightened further.
- colors: 2-3 crayon colors picked from or harmonizing with the photo; soft but clearly visible on the paper; never black, grey or pure white. The FIRST color outlines the person, so make it the most visible. A light accent color (e.g. cream on a green paper) is allowed as the 2nd/3rd.
- motifs: 4-6 small outline doodles that fit the photo's actual content, each with an anchor around the photo and a size. Available kinds: ${MOTIF_KINDS.join(", ")}.
  Examples: night/indoor dim -> moon + 2-3 sparkle + heart; plants/fruit/sunny garden -> sun + 3 leaf; sky/clouds/bridge -> one big cloud (size l) + 2 bird + wave; water -> wave + bird; coffee -> steam + heart; snow -> snowflake. Do NOT default to sun and leaves. Use size "l" only for a single cloud.
  Anchors: ${ANCHORS.join(", ")}. Spread them; put sky things (moon, sun, cloud, bird) on top anchors and water/wave on bottom.
- accents: 0-2 small marks INSIDE the photo next to a meaningful detail, with x,y normalized to the photo (0..1) and angle in degrees pointing away from the detail:
  "ticks" next to a waving hand or a gesture, "burst" on a phone screen / light / flash / shiny object, "speed" behind a moving vehicle (angle = direction the lines trail). Never on a face. Empty list if nothing fits.
- flows: 2-4 long loose lines that cross the photo border (just a count).`;

export const soloPlan = createServerFn({ method: "POST" })
  .inputValidator((d: { image: string; person: [number, number, number, number] | null }) => {
    if (!isDataUrl(d?.image)) throw new Error("bad image");
    const box = Array.isArray(d.person) && d.person.length === 4 ? (d.person.map((v) => clamp(Number(v), 0, 1)) as [number, number, number, number]) : null;
    return { image: d.image, person: box };
  })
  .handler(async ({ data }): Promise<Result<SoloPlan>> => {
    try {
      const hint = data.person
        ? `A person was detected inside the photo at box x,y,w,h = ${data.person.map((v) => v.toFixed(2)).join(",")} (normalized). Their outline will be drawn automatically.`
        : "No person was detected.";
      const out = await run(
        soloSchema,
        `{"theme":"night","background":"#f3ede3","colors":["#d98a8a","#e0a944"],"motifs":[{"kind":"moon","anchor":"top-left","size":"m"}],"accents":[{"kind":"burst","x":0.6,"y":0.3,"angle":-40}],"flows":3}`,
        SOLO_SYSTEM,
        `Plan the doodles for this photo. ${hint}`,
        [data.image],
      );
      const plan = sanitizePlan({
        theme: out.theme,
        background: HEX.test(out.background) ? out.background : "#F5EFE4",
        colors: out.colors.filter((c) => HEX.test(c)),
        motifs: out.motifs,
        accents: out.accents,
        flows: out.flows,
        source: "ai",
      });
      if (!plan.motifs.length) return { ok: false, error: "AI 没给出图案" };
      return { ok: true, data: plan };
    } catch (e) {
      console.error("soloPlan", e);
      return { ok: false, error: friendly(e) };
    }
  });
