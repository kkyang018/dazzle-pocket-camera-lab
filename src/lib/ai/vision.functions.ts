import { createServerFn } from "@tanstack/react-start";
import { streamText } from "ai";
import { z } from "zod";
import type { PuzzleAI, SoloStroke, StickerFamily } from "@/lib/templates/ai-types";
import { STICKER_FAMILIES } from "@/lib/templates/ai-types";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const isDataUrl = (s: unknown): s is string => typeof s === "string" && s.startsWith("data:image/") && s.length < 2_000_000;
const clamp = (v: number, a: number, b: number) => (Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : (a + b) / 2);
const HEX = /^#[0-9a-fA-F]{6}$/;

function friendly(e: unknown): string {
  const status = (e as { statusCode?: number })?.statusCode;
  if (status === 429) return "AI 有点忙，稍后再试";
  if (status === 402) return "AI 额度用完了";
  if (status === 403) return "AI 暂不可用";
  return "AI 配线失败，先用本地效果";
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

async function run<T>(schema: z.ZodType<T>, shape: string, system: string, text: string, images: string[]): Promise<T> {
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

// ── 模板一：看图配线 ─────────────────────────────────────────
const soloSchema = z.object({
  strokes: z.array(z.object({
    points: z.array(z.number()),
    color: z.string(),
    style: z.enum(["solid", "dash", "dot"]),
    width: z.number(),
  })),
});

const SOLO_SYSTEM = `You are an illustrator adding sparse hand-drawn doodle lines around and across a small photo printed on cream paper (like a zine page).
Coordinates are normalized to the PHOTO: (0,0) = photo top-left, (1,1) = photo bottom-right. Points may go outside the photo, between -0.35 and 1.35.
Return 8-14 strokes. Each stroke's "points" is a flat list x1,y1,x2,y2,... with 4-24 points, forming a smooth hand-drawn polyline.
Must include:
- 2-3 PARTIAL contour lines loosely following the main subject(s) inside the photo (person, object, building, horizon), offset a little, never a full outline, never covering faces.
- 3-6 small motifs chosen from what the photo is actually about (e.g. moon/stars for night, clouds/birds for sky, waves for water, steam for coffee, motion lines for vehicles, hearts for people, leaves only if plants). Do NOT default to sun and leaves.
- 1-3 lines that start outside and cross the photo edge so the drawing interweaves with the picture.
Colors: 2-3 soft but visible hex colors sampled or derived from the photo (never black, never pure white). Vary style (solid/dash/dot) and width (1 thin, 2 medium, 3 bold; mostly 1-2). Keep it airy and minimal.`;

export const soloLines = createServerFn({ method: "POST" })
  .inputValidator((d: { image: string; variant: number }) => {
    if (!isDataUrl(d?.image)) throw new Error("bad image");
    return { image: d.image, variant: Math.floor(Number(d.variant) || 0) };
  })
  .handler(async ({ data }): Promise<Result<SoloStroke[]>> => {
    try {
      const out = await run(soloSchema, `{"strokes":[{"points":[x1,y1,x2,y2,...],"color":"#rrggbb","style":"solid|dash|dot","width":1}]}`, SOLO_SYSTEM, `Draw doodles for this photo. Variation #${data.variant}: pick a different set of motifs than other variations.`, [data.image]);
      const strokes: SoloStroke[] = out.strokes.slice(0, 18).flatMap((s) => {
        const pts: [number, number][] = [];
        for (let i = 0; i + 1 < s.points.length && pts.length < 40; i += 2) pts.push([clamp(s.points[i]!, -0.4, 1.4), clamp(s.points[i + 1]!, -0.4, 1.4)]);
        if (pts.length < 2) return [];
        return [{ pts, color: HEX.test(s.color) ? s.color : "#C9824F", style: s.style, width: clamp(s.width, 1, 3) }];
      });
      if (!strokes.length) return { ok: false, error: "AI 没画出线条" };
      return { ok: true, data: strokes };
    } catch (e) {
      console.error("soloLines", e);
      return { ok: false, error: friendly(e) };
    }
  });

// ── 模板四：选贴纸族 + 配色 + 主体位置 ─────────────────────────
const puzzleSchema = z.object({
  family: z.enum(STICKER_FAMILIES),
  color: z.string(),
  photos: z.array(z.object({ focusX: z.number(), focusY: z.number(), avoid: z.array(z.number()) })),
});

const PUZZLE_SYSTEM = `You art-direct a photo collage. The photos are placed on a motion-blurred background built from photo 1, and crayon stickers of ONE family are scattered on photo edges.
Pick:
- family: one sticker family that fits the mood (dot, star, heart, spiral, spark, flower, firework).
- color: one crayon hex color with strong but tasteful contrast against the photos (warm, slightly muted; never black/white/grey).
- photos: one entry per photo, in order. focusX/focusY (0-1) = center of the main subject, for cropping. avoid = flat list x,y,w,h (0-1 normalized to that photo) of up to 2 boxes covering faces/key subjects that stickers must not cover.`;

export const puzzleStyle = createServerFn({ method: "POST" })
  .inputValidator((d: { images: string[] }) => {
    if (!Array.isArray(d?.images) || !d.images.length || d.images.length > 4 || !d.images.every(isDataUrl)) throw new Error("bad images");
    return { images: d.images };
  })
  .handler(async ({ data }): Promise<Result<PuzzleAI>> => {
    try {
      const out = await run(puzzleSchema, `{"family":"dot","color":"#rrggbb","photos":[{"focusX":0.5,"focusY":0.4,"avoid":[x,y,w,h]}]}`, PUZZLE_SYSTEM, `There are ${data.images.length} photos, in order.`, data.images);
      const photos = data.images.map((_, i) => {
        const p = out.photos[i];
        const avoid: [number, number, number, number][] = [];
        for (let k = 0; p && k + 3 < p.avoid.length && avoid.length < 3; k += 4)
          avoid.push([clamp(p.avoid[k]!, 0, 1), clamp(p.avoid[k + 1]!, 0, 1), clamp(p.avoid[k + 2]!, 0, 1), clamp(p.avoid[k + 3]!, 0, 1)]);
        return { focus: [clamp(p?.focusX ?? 0.5, 0, 1), clamp(p?.focusY ?? 0.5, 0, 1)] as [number, number], avoid };
      });
      return { ok: true, data: { family: out.family as StickerFamily, color: HEX.test(out.color) ? out.color : "#E9D18B", photos } };
    } catch (e) {
      console.error("puzzleStyle", e);
      return { ok: false, error: friendly(e).replace("配线", "配贴纸") };
    }
  });
