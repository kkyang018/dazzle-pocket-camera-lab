import { describe, expect, it } from "vitest";
import { TEMPLATES, blockReason, contrastCrayon, defaultOptions, getTemplate, recommendTemplate, stampText, takeCount, usable } from "@/lib/templates";

describe("成品模板规则", () => {
  it("保留 4 款模板", () => expect(TEMPLATES.map((t) => t.id)).toEqual(["solo", "halfframe", "polaroid", "puzzle"]));
  it("选 2 张推荐半格胶片", () => expect(recommendTemplate(2, "ccd")).toBe("halfframe"));
  it("选 3、4 张推荐拼图", () => {
    expect(recommendTemplate(3, null)).toBe("puzzle");
    expect(recommendTemplate(4, "film")).toBe("puzzle");
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
  it("其他模板所有相机都能用", () => {
    expect(usable(getTemplate("solo"), ["ccd"])).toBe(true);
    expect(usable(getTemplate("halfframe"), ["film", "instant"])).toBe(true);
    expect(usable(getTemplate("puzzle"), ["ccd", "film", "instant"])).toBe(true);
  });
  it("半格 1 张不能用，3 张只用前 2 张", () => {
    const h = getTemplate("halfframe");
    expect(blockReason(h, ["film"])).toBe("需要 2 张照片");
    expect(takeCount(h, 3)).toBe(2);
  });
  it("日期印章格式", () => expect(stampText("2026-11-11")).toBe("11 NOV 2026"));
  it("蓝紫背景配黄油黄贴纸", () => expect(contrastCrayon([90, 80, 160])).toBe("#E9D18B"));
});

describe("拍立得默认文字", () => {
  it("默认文字是照片地点", () => expect(defaultOptions("京都").caption).toBe("京都"));
  it("没有地点时留空", () => expect(defaultOptions().caption).toBe(""));
});
