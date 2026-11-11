import { describe, expect, it } from "vitest";
import { DEFAULT_STICKERS, detectKeywords, pickStickers, type SceneStats } from "@/lib/scene";

const base: SceneStats = { lum: 0.5, warmth: 0.5, green: 0, blue: 0, dark: 0.1, bright: 0, yellow: 0, skin: 0 };

describe("本地内容识别", () => {
  it("绿色多 → 植物", () => {
    expect(detectKeywords({ ...base, green: 0.5 }).map((k) => k.label)).toContain("植物");
  });
  it("暗部多且有光点 → 夜景/灯光", () => {
    expect(detectKeywords({ ...base, lum: 0.2, dark: 0.7, bright: 0.04 })[0]!.label).toBe("夜景/灯光");
  });
  it("暖黄主导 → 咖啡/室内", () => {
    expect(detectKeywords({ ...base, warmth: 0.75, yellow: 0.5 })[0]!.label).toBe("咖啡/室内");
  });
  it("最多 3 个关键词，贴纸 3-5 个", () => {
    const k = detectKeywords({ ...base, green: 0.5, yellow: 0.5, warmth: 0.8, blue: 0.4, lum: 0.7 });
    expect(k.length).toBe(3);
    const s = pickStickers(k);
    expect(s.length).toBeGreaterThanOrEqual(3);
    expect(s.length).toBeLessThanOrEqual(5);
  });
  it("没有匹配时用默认贴纸", () => {
    expect(pickStickers([])).toEqual(DEFAULT_STICKERS);
  });
});
