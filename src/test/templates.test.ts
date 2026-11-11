import { describe, expect, it } from "vitest";
import { TEMPLATES, getTemplate, recommendTemplate, stampText, takeCount, usable } from "@/lib/templates";

describe("成品模板规则", () => {
  it("选 2 张推荐半格胶片", () => expect(recommendTemplate(2, "ccd")).toBe("halfframe"));
  it("选 4 张推荐拍立得", () => expect(recommendTemplate(4, null)).toBe("polaroid"));
  it("单张拍立得相机推荐拍立得手记", () => expect(recommendTemplate(1, "instant")).toBe("polaroid"));
  it("半格胶片 1 张不能用，3 张只用前 2 张", () => {
    const h = getTemplate("halfframe");
    expect(usable(h, 1)).toBe(false);
    expect(takeCount(h, 3)).toBe(2);
  });
  it("保留 5 款模板", () => expect(TEMPLATES.map((t) => t.id)).toEqual(["halfframe", "polaroid", "solo", "blur", "travel"]));
  it("日期印章格式", () => expect(stampText("2031-09-14")).toBe("14 SEP 2031"));
});
