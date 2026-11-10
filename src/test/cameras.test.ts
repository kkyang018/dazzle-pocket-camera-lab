import { describe, expect, it } from "vitest";
import { CAMERAS, CATEGORIES, orderCameras, recommend, scoreCamera, type Camera, type PhotoStats } from "@/lib/cameras";

const cam = (id: string): Camera => ({ ...CAMERAS[0]!, id, name: id });
const five = ["a", "b", "c", "d", "e"].map(cam);

describe("camera shelf", () => {
  it("has three categories: 胶片 / CCD / 拍立得, each with cameras", () => {
    expect(CATEGORIES.map((c) => c.label)).toEqual(["胶片", "CCD", "拍立得"]);
    for (const c of CATEGORIES) expect(CAMERAS.filter((x) => x.category === c.id).length).toBeGreaterThan(2);
  });

  it("only some cameras are Pro", () => {
    const pro = CAMERAS.filter((c) => c.pro).length;
    expect(pro).toBeGreaterThan(0);
    expect(pro).toBeLessThan(CAMERAS.length);
  });

  it("AI recommends 2 cameras when the 3rd is far behind", () => {
    expect(recommend(five, { a: 0.9, b: 0.85, c: 0.6, d: 0.5, e: 0.4 })).toEqual(["a", "b"]);
  });

  it("AI recommends 3 cameras when the 3rd is close to the top", () => {
    expect(recommend(five, { a: 0.9, b: 0.89, c: 0.88, d: 0.87, e: 0.4 })).toEqual(["a", "b", "c"]);
  });

  it("puts AI picks first, then the rest in default order", () => {
    expect(orderCameras(five, ["d", "b"], []).map((c) => c.id)).toEqual(["d", "b", "a", "c", "e"]);
  });

  it("pinned cameras go before AI picks, most recently pinned first", () => {
    expect(orderCameras(five, ["d", "b"], ["e", "c"]).map((c) => c.id)).toEqual(["e", "c", "d", "b", "a"]);
  });

  it("a pinned camera that is also an AI pick appears once, in the pinned slot", () => {
    expect(orderCameras(five, ["d", "b"], ["b"]).map((c) => c.id)).toEqual(["b", "d", "a", "c", "e"]);
  });

  it("scores a warm photo higher for a warm-loving camera", () => {
    const warm: PhotoStats = { lum: 0.6, sat: 0.5, warmth: 0.8, skin: 0, green: 0, contrast: 0.5 };
    const cool: PhotoStats = { ...warm, warmth: 0.2 };
    expect(scoreCamera({ warmth: 0.75 }, warm)).toBeGreaterThan(scoreCamera({ warmth: 0.75 }, cool));
  });
});
