import { describe, expect, it } from "vitest";
import { TEMPLATES, blockReason, defaultOptions, getTemplate, recommendTemplate, stampText, usable } from "@/lib/templates";
import { COLLAGE_LAYOUTS, clampCrop, collageRects, initialCrop, polaroidRect } from "@/lib/collage";

describe("成品模板规则", () => {
  it("保留 4 款模板，拼图替换了拼图贴纸", () => expect(TEMPLATES.map((t) => t.id)).toEqual(["solo", "halfframe", "polaroid", "collage"]));
  it("选 2 张推荐半格胶片", () => expect(recommendTemplate(2, "ccd")).toBe("halfframe"));
  it("选 3、4 张推荐拼图", () => {
    expect(recommendTemplate(3, null)).toBe("collage");
    expect(recommendTemplate(4, "film")).toBe("collage");
  });
  it("单张拍立得照片推荐拍立得，其他推荐手绘单张", () => {
    expect(recommendTemplate(1, "instant")).toBe("polaroid");
    expect(recommendTemplate(1, "film")).toBe("solo");
  });
  it("拍立得只能用拍立得相机拍的照片", () => {
    const p = getTemplate("polaroid");
    expect(usable(p, ["instant"])).toBe(true);
    expect(usable(p, ["film"])).toBe(false);
    expect(usable(p, [null])).toBe(false);
  });
  it("拼图用 2–4 张，任何相机都能用", () => {
    const c = getTemplate("collage");
    expect(blockReason(c, ["film"])).toBe("需要选 2–4 张");
    expect(usable(c, ["film", "ccd"])).toBe(true);
    expect(usable(c, ["film", "instant", "ccd", null])).toBe(true);
  });
  it("半格只能正好 2 张：1 张和 3 张都不能用", () => {
    const h = getTemplate("halfframe");
    expect(blockReason(h, ["film"])).toBe("需要选 2 张");
    expect(blockReason(h, ["film", "film", "film"])).toBe("需要选 2 张");
    expect(blockReason(h, ["film", "film"])).toBeNull();
  });
  it("选多张时不能做手绘单张", () => {
    expect(blockReason(getTemplate("solo"), ["film", "ccd"])).toBe("需要选 1 张");
  });
  it("日期印章格式", () => expect(stampText("2026-11-11")).toBe("11 NOV 2026"));
});

describe("拍立得默认文字", () => {
  it("默认文字是照片地点", () => expect(defaultOptions("京都").caption).toBe("京都"));
  it("没有地点时留空", () => expect(defaultOptions().caption).toBe(""));
});

describe("拼图版式", () => {
  const W = 768, H = 1024;
  const close = (a: number, b: number, tol = 0.6) => expect(Math.abs(a - b)).toBeLessThan(tol);

  it("四宫格：竖图 3:4，宽 29%，横向约 45px、纵向 35px，左上→右上→左下→右下", () => {
    const r = collageRects(W, H, 4);
    expect(r).toHaveLength(4);
    close(r[0]!.w, W * 0.29);
    close(r[0]!.h / r[0]!.w, 4 / 3, 0.001);
    close(r[1]!.x - (r[0]!.x + r[0]!.w), 45.3);
    close(r[2]!.y - (r[0]!.y + r[0]!.h), 35);
    expect(r[1]!.y).toBe(r[0]!.y);
    expect(r[2]!.x).toBe(r[0]!.x);
  });

  it("双图、三图：横图 3:2，从上到下，宽 54% / 41%，纵向间距 8% / 4%", () => {
    const two = collageRects(W, H, 2), three = collageRects(W, H, 3);
    close(two[0]!.w, W * 0.54);
    close(two[0]!.h / two[0]!.w, 2 / 3, 0.001);
    close(two[1]!.y - (two[0]!.y + two[0]!.h), H * 0.08);
    close(three[0]!.w, W * 0.41);
    close(three[2]!.y - (three[1]!.y + three[1]!.h), H * 0.04);
  });

  it("整组水平、垂直居中", () => {
    for (const n of [2, 3, 4] as const) {
      const r = collageRects(W, H, n);
      const left = Math.min(...r.map((q) => q.x)), right = Math.max(...r.map((q) => q.x + q.w));
      const top = Math.min(...r.map((q) => q.y)), bottom = Math.max(...r.map((q) => q.y + q.h));
      close(left, W - right);
      close(top, H - bottom);
    }
    expect(COLLAGE_LAYOUTS[4].cols).toBe(2);
  });

  it("缩放不能小于刚好铺满（1），取景位置夹在 0–1", () => {
    expect(clampCrop({ cx: -1, cy: 2, zoom: 0.4 })).toEqual({ cx: 0, cy: 1, zoom: 1 });
  });

  it("初始取景让人脸留在槽位里", () => {
    const slot = { x: 0, y: 0, w: 300, h: 400 };
    const c = initialCrop({ width: 1600, height: 900 }, slot, [0.85, 0.3]);
    expect(c.cx).toBeGreaterThan(0.8);
  });

  it("拍立得相纸保持原比例、面积接近槽位，不盖到相邻照片", () => {
    const slot = { x: 100, y: 100, w: 300, h: 400 };
    const p = polaroidRect(slot, { width: 920, height: 1376 }, { x: 45, y: 35 });
    close(p.w / p.h, 920 / 1376, 0.001);
    expect(p.w).toBeLessThanOrEqual(slot.w + 45 * 0.8 + 0.01);
    expect(p.h).toBeLessThanOrEqual(slot.h + 35 * 0.8 + 0.01);
    close(p.x + p.w / 2, slot.x + slot.w / 2);
  });
});
