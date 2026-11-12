import { describe, expect, it } from "vitest";
import { maskToOutline } from "@/lib/solo/outline";
import { schemePalette } from "@/lib/solo/plan";
import { inkColor, localPlan, paperColor, paperHue, rgbToHsl, sanitizePlan, standOut, tintedPaper, toRgb, lum } from "@/lib/solo/plan";

/** 画一个"人"：圆头 + 下半身一直延伸到画面底边（被裁到） */
function personMask(w: number, h: number) {
  const m = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const head = Math.hypot(x - w / 2, y - h * 0.3) < h * 0.12;
    const body = Math.abs(x - w / 2) < w * 0.18 && y > h * 0.4;
    if (head || body) m[y * w + x] = 0.9;
  }
  return m;
}

describe("人物描边", () => {
  it("没有人时返回 null", () => expect(maskToOutline(new Float32Array(100 * 100), 100, 100)).toBeNull());

  it("描边坐标归一化到 0–1，并在人被裁到的底边断开", () => {
    const o = maskToOutline(personMask(120, 160), 120, 160)!;
    expect(o).not.toBeNull();
    expect(o.paths.length).toBeGreaterThan(0);
    for (const p of o.paths) for (const [x, y] of p) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
      expect(y).toBeLessThan(0.985); // 底边不画线
    }
    // 外框大致包住头和身体
    const [bx, by, bw] = o.box;
    expect(bx).toBeGreaterThan(0.2);
    expect(by).toBeLessThan(0.25);
    expect(bw).toBeLessThan(0.5);
  });

  it("有人脸框时只描含有人脸的区域，误认的物体不描", () => {
    const w = 120, h = 160, m = personMask(w, h);
    // 左上角一块"书本"
    for (let y = 10; y < 40; y++) for (let x = 5; x < 35; x++) m[y * w + x] = 0.9;
    const face: [number, number, number, number] = [w / 2 - 10, h * 0.22, 20, 22];
    const o = maskToOutline(m, w, h, 0.5, [face])!;
    expect(o.box[0]).toBeGreaterThan(0.2); // 外框不包含左上角的书
    expect(maskToOutline(m, w, h, 0.5, [])).toBeNull(); // 没找到脸 → 不描边
  });

  it("人完整在画面里时也留一个缺口（不是封闭的圈）", () => {
    const w = 100, h = 100, m = new Float32Array(w * h);
    for (let y = 20; y < 80; y++) for (let x = 30; x < 70; x++) m[y * w + x] = 1;
    const o = maskToOutline(m, w, h)!;
    const p = o.paths[0]!;
    const [ax, ay] = p[0]!, [bx, by] = p[p.length - 1]!;
    expect(Math.hypot(ax - bx, ay - by)).toBeGreaterThan(0.03);
  });
});

describe("跟着照片走的纸张和描边", () => {
  const hsl = (h: string) => rgbToHsl(toRgb(h)!);
  it("浅色纸亮、深色纸暗，色相跟照片一致", () => {
    const tone = { hue: 120, sat: 0.3, lum: 0.5 };
    const [h1, , l1] = hsl(tintedPaper(tone, false));
    const [, , l2] = hsl(tintedPaper(tone, true));
    expect(Math.abs(h1 - 120)).toBeLessThan(8);
    expect(l1).toBeGreaterThan(0.8);
    expect(l2).toBeLessThan(0.22);
  });
  it("照片越鲜艳，纸越素；照片越灰，纸越有颜色", () => {
    const vivid = hsl(tintedPaper({ hue: 30, sat: 0.55, lum: 0.5 }, false))[1];
    const dull = hsl(tintedPaper({ hue: 30, sat: 0.08, lum: 0.5 }, false))[1];
    expect(dull).toBeGreaterThan(vivid);
  });
  it("暖色主调的照片：有第二种明显颜色就用它，没有就参考 AI 线条色", () => {
    expect(paperHue({ hue: 25, sat: 0.2, lum: 0.4, alt: { hue: 215, ratio: 0.5 } }, null)).toBe(215);
    expect(paperHue({ hue: 25, sat: 0.2, lum: 0.4, alt: null }, 340)).toBe(340);
    expect(paperHue({ hue: 25, sat: 0.2, lum: 0.4, alt: null }, null)).toBe(25);
    expect(paperHue({ hue: 110, sat: 0.2, lum: 0.4, alt: { hue: 25, ratio: 0.8 } }, 340)).toBe(110); // 非暖色照片照旧
  });

  it("绿色照片上的描边不用绿色", () => {
    const c = standOut(["#6f9a4f", "#d2603a", "#e0a93a"], { hue: 110, sat: 0.4, lum: 0.45 });
    expect(c).not.toBe("#6f9a4f");
  });
});

describe("配色更多样、不再发棕", () => {
  const tone = { hue: 100, sat: 0.3, lum: 0.5 };
  it("线条色调明度时保留色相（蓝线不会变成棕色）", () => {
    const [h] = rgbToHsl(toRgb(inkColor("#9fc3e8", "#f5efe4"))!);
    expect(Math.abs(h - rgbToHsl(toRgb("#9fc3e8")!)[0])).toBeLessThan(6);
  });
  it("换一组会换配色情绪，4 次里莫兰迪、高饱和、粉彩、深色都出现", () => {
    const moods = new Set([1, 2, 3, 4].map((s) => schemePalette(200, s, tone, false).mood));
    expect(moods.size).toBe(4);
  });
  it("每套至少 3 种颜色，纸张都是浅色", () => {
    for (const s of [1, 2, 3, 4, 5]) {
      const p = schemePalette(30, s, tone, false);
      expect(p.colors.length).toBe(3);
      expect(lum(toRgb(p.paper)!)).toBeGreaterThan(0.7);
    }
  });
});

describe("手绘配色", () => {
  it("底色总是很浅", () => expect(lum(toRgb(paperColor("#3a6b2a"))!)).toBeGreaterThanOrEqual(0.86));
  it("线条色和浅底拉开明度差", () => {
    const c = inkColor("#f4ede0", "#f5efe4");
    expect(Math.abs(lum(toRgb(c)!) - lum(toRgb("#f5efe4")!))).toBeGreaterThanOrEqual(0.16);
  });
  it("清洗计划：颜色最多 3 种、长线 1–4 条、点缀坐标夹到照片内", () => {
    const p = sanitizePlan({
      theme: "night", background: "#000000", colors: ["#d98a8a", "#e0a944", "#8a93ae", "#123456"],
      motifs: [], accents: [{ kind: "burst", x: 1.4, y: -0.2, angle: 10 }], flows: 9, source: "ai",
    });
    expect(p.colors).toHaveLength(3);
    expect(p.flows).toBe(4);
    expect(p.accents[0]).toMatchObject({ x: 1, y: 0 });
  });
  it("本地规则：暗的照片是夜晚主题，有月亮", () => {
    const p = localPlan({ lum: 0.2, warmth: 0.5, green: 0, blue: 0, dark: 0.6, yellow: 0 }, true, null);
    expect(p.theme).toBe("night");
    expect(p.motifs.map((m) => m.kind)).toContain("moon");
    expect(p.source).toBe("local");
  });
});
