import { createServerFn } from "@tanstack/react-start";

/** 模板一：AI 生图在底稿上画手绘线；前端只取出新增的线条，原照片像素不用 AI 结果 */
const IMAGE_MODEL = "openai/gpt-image-2.5-sunburst";
const GATEWAY = "https://ai.gateway.lovable.dev/v1";

const PROMPT = `Editorial hand-drawn journal style, minimal and airy, like an artist doodled lightly over a printed photo with a soft crayon/pencil. Keep the photo and the paper background exactly unchanged; only add lines on top.
1. MAIN: draw ONE thin wobbly crayon contour that hugs the main subject's silhouette (e.g. around a person's hair, shoulders and arms, or a building/vehicle/object) INSIDE the photo, slightly offset from the real edge, open/unclosed, never over a face.
2. Small accent ticks/sparkle marks near a key gesture or object in the photo.
3. 2-3 long loose flowing lines that start on the paper outside the photo, cross over the photo border and end back on the paper, so the drawing interweaves with the picture.
4. 3-4 small motifs in outline style (not filled) chosen from the photo's actual content (night: moon/stars; sky: clouds/birds; water: waves; people: hearts/sparkles; plants: leaves; vehicles: motion lines). Do not default to sun and leaves. Place them hugging the photo corners/edges.
Use only 2-3 colors picked to harmonize with the photo (soft muted tones, never black, not rainbow). Mix solid, dashed and dotted strokes. Lines thin, slightly grainy crayon texture, outline only, no filled shapes, no cartoon clipart, no text, no letters, no numbers, no dates. Keep most of the paper empty.`;

type Result = { ok: true; image: string } | { ok: false; error: string };

export const soloDoodle = createServerFn({ method: "POST" })
  .inputValidator((d: { image: string; variant: number }) => {
    if (typeof d?.image !== "string" || !d.image.startsWith("data:image/png;base64,") || d.image.length > 4_000_000) throw new Error("bad image");
    return { image: d.image, variant: Math.floor(Number(d.variant) || 0) };
  })
  .handler(async ({ data }): Promise<Result> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false, error: "AI 未配置" };
    try {
      const bin = Uint8Array.from(atob(data.image.split(",")[1]!), (c) => c.charCodeAt(0));
      const form = new FormData();
      form.set("model", IMAGE_MODEL);
      form.set("image", new Blob([bin], { type: "image/png" }), "base.png");
      form.set("size", "768x1024");
      form.set("quality", "low");
      form.set("prompt", `${PROMPT}\nVariation #${data.variant}: choose a different set of motifs and line paths than other variations.`);
      const res = await fetch(`${GATEWAY}/images/edits`, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
      if (!res.ok) {
        console.error("soloDoodle", res.status, (await res.text()).slice(0, 300));
        if (res.status === 429) return { ok: false, error: "AI 有点忙，稍后再试" };
        if (res.status === 402) return { ok: false, error: "AI 额度用完了" };
        if (res.status === 403) return { ok: false, error: "AI 暂不可用" };
        return { ok: false, error: "AI 手绘失败，先用本地效果" };
      }
      const json = (await res.json()) as { data?: { b64_json?: string }[] };
      const b64 = json.data?.[0]?.b64_json;
      if (!b64) return { ok: false, error: "AI 没画出线条" };
      return { ok: true, image: `data:image/png;base64,${b64}` };
    } catch (e) {
      console.error("soloDoodle", e);
      return { ok: false, error: "AI 手绘失败，先用本地效果" };
    }
  });
